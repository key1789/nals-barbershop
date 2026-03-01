import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Users, ChevronRight, Scissors, DollarSign, 
  CheckCircle2, Circle, AlertCircle, Loader2, ClipboardList, Camera, User, Star, X, LogOut, MapPin
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

// --- RUMUS HAVERSINE (Ngitung Jarak Kordinat dalam Meter) ---
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const distance = R * c; // Jarak dalam KM
  return distance * 1000; // Ubah ke Meter
}

// --- PROMISE AMBIL LOKASI GPS HP ---
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser tidak mendukung GPS"));
    } else {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
    }
  });
};

export default function TabHome({ user, onNavigate, onLogout }) {
  const [isLoading, setIsLoading] = useState(true);
  
  // State Data
  const [broadcast, setBroadcast] = useState('');
  const [flashStats, setFlashStats] = useState({ totalKepala: 0, targetHarian: 0, estimasiKomisi: 0 });
  const [queueData, setQueueData] = useState({ totalMenunggu: 0, nextQueue: null });
  const [taskData, setTaskData] = useState({
    dailyPra: false, dailyClosing: false,
    hkWajibFoto: { done: 0, total: 0 },
    hkNonFoto: { done: 0, total: 0 }
  });

  // State GPS Outlet
  const [outletLocation, setOutletLocation] = useState({ lat: 0, lng: 0, radius: 50 });

  // State Absen Pulang
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
      const startOfToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0).toISOString();
      const endOfToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59).toISOString();

      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const targetBulanan = user.target_kepala_bulanan || 200;
      const targetHarian = Math.ceil(targetBulanan / daysInMonth);
      const gajiPokok = parseFloat(user.gaji_pokok) || 0;

      // 0. TARIK DATA LOKASI OUTLET (GPS)
      const { data: outletData } = await supabase.from('outlets').select('latitude, longitude, radius_absen').eq('id', user.outlet_id).single();
      if (outletData) {
        setOutletLocation({
          lat: parseFloat(outletData.latitude),
          lng: parseFloat(outletData.longitude),
          radius: outletData.radius_absen || 50 // Default 50 meter kalau di db kosong
        });
      }

      // 1. TARIK BROADCAST
      const { data: bData } = await supabase.from('broadcasts').select('pesan, user_id, outlet_id').eq('aktif', true).order('created_at', { ascending: false });
      if (bData && bData.length > 0) {
        const validBroadcast = bData.find(b => b.user_id === user.id || (b.outlet_id === user.outlet_id && !b.user_id) || (!b.outlet_id && !b.user_id));
        if (validBroadcast) setBroadcast(validBroadcast.pesan); else setBroadcast('');
      }

      // 2. FLASH STATS
      const { data: visitsToday } = await supabase.from('visits').select(`id, visit_items(qty, harga_saat_ini, products_services(nama_item))`).eq('capster_id', user.id).ilike('status_transaksi', 'paid').gte('created_at', startOfToday).lte('created_at', endOfToday);
      let headCount = 0; let totalOmzet = 0;
      if (visitsToday) {
        visitsToday.forEach(v => {
          v.visit_items?.forEach(item => {
            const qty = item.qty || 1;
            totalOmzet += (qty * (item.harga_saat_ini || 0));
            const namaItem = item.products_services?.nama_item || '';
            if (namaItem.toLowerCase().includes('hair cut')) headCount += qty;
          });
        });
      }
      setFlashStats({ totalKepala: headCount, targetHarian: targetHarian, estimasiKomisi: totalOmzet * (gajiPokok / 100) });

      // 3. ANTREAN
      const { data: activeQueues } = await supabase.from('visits').select(`id, no_antrean, created_at, customers(nama), visit_items(products_services(nama_item))`).eq('outlet_id', user.outlet_id).ilike('status_transaksi', 'waiting').gte('created_at', startOfToday).order('created_at', { ascending: true });
      if (activeQueues && activeQueues.length > 0) {
        const firstItem = activeQueues[0].visit_items?.[0]?.products_services?.nama_item || 'Layanan';
        setQueueData({ totalMenunggu: activeQueues.length, nextQueue: { nomor: activeQueues[0].no_antrean || 'Walk-In', nama: activeQueues[0].customers?.nama || 'Kustomer', layanan: firstItem }});
      } else {
        setQueueData({ totalMenunggu: 0, nextQueue: null });
      }

      // 4. TASK LOGS
      const { data: dailyLogs } = await supabase.from('daily_duty_logs').select('phase').eq('user_id', user.id).eq('tanggal', tanggalHariIni); 
      let praDone = false; let closeDone = false;
      if (dailyLogs) {
        praDone = dailyLogs.some(log => log.phase.toLowerCase().includes('pra'));
        closeDone = dailyLogs.some(log => log.phase.toLowerCase().includes('closing'));
      }

      const { data: hkSops } = await supabase.from('housekeeping_sops').select('id, wajib_foto').ilike('area', user.hk_area_pic || 'TIDAK_ADA');
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
    } catch (err) { console.error("Gagal load dashboard:", err); } finally { setIsLoading(false); }
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
      // 1. CEK GPS LOKASI HP DULU!
      let userLat, userLng;
      try {
        const position = await getCurrentLocation();
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;
      } catch (gpsError) {
        alert("⚠️ Gagal mendapatkan lokasi! Pastikan GPS/Location di HP Anda menyala dan browser diizinkan mengakses lokasi.");
        setIsClockingOut(false);
        return;
      }

      // 2. HITUNG JARAK DENGAN TOKO
      const distance = getDistanceFromLatLonInMeters(outletLocation.lat, outletLocation.lng, userLat, userLng);
      
      if (distance > outletLocation.radius) {
        alert(`❌ ABSEN DITOLAK!\n\nJarak Anda ${Math.round(distance)} meter dari toko.\nMaksimal jarak absen adalah ${outletLocation.radius} meter.\n\nSilakan kembali ke area toko!`);
        setIsClockingOut(false);
        return;
      }

      // 3. KALAU JARAK AMAN, UPLOAD FOTO (FIX BUCKET)
      const fileExt = clockOutFile.name.split('.').pop();
      const fileName = `pulang-${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('attendance_photos').upload(fileName, clockOutFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('attendance_photos').getPublicUrl(fileName);
      const photoUrl = publicUrlData.publicUrl;
      
      // FIX TIMESTAMP FORMAT
      const jamSekarang = new Date().toISOString();

      // 4. SIMPAN KE DATABASE (Termasuk koordinat_pulang)
      const { error: dbError } = await supabase
        .from('attendance_logs')
        .update({ 
          jam_pulang: jamSekarang,
          foto_pulang: photoUrl,
          koordinat_pulang: `${userLat},${userLng}` // Format text sesuai DB lu
        })
        .eq('user_id', user.id)
        .eq('tanggal', tanggalHariIni);

      if (dbError) throw dbError;

      alert("✅ Absen Pulang Berhasil! Hati-hati di jalan ya Bos!");
      setShowClockOutModal(false);
      
      // 5. PAKSA LOGOUT
      if(onLogout) onLogout();

    } catch (err) {
      console.error(err);
      alert("Gagal absen pulang. Pastikan koneksi internet stabil.");
    } finally {
      setIsClockingOut(false);
    }
  };

  if (isLoading) { return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>; }

  const pctPhoto = taskData.hkWajibFoto.total === 0 ? 100 : Math.round((taskData.hkWajibFoto.done / taskData.hkWajibFoto.total) * 100);
  const pctNonPhoto = taskData.hkNonFoto.total === 0 ? 100 : Math.round((taskData.hkNonFoto.done / taskData.hkNonFoto.total) * 100);
  const isTargetAchieved = flashStats.totalKepala >= flashStats.targetHarian;

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
        
        {/* FLASH STATS HARIAN */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isTargetAchieved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                <Scissors size={14}/>
              </div>
              <span className="text-[8px] font-black bg-slate-950 px-2 py-1 rounded text-slate-400 uppercase tracking-widest">Hari Ini</span>
            </div>
            <div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-3xl font-black text-white leading-none">{flashStats.totalKepala}</span>
                <span className="text-sm font-bold text-slate-500 mb-0.5">/ {flashStats.targetHarian}</span>
              </div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Target Kepala</p>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-3 overflow-hidden border border-slate-800">
              <div className={`h-full rounded-full transition-all ${isTargetAchieved ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${Math.min((flashStats.totalKepala / flashStats.targetHarian) * 100, 100)}%` }}></div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <DollarSign size={14}/>
              </div>
              <span className="text-[8px] font-black bg-slate-950 px-2 py-1 rounded text-slate-400 uppercase tracking-widest">Hari Ini</span>
            </div>
            <div>
              <span className="text-xl font-black text-emerald-400 leading-none tracking-tight block mb-1.5">
                Rp {flashStats.estimasiKomisi.toLocaleString('id-ID')}
              </span>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Est. Komisi Harian</p>
            </div>
          </div>
        </div>

        {/* RADAR ANTREAN */}
        <div onClick={() => onNavigate && onNavigate('antrean')} className="bg-indigo-600/10 border border-indigo-500/30 p-5 rounded-3xl cursor-pointer hover:bg-indigo-600/20 transition-all group shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </div>
              <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Radar Antrean</h3>
            </div>
            <span className="text-sm font-black text-white">{queueData.totalMenunggu} <span className="text-[9px] text-indigo-300 font-bold uppercase">Menunggu</span></span>
          </div>

          {queueData.totalMenunggu === 0 ? (
            <div className="bg-slate-900/50 rounded-2xl p-4 text-center border border-indigo-500/20">
              <p className="text-xs font-bold text-slate-400">Belum ada antrean saat ini.</p>
            </div>
          ) : (
            <div className="bg-indigo-600 rounded-2xl p-4 flex items-center justify-between shadow-xl shadow-indigo-900/20 relative overflow-hidden">
              <div className="relative z-10">
                <span className="text-[9px] font-black text-indigo-200 uppercase tracking-widest block mb-1">Giliran Selanjutnya</span>
                <p className="text-lg font-black text-white">{queueData.nextQueue?.nomor} - {queueData.nextQueue?.nama}</p>
                <p className="text-xs font-bold text-indigo-200 flex items-center gap-1 mt-0.5"><Scissors size={10}/> {queueData.nextQueue?.layanan}</p>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform relative z-10"><ChevronRight size={20} /></div>
            </div>
          )}
        </div>

        {/* TASK BOARD */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div className="flex items-center gap-2 mb-5">
            <ClipboardList size={16} className="text-slate-400"/>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Misi Harian</h3>
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
                  <p className="text-xs font-black uppercase">Closing</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest">{taskData.dailyClosing ? 'Submitted' : 'Pending'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-800/50">
              <div>
                <div className="flex justify-between items-end mb-1"><span className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1"><Camera size={10} className="text-indigo-400"/> HK Wajib Foto</span><span className="text-[10px] font-black text-slate-400">{taskData.hkWajibFoto.done}/{taskData.hkWajibFoto.total}</span></div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800"><div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${pctPhoto}%` }}></div></div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-1"><span className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={10} className="text-teal-400"/> HK Ceklis Biasa</span><span className="text-[10px] font-black text-slate-400">{taskData.hkNonFoto.done}/{taskData.hkNonFoto.total}</span></div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800"><div className="bg-teal-500 h-full rounded-full transition-all" style={{ width: `${pctNonPhoto}%` }}></div></div>
              </div>
              {(pctPhoto < 100 || pctNonPhoto < 100 || !taskData.dailyPra) && (
                 <div className="mt-3 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl flex items-center gap-2"><AlertCircle size={14} className="text-rose-400 shrink-0"/><p className="text-[9px] font-bold text-rose-300 uppercase tracking-widest">Ada tugas yang belum diselesaikan hari ini!</p></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ABSEN PULANG (Selfie Camera + GPS Loading) */}
      {showClockOutModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-sm rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Akhiri Shift Kerja</h3>
              <button onClick={() => setShowClockOutModal(false)} className="text-slate-500 hover:text-rose-400 transition-colors p-1"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmitClockOut} className="p-6 space-y-5">
              <div className="text-center mb-2">
                <p className="text-xs text-slate-400 font-bold">Pastikan Anda masih berada di area toko (Maksimal {outletLocation.radius}m). Wajib selfie!</p>
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