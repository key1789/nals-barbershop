import React, { useState, useEffect } from 'react';
import { 
  Camera, MapPin, Loader2, UserCheck, 
  Home, Users, ClipboardList, User, LogOut, Clock 
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

// --- IMPORT TAB ---
import TabHome from './TabHome';
import TabHomeFO from './TabHomeFO';
import TabProfil from './TabProfil';
import TabProfilFO from './TabProfilFO'; 
import TabTugas from './TabTugas';
import TabAntrean from './TabRadar'; // <-- Pastikan file ini namanya TabRadar.jsx

// --- RUMUS HAVERSINE (Jarak GPS) ---
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c * 1000; 
}

const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("Browser tidak mendukung GPS"));
    else navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
  });
};

export default function KamarCapster({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');

  const [isCheckingLock, setIsCheckingLock] = useState(true);
  const [hasClockedIn, setHasClockedIn] = useState(false);
  
  const [clockInFile, setClockInFile] = useState(null);
  const [clockInPreview, setClockInPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outletLocation, setOutletLocation] = useState({ lat: 0, lng: 0, radius: 50 });

  // --- STATE SHIFTS (BARU) ---
  const [shifts, setShifts] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');

  const tanggalHariIni = new Date().toISOString().split('T')[0];

  const isFO = user?.role?.toLowerCase().includes('fo') || 
               user?.role?.toLowerCase().includes('front office') || 
               user?.role?.toLowerCase().includes('kasir');

  // 1. CEK STATUS ABSEN & LOAD SHIFTS
  useEffect(() => {
    const checkAttendanceAndShifts = async () => {
      setIsCheckingLock(true);
      try {
        // Cek absen hari ini
        const { data: log } = await supabase
          .from('attendance_logs')
          .select('id, jam_masuk')
          .eq('user_id', user.id)
          .eq('tanggal', tanggalHariIni)
          .maybeSingle();

        if (log && log.jam_masuk) {
          setHasClockedIn(true);
        } else {
          setHasClockedIn(false);
          
          // Tarik data outlet
          const { data: outlet } = await supabase.from('outlets').select('latitude, longitude, radius_absen').eq('id', user.outlet_id).single();
          if (outlet) {
            setOutletLocation({ lat: parseFloat(outlet.latitude), lng: parseFloat(outlet.longitude), radius: outlet.radius_absen || 50 });
          }

          // Tarik data shift HANYA YANG AKTIF
          const { data: shiftData } = await supabase
            .from('shifts')
            .select('*')
            .eq('outlet_id', user.outlet_id)
            .eq('is_active', true) // Filter khusus shift aktif
            .order('jam_mulai', { ascending: true });

          if (shiftData && shiftData.length > 0) {
            setShifts(shiftData);
            
            // AUTO-SELECT SHIFT TERDEKAT DENGAN JAM SEKARANG
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            let closestShift = shiftData[0];
            let minDiff = Infinity;

            shiftData.forEach(s => {
              const [h, m] = s.jam_mulai.split(':');
              const shiftMinutes = parseInt(h) * 60 + parseInt(m);
              const diff = Math.abs(currentMinutes - shiftMinutes);
              if (diff < minDiff) {
                minDiff = diff;
                closestShift = s;
              }
            });
            setSelectedShiftId(closestShift.id);
          }
        }
      } catch (err) {
        console.error("Gagal ngecek absen:", err);
      } finally {
        setIsCheckingLock(false);
      }
    };
    checkAttendanceAndShifts();
  }, [user.id, tanggalHariIni]);

  // 2. FUNGSI EKSEKUSI ABSEN MASUK PINTAR
  const handlePhotoCapture = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setClockInFile(file);
      setClockInPreview(URL.createObjectURL(file));
    }
  };

  const handleClockIn = async (e) => {
    e.preventDefault();
    if (!clockInFile) { alert("Wajib foto selfie dulu Bos!"); return; }
    if (!selectedShiftId && shifts.length > 0) { alert("Pilih Shift dulu Bos!"); return; }
    
    setIsSubmitting(true);
    try {
      let userLat, userLng;
      try {
        const position = await getCurrentLocation();
        userLat = position.coords.latitude; userLng = position.coords.longitude;
      } catch (err) {
        alert("⚠️ Gagal mendapatkan lokasi! Pastikan GPS nyala dan browser diizinkan akses lokasi.");
        setIsSubmitting(false); return;
      }

      const distance = getDistanceFromLatLonInMeters(outletLocation.lat, outletLocation.lng, userLat, userLng);
      if (distance > outletLocation.radius) {
        alert(`❌ ABSEN DITOLAK!\n\nJarak Anda ${Math.round(distance)} meter dari toko (Maks ${outletLocation.radius}m).\nSilakan masuk ke area toko!`);
        setIsSubmitting(false); return;
      }

      // --- LOGIKA HITUNG TELAT ---
      let statusKehadiran = 'Tepat Waktu';
      let menitTelatDb = 0;
      let lateMinutes = 0;
      let shiftMulaiStr = '';

      if (selectedShiftId) {
        const selectedShift = shifts.find(s => s.id === selectedShiftId);
        if (selectedShift) {
          shiftMulaiStr = selectedShift.jam_mulai.substring(0, 5);
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          
          const [sHour, sMin] = selectedShift.jam_mulai.split(':');
          const shiftStartMinutes = parseInt(sHour) * 60 + parseInt(sMin);
          
          lateMinutes = currentMinutes - shiftStartMinutes;

          if (lateMinutes > 0) {
            statusKehadiran = 'Telat';
            menitTelatDb = lateMinutes;
          }
        }
      }

      // Upload Foto
      const fileExt = clockInFile.name.split('.').pop();
      const fileName = `masuk-${isFO ? 'fo' : 'capster'}-${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('attendance_photos').upload(fileName, clockInFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('attendance_photos').getPublicUrl(fileName);
      const photoUrl = publicUrlData.publicUrl;
      const jamSekarang = new Date().toISOString();

      // Insert Database
      const { error: dbError } = await supabase
        .from('attendance_logs')
        .insert([{
          user_id: user.id,
          outlet_id: user.outlet_id,
          shift_id: selectedShiftId || null, 
          menit_terlambat: menitTelatDb, 
          status_kehadiran: statusKehadiran, 
          tanggal: tanggalHariIni,
          jam_masuk: jamSekarang,
          foto_masuk: photoUrl,
          koordinat_masuk: `${userLat},${userLng}`
        }]);

      if (dbError) throw dbError;

      // --- ALERT FEEDBACK PINTAR ---
      if (selectedShiftId) {
        if (lateMinutes > 0) {
          alert(`⚠️ ABSEN BERHASIL, TAPI ANDA TELAT!\n\nAnda terlambat ${lateMinutes} menit dari jadwal shift (${shiftMulaiStr}). Jangan diulangi ya Bos!`);
        } else if (lateMinutes < 0) {
          alert(`🎉 ABSEN BERHASIL!\n\nWah, Anda datang ${Math.abs(lateMinutes)} menit lebih awal dari jadwal (${shiftMulaiStr}). Pertahankan semangatnya!`);
        } else {
          alert(`✅ ABSEN BERHASIL!\n\nAnda datang pas banget on-time jam ${shiftMulaiStr}. Mantap!`);
        }
      } else {
        alert("🎉 Absen Masuk Berhasil! Selamat bekerja Bos!");
      }

      setHasClockedIn(true);

    } catch (err) {
      console.error(err);
      alert("Gagal absen masuk. Pastikan koneksi aman.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingLock) {
    return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center"><Loader2 className="animate-spin text-indigo-500 mb-4" size={40}/><p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Memeriksa Status Shift...</p></div>;
  }

  if (!hasClockedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-full max-w-sm bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl shadow-indigo-900/20 text-center relative overflow-hidden">
          
          <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-indigo-500/30 relative z-10">
            <UserCheck size={36}/>
          </div>
          
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2 relative z-10">Mulai Shift {isFO && "FO"}</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6 relative z-10">Silakan absen masuk dari area toko</p>

          <form onSubmit={handleClockIn} className="relative z-10">
            
            {/* DROPDOWN PILIH SHIFT */}
            <div className="mb-4 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 flex items-center gap-1"><Clock size={12}/> Pilih Shift Kerja</label>
              <select 
                value={selectedShiftId} 
                onChange={(e) => setSelectedShiftId(e.target.value)}
                required={shifts.length > 0}
                className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-2xl text-sm font-bold text-white outline-none focus:border-indigo-500 transition-colors appearance-none"
              >
                {shifts.length === 0 && <option value="">Belum ada data shift di Database</option>}
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.nama_shift} ({s.jam_mulai.substring(0,5)} - {s.jam_selesai.substring(0,5)})</option>
                ))}
              </select>
            </div>

            <div className="relative w-full aspect-[3/4] rounded-3xl bg-slate-950 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden mb-6 group">
              {clockInPreview ? (
                <img src={clockInPreview} alt="Selfie Masuk" className="w-full h-full object-cover"/>
              ) : (
                <div className="text-center">
                  <Camera size={48} className="text-slate-600 mx-auto mb-3 group-hover:text-indigo-400 transition-colors"/>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tap Untuk Selfie</span>
                </div>
              )}
              <input type="file" accept="image/*" capture="user" onChange={handlePhotoCapture} required className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            </div>

            <button type="submit" disabled={isSubmitting || !clockInFile || (shifts.length > 0 && !selectedShiftId)} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center disabled:opacity-50 shadow-lg shadow-indigo-900/50">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin mr-2" /> Memeriksa GPS...</> : "Absen & Buka Aplikasi"}
            </button>
          </form>

          <button onClick={onLogout} className="mt-6 text-[10px] font-bold text-slate-500 hover:text-rose-400 uppercase tracking-widest transition-colors relative z-10 flex items-center justify-center gap-1 w-full">
            <LogOut size={12}/> Batal & Keluar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 min-h-screen relative">
      <div className="pb-24">
        {/* RENDER HOME */}
        {activeTab === 'home' && (
          isFO ? (
            <TabHomeFO user={user} onNavigate={setActiveTab} onLogout={onLogout} />
          ) : (
            <TabHome user={user} onNavigate={setActiveTab} onLogout={onLogout} />
          )
        )}
        
        {/* RENDER PROFIL */}
        {activeTab === 'profil' && (
          isFO ? (
            <TabProfilFO user={user} onLogout={onLogout} />
          ) : (
            <TabProfil user={user} onLogout={onLogout} />
          )
        )}
        
        {/* RENDER TUGAS */}
        {activeTab === 'tugas' && <TabTugas user={user} />}

        {/* RENDER ANTREAN */}
        {!isFO && activeTab === 'antrean' && <TabAntrean user={user} />}
      </div>

      <div className="fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-2 rounded-3xl flex justify-between items-center shadow-2xl shadow-indigo-900/20 z-50">
        
        <button onClick={() => setActiveTab('home')} className={`flex-1 flex flex-col items-center justify-center py-2 transition-all rounded-2xl ${activeTab === 'home' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
          <Home size={20} className="mb-1" />
          <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
        </button>
        
        {!isFO && (
          <button onClick={() => setActiveTab('antrean')} className={`flex-1 flex flex-col items-center justify-center py-2 transition-all rounded-2xl ${activeTab === 'antrean' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
            <Users size={20} className="mb-1" />
            <span className="text-[8px] font-black uppercase tracking-widest">Antrean</span>
          </button>
        )}

        <button onClick={() => setActiveTab('tugas')} className={`flex-1 flex flex-col items-center justify-center py-2 transition-all rounded-2xl ${activeTab === 'tugas' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
          <ClipboardList size={20} className="mb-1" />
          <span className="text-[8px] font-black uppercase tracking-widest">Tugas</span>
        </button>

        <button onClick={() => setActiveTab('profil')} className={`flex-1 flex flex-col items-center justify-center py-2 transition-all rounded-2xl ${activeTab === 'profil' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
          <User size={20} className="mb-1" />
          <span className="text-[8px] font-black uppercase tracking-widest">Profil</span>
        </button>

      </div>
    </div>
  );
}