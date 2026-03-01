import React, { useState, useEffect } from 'react';
import { 
  Camera, MapPin, Loader2, UserCheck, 
  Home, Users, ClipboardList, User, LogOut 
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

  const tanggalHariIni = new Date().toISOString().split('T')[0];

  const isFO = user?.role?.toLowerCase().includes('fo') || 
               user?.role?.toLowerCase().includes('front office') || 
               user?.role?.toLowerCase().includes('kasir');

  // 1. CEK STATUS ABSEN HARI INI
  useEffect(() => {
    const checkAttendance = async () => {
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
        }
      } catch (err) {
        console.error("Gagal ngecek absen:", err);
      } finally {
        setIsCheckingLock(false);
      }
    };
    checkAttendance();
  }, [user.id, tanggalHariIni]);

  // 2. FUNGSI EKSEKUSI ABSEN MASUK
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
    
    setIsSubmitting(true);
    try {
      let userLat, userLng;
      try {
        const position = await getCurrentLocation();
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;
      } catch (err) {
        alert("⚠️ Gagal mendapatkan lokasi! Pastikan GPS HP nyala dan browser diizinkan akses lokasi.");
        setIsSubmitting(false); return;
      }

      const distance = getDistanceFromLatLonInMeters(outletLocation.lat, outletLocation.lng, userLat, userLng);
      if (distance > outletLocation.radius) {
        alert(`❌ ABSEN DITOLAK!\n\nJarak Anda ${Math.round(distance)} meter dari toko (Maks ${outletLocation.radius}m).\nSilakan masuk ke area toko!`);
        setIsSubmitting(false); return;
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
          tanggal: tanggalHariIni,
          jam_masuk: jamSekarang,
          foto_masuk: photoUrl,
          koordinat_masuk: `${userLat},${userLng}`
        }]);

      if (dbError) throw dbError;

      alert("🎉 Absen Masuk Berhasil! Selamat bekerja Bos!");
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
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8 relative z-10">Silakan absen masuk dari area toko</p>

          <form onSubmit={handleClockIn} className="relative z-10">
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

            <button type="submit" disabled={isSubmitting || !clockInFile} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center disabled:opacity-50 shadow-lg shadow-indigo-900/50">
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

        {/* RENDER ANTREAN - SEKARANG SUDAH DIBUKA GEMBOKNYA */}
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