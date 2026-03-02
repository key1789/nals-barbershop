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
import TabAntrean from './TabRadar'; 
import CombatLounge from './CombatLounge'; 

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
  const [tamuAktif, setTamuAktif] = useState(null); 

  const [isCheckingLock, setIsCheckingLock] = useState(true);
  const [hasClockedIn, setHasClockedIn] = useState(false);
  
  const [clockInFile, setClockInFile] = useState(null);
  const [clockInPreview, setClockInPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outletLocation, setOutletLocation] = useState({ lat: 0, lng: 0, radius: 50 });

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
          
          const { data: outlet } = await supabase.from('outlets').select('latitude, longitude, radius_absen').eq('id', user.outlet_id).single();
          if (outlet) {
            setOutletLocation({ lat: parseFloat(outlet.latitude), lng: parseFloat(outlet.longitude), radius: outlet.radius_absen || 50 });
          }

          const { data: shiftData } = await supabase
            .from('shifts')
            .select('*')
            .eq('outlet_id', user.outlet_id)
            .eq('is_active', true) 
            .order('jam_mulai', { ascending: true });

          if (shiftData && shiftData.length > 0) {
            setShifts(shiftData);
            
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

      const fileExt = clockInFile.name.split('.').pop();
      const fileName = `masuk-${isFO ? 'fo' : 'capster'}-${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('attendance_photos').upload(fileName, clockInFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('attendance_photos').getPublicUrl(fileName);
      const photoUrl = publicUrlData.publicUrl;
      const jamSekarang = new Date().toISOString();

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

  // --- RENDER SCREEN (UI SUDAH DIROMBAK KE LIGHT MODE) ---

  // 1. Layar Loading (Clean White)
  if (isCheckingLock) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-gray-900 mb-4" size={40}/>
        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Memeriksa Status Shift...</p>
      </div>
    );
  }

  // 2. Layar Clock-in (Airbnb Style Card)
  if (!hasClockedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-full max-w-sm bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center relative overflow-hidden">
          
          <div className="w-20 h-20 bg-gray-50 text-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-100 relative z-10">
            <UserCheck size={36} strokeWidth={1.5}/>
          </div>
          
          <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2 relative z-10">Mulai Shift {isFO && "FO"}</h2>
          <p className="text-[11px] text-gray-500 font-medium tracking-wide mb-8 relative z-10">Silakan absen masuk dari area toko</p>

          <form onSubmit={handleClockIn} className="relative z-10">
            
            <div className="mb-5 text-left">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1 mb-2 flex items-center gap-1"><Clock size={12}/> Pilih Shift Kerja</label>
              <select 
                value={selectedShiftId} 
                onChange={(e) => setSelectedShiftId(e.target.value)}
                required={shifts.length > 0}
                className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all appearance-none"
              >
                {shifts.length === 0 && <option value="">Belum ada data shift di Database</option>}
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.nama_shift} ({s.jam_mulai.substring(0,5)} - {s.jam_selesai.substring(0,5)})</option>
                ))}
              </select>
            </div>

            <div className="relative w-full aspect-[3/4] rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden mb-6 group hover:border-gray-400 transition-colors">
              {clockInPreview ? (
                <img src={clockInPreview} alt="Selfie Masuk" className="w-full h-full object-cover"/>
              ) : (
                <div className="text-center">
                  <Camera size={40} strokeWidth={1.5} className="text-gray-400 mx-auto mb-3 group-hover:text-gray-600 transition-colors"/>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tap Untuk Selfie</span>
                </div>
              )}
              <input type="file" accept="image/*" capture="user" onChange={handlePhotoCapture} required className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            </div>

            <button type="submit" disabled={isSubmitting || !clockInFile || (shifts.length > 0 && !selectedShiftId)} className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-sm tracking-wide active:scale-95 transition-all flex justify-center items-center disabled:opacity-50 disabled:bg-gray-300">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin mr-2" /> Memeriksa GPS...</> : "Absen & Buka Aplikasi"}
            </button>
          </form>

          <button onClick={onLogout} className="mt-6 text-[11px] font-bold text-gray-400 hover:text-red-500 tracking-wide transition-colors relative z-10 flex items-center justify-center gap-1 w-full">
            <LogOut size={14}/> Batal & Keluar
          </button>
        </div>
      </div>
    );
  }

  if (tamuAktif) {
    return (
      <CombatLounge 
        user={user} 
        tamu={tamuAktif} 
        onBack={() => setTamuAktif(null)} 
      />
    );
  }

  // 3. Layar Utama & Bottom Navigation (Clean & Glassmorphism)
  return (
    <div className="bg-gray-50 min-h-screen relative font-sans text-gray-900">
      <div className="pb-28">
        {/* Konten Tab dibiarin jalan normal */}
        {activeTab === 'home' && (isFO ? <TabHomeFO user={user} onNavigate={setActiveTab} onLogout={onLogout} /> : <TabHome user={user} onNavigate={setActiveTab} onLogout={onLogout} />)}
        {activeTab === 'profil' && (isFO ? <TabProfilFO user={user} onLogout={onLogout} /> : <TabProfil user={user} onLogout={onLogout} />)}
        {activeTab === 'tugas' && <TabTugas user={user} />}
        {!isFO && activeTab === 'antrean' && <TabAntrean user={user} onSelectTamu={(tamu) => setTamuAktif(tamu)} />}
      </div>

      {/* Floating Bottom Navigation (Airbnb Vibe) */}
      <div className="fixed bottom-6 left-6 right-6 bg-white/90 backdrop-blur-lg border border-gray-100 p-2 rounded-[2rem] flex justify-between items-center shadow-[0_10px_40px_rgba(0,0,0,0.08)] z-50">
        
        <button onClick={() => setActiveTab('home')} className={`flex-1 flex flex-col items-center justify-center py-3 transition-all rounded-3xl ${activeTab === 'home' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
          <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 1.5} className="mb-1" />
          <span className={`text-[9px] tracking-wide ${activeTab === 'home' ? 'font-black' : 'font-semibold'}`}>Home</span>
        </button>
        
        {!isFO && (
          <button onClick={() => setActiveTab('antrean')} className={`flex-1 flex flex-col items-center justify-center py-3 transition-all rounded-3xl ${activeTab === 'antrean' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
            <Users size={22} strokeWidth={activeTab === 'antrean' ? 2.5 : 1.5} className="mb-1" />
            <span className={`text-[9px] tracking-wide ${activeTab === 'antrean' ? 'font-black' : 'font-semibold'}`}>Antrean</span>
          </button>
        )}

        <button onClick={() => setActiveTab('tugas')} className={`flex-1 flex flex-col items-center justify-center py-3 transition-all rounded-3xl ${activeTab === 'tugas' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
          <ClipboardList size={22} strokeWidth={activeTab === 'tugas' ? 2.5 : 1.5} className="mb-1" />
          <span className={`text-[9px] tracking-wide ${activeTab === 'tugas' ? 'font-black' : 'font-semibold'}`}>Tugas</span>
        </button>

        <button onClick={() => setActiveTab('profil')} className={`flex-1 flex flex-col items-center justify-center py-3 transition-all rounded-3xl ${activeTab === 'profil' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
          <User size={22} strokeWidth={activeTab === 'profil' ? 2.5 : 1.5} className="mb-1" />
          <span className={`text-[9px] tracking-wide ${activeTab === 'profil' ? 'font-black' : 'font-semibold'}`}>Profil</span>
        </button>

      </div>
    </div>
  );
}