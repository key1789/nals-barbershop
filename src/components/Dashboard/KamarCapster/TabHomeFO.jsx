import React, { useState, useEffect } from 'react';
import { 
  Megaphone, CheckCircle2, Circle, AlertCircle, 
  Loader2, ClipboardList, Camera, User, Star, X, LogOut
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

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
  
  const [broadcast, setBroadcast] = useState('');
  const [taskData, setTaskData] = useState({
    dailyPra: false, dailyClosing: false,
    hkWajibFoto: { done: 0, total: 0 },
    hkNonFoto: { done: 0, total: 0 }
  });

  const [outletLocation, setOutletLocation] = useState({ lat: 0, lng: 0, radius: 50 });
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockOutFile, setClockOutFile] = useState(null);
  const [clockOutPreview, setClockOutPreview] = useState('');
  const [isClockingOut, setIsClockingOut] = useState(false);

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const tanggalHariIni = currentDate.toISOString().split('T')[0];

  useEffect(() => { fetchDashboardData(); }, [user.id]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: outletData } = await supabase.from('outlets').select('latitude, longitude, radius_absen').eq('id', user.outlet_id).single();
      if (outletData) setOutletLocation({ lat: parseFloat(outletData.latitude), lng: parseFloat(outletData.longitude), radius: outletData.radius_absen || 50 });

      const { data: bData } = await supabase.from('broadcasts').select('pesan, user_id, outlet_id').eq('aktif', true).order('created_at', { ascending: false });
      if (bData && bData.length > 0) {
        const validBroadcast = bData.find(b => b.user_id === user.id || (b.outlet_id === user.outlet_id && !b.user_id) || (!b.outlet_id && !b.user_id));
        if (validBroadcast) setBroadcast(validBroadcast.pesan); else setBroadcast('');
      }

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
    } catch (err) { console.error("Gagal load dashboard FO:", err); } finally { setIsLoading(false); }
  };

  const handlePhotoCapture = (e) => {
    if (e.target.files && e.target.files[0]) {
      setClockOutFile(e.target.files[0]);
      setClockOutPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleSubmitClockOut = async (e) => {
    e.preventDefault();
    if (!clockOutFile) { alert("Wajib foto selfie dulu Bos sebelum pulang!"); return; }
    
    setIsClockingOut(true);
    try {
      let userLat, userLng;
      try { const position = await getCurrentLocation(); userLat = position.coords.latitude; userLng = position.coords.longitude; } 
      catch (gpsError) { alert("⚠️ Gagal mendapatkan lokasi GPS."); setIsClockingOut(false); return; }

      const distance = getDistanceFromLatLonInMeters(outletLocation.lat, outletLocation.lng, userLat, userLng);
      if (distance > outletLocation.radius) { alert(`❌ ABSEN DITOLAK!\nJarak Anda ${Math.round(distance)}m dari toko.`); setIsClockingOut(false); return; }

      const fileExt = clockOutFile.name.split('.').pop();
      const fileName = `pulang-fo-${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('attendance_photos').upload(fileName, clockOutFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('attendance_photos').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('attendance_logs').update({ jam_pulang: new Date().toISOString(), foto_pulang: publicUrlData.publicUrl, koordinat_pulang: `${userLat},${userLng}` }).eq('user_id', user.id).eq('tanggal', tanggalHariIni);
      if (dbError) throw dbError;

      alert("✅ Absen Pulang Berhasil! Kasir ditutup, hati-hati di jalan!");
      setShowClockOutModal(false);
      if(onLogout) onLogout();

    } catch (err) { alert("Gagal absen pulang."); } finally { setIsClockingOut(false); }
  };

  if (isLoading) { return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="animate-spin text-gray-900" size={40}/></div>; }

  const pctPhoto = taskData.hkWajibFoto.total === 0 ? 100 : Math.round((taskData.hkWajibFoto.done / taskData.hkWajibFoto.total) * 100);
  const pctNonPhoto = taskData.hkNonFoto.total === 0 ? 100 : Math.round((taskData.hkNonFoto.done / taskData.hkNonFoto.total) * 100);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-28 animate-in fade-in duration-300 font-sans">
      
      {/* HEADER & BROADCAST */}
      <div className="bg-white p-6 pb-8 rounded-b-[2.5rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] relative z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
               {user.photo_url ? <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover"/> : <User className="w-full h-full p-3 text-gray-400"/>}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{formattedDate}</p>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none mt-1">Halo, {user.nama.split(' ')[0]}</h2>
            </div>
          </div>
          
          <button onClick={() => setShowClockOutModal(true)} className="bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all active:scale-95 border border-red-100">
             <LogOut size={14} className="text-red-500"/>
             <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Pulang</span>
          </button>
        </div>

        {broadcast && (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3 mt-4">
            <Megaphone size={18} className="text-blue-500 shrink-0 mt-0.5 animate-pulse"/>
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Pesan Manager</p>
              <p className="text-xs font-bold text-blue-900 leading-relaxed">{broadcast}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 mt-6 space-y-6 relative z-0">
        
        {/* TASK BOARD (Misi Harian Kasir) */}
        <div className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-6">
            <ClipboardList size={18} className="text-gray-900"/>
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Misi Harian FO</h3>
          </div>

          <div className="space-y-5">
            <div className="flex gap-3">
              <div className={`flex-1 p-4 rounded-[1.5rem] border flex flex-col justify-center gap-2 ${taskData.dailyPra ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                {taskData.dailyPra ? <CheckCircle2 size={24} className="text-green-500"/> : <Circle size={24} className="text-gray-300"/>}
                <div>
                  <p className="text-xs font-black uppercase tracking-wide">Pra-Open</p>
                </div>
              </div>
              <div className={`flex-1 p-4 rounded-[1.5rem] border flex flex-col justify-center gap-2 ${taskData.dailyClosing ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                {taskData.dailyClosing ? <CheckCircle2 size={24} className="text-green-500"/> : <Circle size={24} className="text-gray-300"/>}
                <div>
                  <p className="text-xs font-black uppercase tracking-wide">Closing</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div>
                <div className="flex justify-between items-end mb-2"><span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Camera size={12}/> Jobdesk Logbook (Foto)</span><span className="text-xs font-black text-gray-900">{taskData.hkWajibFoto.done}/{taskData.hkWajibFoto.total}</span></div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"><div className="bg-gray-900 h-full rounded-full transition-all" style={{ width: `${pctPhoto}%` }}></div></div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-2"><span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><ClipboardList size={12}/> Jobdesk Logbook</span><span className="text-xs font-black text-gray-900">{taskData.hkNonFoto.done}/{taskData.hkNonFoto.total}</span></div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"><div className="bg-gray-400 h-full rounded-full transition-all" style={{ width: `${pctNonPhoto}%` }}></div></div>
              </div>
              {(pctPhoto < 100 || pctNonPhoto < 100 || !taskData.dailyPra) && (
                 <div className="mt-4 bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2"><AlertCircle size={16} className="text-red-500 shrink-0"/><p className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Daily Duty FO belum lengkap!</p></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ABSEN PULANG */}
      {showClockOutModal && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 pb-8 sm:pb-0">
            <div className="p-5 flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Akhiri Shift</h3>
              <button onClick={() => setShowClockOutModal(false)} className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 rounded-full p-2"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmitClockOut} className="p-6 pt-0 space-y-6">
              <div className="text-center mb-4">
                <p className="text-xs text-gray-500 font-medium">Pastikan laci kasir di-closing. Selfie di meja kasir!</p>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative w-full aspect-[3/4] rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden mb-2 group">
                  {clockOutPreview ? (
                    <img src={clockOutPreview} alt="Selfie" className="w-full h-full object-cover"/>
                  ) : (
                    <div className="text-center">
                      <Camera size={48} strokeWidth={1.5} className="text-gray-400 mx-auto mb-3"/>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tap Kamera</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" capture="user" onChange={handlePhotoCapture} required className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                </div>
              </div>

              <button type="submit" disabled={isClockingOut || !clockOutFile} className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-[1.5rem] font-bold text-sm tracking-wide active:scale-95 transition-all flex justify-center items-center disabled:opacity-50 disabled:bg-gray-300 gap-2">
                {isClockingOut ? <><Loader2 size={18} className="animate-spin" /> Mengecek GPS...</> : <><LogOut size={18}/> Absen Pulang & Keluar</>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}