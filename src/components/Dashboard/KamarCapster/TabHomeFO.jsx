import React, { useState, useEffect } from 'react';
import { 
  Megaphone, CheckCircle2, Circle, AlertCircle, 
  Loader2, ClipboardList, Camera, User, Star, X, LogOut
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

// --- RUMUS HAVERSINE (Ngitung Jarak Kordinat) ---
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

export default function TabHomeFO({ user, onLogout }) {
  const [isLoading, setIsLoading] = useState(true);
  
  // State Data
  const [broadcast, setBroadcast] = useState('');
  const [taskData, setTaskData] = useState({
    dailyPra: false, dailyClosing: false,
    hkWajibFoto: { done: 0, total: 0 },
    hkNonFoto: { done: 0, total: 0 }
  });

  // State GPS & Absen Pulang
  const [outletLocation, setOutletLocation] = useState({ lat: 0, lng: 0, radius: 50 });
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockOutFile, setClockOutFile] = useState(null);
  const [clockOutPreview, setClockOutPreview] = useState('');
  const [isClockingOut, setIsClockingOut] = useState(false);

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const tanggalHariIni = currentDate.toISOString().split('T')[0];

  useEffect(() => {
    fetchDashboardData();
  }, [user.id]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 0. TARIK DATA LOKASI OUTLET (GPS)
      const { data: outletData } = await supabase.from('outlets').select('latitude, longitude, radius_absen').eq('id', user.outlet_id).single();
      if (outletData) {
        setOutletLocation({ lat: parseFloat(outletData.latitude), lng: parseFloat(outletData.longitude), radius: outletData.radius_absen || 50 });
      }

      // 1. TARIK BROADCAST
      const { data: bData } = await supabase.from('broadcasts').select('pesan, user_id, outlet_id').eq('aktif', true).order('created_at', { ascending: false });
      if (bData && bData.length > 0) {
        const validBroadcast = bData.find(b => b.user_id === user.id || (b.outlet_id === user.outlet_id && !b.user_id) || (!b.outlet_id && !b.user_id));
        if (validBroadcast) setBroadcast(validBroadcast.pesan); else setBroadcast('');
      }

      // 2. TASK LOGS (SOP & Housekeeping FO)
      const { data: dailyLogs } = await supabase.from('daily_duty_logs').select('phase').eq('user_id', user.id).eq('tanggal', tanggalHariIni); 
      let praDone = false; let closeDone = false;
      if (dailyLogs) {
        praDone = dailyLogs.some(log => log.phase.toLowerCase().includes('pra'));
        closeDone = dailyLogs.some(log => log.phase.toLowerCase().includes('closing'));
      }

      const { data: hkSops } = await supabase.from('housekeeping_sops').select('id, wajib_foto').ilike('area', user.hk_area_pic || 'FRONT_OFFICE');
      const { data: hkLogs } = await supabase.from('housekeeping_logs').select('sop_id, status').eq('user_id', user.id).eq('tanggal', tanggalHariIni);
      
      let photoTotal = 0; let photoDone = 0; let nonPhotoTotal = 0; let nonPhotoDone = 0;
      if (hkSops) {
        hkSops.forEach(sop => {
          if (sop.wajib_foto) photoTotal++; else nonPhotoTotal++;
          const logMatch = hkLogs?.find(l => l.sop_id === sop.id);
          if (logMatch && logMatch.status === 'Selesai') { if (sop.wajib_foto) photoDone++; else nonPhotoDone++; }
        });
      }
      setTaskData({ dailyPra: praDone, dailyClosing: closeDone, hkWajibFoto: { done: photoDone, total: photoTotal }, hkNonFoto: { done: nonPhotoDone, total: nonPhotoTotal }});
    } catch (err) { 
      console.error("Gagal load dashboard FO:", err); 
    } finally { 
      setIsLoading(false); 
    }
  };

  // ==========================================
  // FUNGSI ABSEN PULANG + GEOFENCING 
  // ==========================================
  const handlePhotoCapture = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setClockOutFile(file);
      setClockOutPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitClockOut = async (e) => {
    e.preventDefault();
    if (!clockOutFile) { alert("Wajib foto selfie dulu Bos sebelum pulang!"); return; }
    
    setIsClockingOut(true);
    try {
      let userLat, userLng;
      try {
        const position = await getCurrentLocation();
        userLat = position.coords.latitude; userLng = position.coords.longitude;
      } catch (gpsError) {
        alert("⚠️ Gagal mendapatkan lokasi! Pastikan GPS/Location di HP Anda menyala.");
        setIsClockingOut(false); return;
      }

      const distance = getDistanceFromLatLonInMeters(outletLocation.lat, outletLocation.lng, userLat, userLng);
      if (distance > outletLocation.radius) {
        alert(`❌ ABSEN DITOLAK!\n\nJarak Anda ${Math.round(distance)} meter dari toko.\nMaksimal jarak absen adalah ${outletLocation.radius} meter.`);
        setIsClockingOut(false); return;
      }

      const fileExt = clockOutFile.name.split('.').pop();
      const fileName = `pulang-fo-${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('attendance_photos').upload(fileName, clockOutFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('attendance_photos').getPublicUrl(fileName);
      const photoUrl = publicUrlData.publicUrl;
      const jamSekarang = new Date().toISOString();

      const { error: dbError } = await supabase.from('attendance_logs').update({ 
        jam_pulang: jamSekarang, foto_pulang: photoUrl, koordinat_pulang: `${userLat},${userLng}`
      }).eq('user_id', user.id).eq('tanggal', tanggalHariIni);

      if (dbError) throw dbError;

      alert("✅ Absen Pulang Berhasil! Kasir ditutup, hati-hati di jalan!");
      setShowClockOutModal(false);
      if(onLogout) onLogout();

    } catch (err) {
      console.error(err); alert("Gagal absen pulang. Pastikan koneksi aman.");
    } finally { setIsClockingOut(false); }
  };

  if (isLoading) { return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>; }

  const pctPhoto = taskData.hkWajibFoto.total === 0 ? 100 : Math.round((taskData.hkWajibFoto.done / taskData.hkWajibFoto.total) * 100);
  const pctNonPhoto = taskData.hkNonFoto.total === 0 ? 100 : Math.round((taskData.hkNonFoto.done / taskData.hkNonFoto.total) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 animate-in fade-in duration-300">
      
      {/* HEADER & BROADCAST */}
      <div className="bg-indigo-600 p-6 pb-16 rounded-b-[2.5rem] relative overflow-hidden shadow-lg shadow-indigo-900/20">
        <Star size={150} className="absolute -right-10 -top-10 text-white opacity-5 rotate-45" />
        
        <div className="flex justify-between items-center relative z-10 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-white/50 overflow-hidden shrink-0">
               {user.photo_url ? <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover"/> : <User className="w-full h-full p-2 text-slate-400"/>}
            </div>
            <div>
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">{formattedDate}</p>
              <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none mt-1">Siap Kerja Hari Ini?</h2>
            </div>
          </div>
          
          <button onClick={() => setShowClockOutModal(true)} className="bg-rose-500 hover:bg-rose-600 px-3 py-2 rounded-xl shadow-lg shadow-rose-900/30 flex items-center gap-1.5 transition-all active:scale-95">
             <LogOut size={12} className="text-white"/>
             <span className="text-[9px] font-black text-white uppercase tracking-widest">Akhiri Shift</span>
          </button>
        </div>

        {broadcast && (
          <div className="bg-indigo-900/40 backdrop-blur-sm border border-indigo-400/30 p-3 rounded-2xl flex items-start gap-3 relative z-10 shadow-inner">
            <Megaphone size={18} className="text-amber-400 shrink-0 mt-0.5 animate-bounce"/>
            <div>
              <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-0.5">Pesan Manager</p>
              <p className="text-xs font-bold text-white leading-relaxed">{broadcast}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 -mt-8 space-y-5 relative z-20">
        
        {/* TASK BOARD (Misi Harian Kasir) - Langsung Tampil, Nggak Pakai Spacer */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div className="flex items-center gap-2 mb-5">
            <ClipboardList size={16} className="text-slate-400"/>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Misi Harian Kasir</h3>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className={`flex-1 p-3 rounded-2xl border flex items-center gap-3 ${taskData.dailyPra ? 'bg-emerald-900/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                {taskData.dailyPra ? <CheckCircle2 size={18}/> : <Circle size={18}/>}
                <div>
                  <p className="text-xs font-black uppercase">Pra-Opening</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest">{taskData.dailyPra ? 'Submitted' : 'Pending'}</p>
                </div>
              </div>
              <div className={`flex-1 p-3 rounded-2xl border flex items-center gap-3 ${taskData.dailyClosing ? 'bg-emerald-900/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                {taskData.dailyClosing ? <CheckCircle2 size={18}/> : <Circle size={18}/>}
                <div>
                  <p className="text-xs font-black uppercase">Closing Kasir</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest">{taskData.dailyClosing ? 'Submitted' : 'Pending'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-800/50">
              <div>
                <div className="flex justify-between items-end mb-1"><span className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1"><Camera size={10} className="text-indigo-400"/> Jobdesk Logbook (Foto)</span><span className="text-[10px] font-black text-slate-400">{taskData.hkWajibFoto.done}/{taskData.hkWajibFoto.total}</span></div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800"><div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${pctPhoto}%` }}></div></div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-1"><span className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={10} className="text-teal-400"/> Jobdesk Logbook</span><span className="text-[10px] font-black text-slate-400">{taskData.hkNonFoto.done}/{taskData.hkNonFoto.total}</span></div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800"><div className="bg-teal-500 h-full rounded-full transition-all" style={{ width: `${pctNonPhoto}%` }}></div></div>
              </div>
              {(pctPhoto < 100 || pctNonPhoto < 100 || !taskData.dailyPra) && (
                 <div className="mt-3 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl flex items-center gap-2"><AlertCircle size={14} className="text-rose-400 shrink-0"/><p className="text-[9px] font-bold text-rose-300 uppercase tracking-widest">Daily Duty / Logbook belum lengkap!</p></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ABSEN PULANG */}
      {showClockOutModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-sm rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Akhiri Shift Kerja</h3>
              <button onClick={() => setShowClockOutModal(false)} className="text-slate-500 hover:text-rose-400 transition-colors p-1"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmitClockOut} className="p-6 space-y-5">
              <div className="text-center mb-2">
                <p className="text-xs text-slate-400 font-bold">Pastikan laci kasir sudah di-closing. Wajib selfie di meja kasir!</p>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative w-full aspect-[3/4] rounded-2xl bg-slate-950 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden mb-2 group">
                  {clockOutPreview ? (
                    <img src={clockOutPreview} alt="Selfie Pulang" className="w-full h-full object-cover"/>
                  ) : (
                    <div className="text-center">
                      <Camera size={40} className="text-slate-600 mx-auto mb-2 group-hover:text-indigo-400 transition-colors"/>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tap Buka Kamera</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" capture="user" onChange={handlePhotoCapture} required className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isClockingOut || !clockOutFile} className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center disabled:opacity-50 gap-2">
                  {isClockingOut ? <><Loader2 size={16} className="animate-spin" /> Mengecek GPS & Upload...</> : <><LogOut size={16}/> Absen Pulang & Keluar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}