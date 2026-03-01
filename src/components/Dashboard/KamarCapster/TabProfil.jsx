import React, { useState, useEffect } from 'react';
import { 
  User, Award, TrendingUp, Scissors, MapPin, 
  LogOut, Star, Loader2, DollarSign, CheckCircle2, History, Activity,
  Settings, Camera, X, Trophy, Medal
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

export default function TabProfil({ user, onLogout }) {
  const [isLoading, setIsLoading] = useState(true);
  
  // --- STATE TAMPILAN ---
  const [viewMode, setViewMode] = useState('live'); 
  const [historyPeriods, setHistoryPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');

  // --- STATE MODAL ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // --- STATE DATA ---
  const [stats, setStats] = useState({ totalOmzet: 0, estimasiKomisi: 0, totalKepala: 0, targetKepala: 200, percentProgress: 0 });
  const [kpiData, setKpiData] = useState([]);
  const [totalKpiScore, setTotalKpiScore] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState([]);
  
  // Data Profil Live
  const [profileData, setProfileData] = useState({ nama: user.nama, username: user.username || '', photo_url: user.photo_url || '' });
  const [editForm, setEditForm] = useState({ nama: '', username: '', password: '', photoFile: null, photoPreview: '' });

  const currentDate = new Date();
  const currentMonthName = currentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  const periodeBulanLive = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: historyData } = await supabase.from('kpi_monthly_reports').select('periode_bulan').eq('user_id', user.id).order('periode_bulan', { ascending: false });
      if (historyData) setHistoryPeriods(historyData.map(d => d.periode_bulan));

      const { data: uData } = await supabase.from('users').select('nama, username, photo_url').eq('id', user.id).single();
      if (uData) setProfileData(uData);
    };
    fetchInitialData();
  }, [user.id]);

  useEffect(() => {
    if (viewMode === 'live') fetchLiveKPI();
    else if (viewMode === 'history' && selectedPeriod) fetchHistoryKPI(selectedPeriod);
  }, [viewMode, selectedPeriod, user.id]);


  // ==========================================
  // FUNGSI A: HITUNG LIVE & PROGRESS RING
  // ==========================================
  const fetchLiveKPI = async () => {
    setIsLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: userData } = await supabase.from('users').select('target_kepala_bulanan, gaji_pokok, toleransi_durasi_layanan_menit').eq('id', user.id).single();
      const targetKepala = userData?.target_kepala_bulanan || 200;
      const gajiPokok = parseFloat(userData?.gaji_pokok) || 0;
      const toleransiDurasi = userData?.toleransi_durasi_layanan_menit || 15;

      const { data: kpiReport } = await supabase.from('kpi_monthly_reports').select('jumlah_alfa, jumlah_komplain').eq('user_id', user.id).eq('periode_bulan', periodeBulanLive).maybeSingle();
      const jumlahAlfa = kpiReport?.jumlah_alfa || 0;
      const jumlahKomplain = kpiReport?.jumlah_komplain || 0;

      const { data: attendanceData } = await supabase.from('attendance_logs').select('menit_terlambat').eq('user_id', user.id).gte('tanggal', startOfMonth);
      const hariTelat = attendanceData ? attendanceData.filter(log => log.menit_terlambat > 0).length : 0;
      const totalPelanggaranDisiplin = hariTelat + jumlahAlfa;

      const { data: visitsData } = await supabase
        .from('visits')
        .select(`id, status_transaksi, start_service, end_service, visit_items (qty, harga_saat_ini, products_services (nama_item, durasi_menit))`)
        .eq('capster_id', user.id).ilike('status_transaksi', 'paid').gte('created_at', startOfMonth).lte('created_at', endOfMonth);
      
      let countHaircut = 0; let countUpsell = 0; let totalOmzet = 0;
      let totalVisitAman = 0; let totalVisitDihitung = 0;

      if (visitsData) {
        visitsData.forEach(visit => {
          let totalDurasiStandar = 0;
          visit.visit_items?.forEach(item => {
            const qty = item.qty || 1;
            totalOmzet += (qty * (item.harga_saat_ini || 0));
            const namaItem = item.products_services?.nama_item || '';
            const durasiMenit = item.products_services?.durasi_menit || 0;

            if (namaItem.toLowerCase().includes('hair cut')) countHaircut += qty;
            else countUpsell += qty;

            totalDurasiStandar += (durasiMenit * qty);
          });

          if (visit.start_service && visit.end_service) {
            totalVisitDihitung++;
            const start = new Date(visit.start_service);
            const end = new Date(visit.end_service);
            const actualDurationMenit = (end - start) / (1000 * 60);
            if (actualDurationMenit >= (totalDurasiStandar - toleransiDurasi) && actualDurationMenit <= (totalDurasiStandar + toleransiDurasi)) {
              totalVisitAman++;
            }
          }
        });
      }

      const { data: crmData } = await supabase.from('service_notes').select(`final_style, kondisi_rambut, rekomendasi_produk, catatan_obrolan, foto_depan, foto_belakang, foto_kanan, foto_kiri, visits!inner(capster_id)`).eq('visits.capster_id', user.id).gte('created_at', startOfMonth);
      let totalCrmFields = crmData ? crmData.length * 8 : 0;
      let filledCrmFields = 0;
      if (crmData) {
        crmData.forEach(n => {
          if (n.final_style) filledCrmFields++; if (n.kondisi_rambut) filledCrmFields++;
          if (n.rekomendasi_produk) filledCrmFields++; if (n.catatan_obrolan) filledCrmFields++;
          if (n.foto_depan) filledCrmFields++; if (n.foto_belakang) filledCrmFields++;
          if (n.foto_kanan) filledCrmFields++; if (n.foto_kiri) filledCrmFields++;
        });
      }

      const { data: hkSops } = await supabase.from('housekeeping_sops').select('id, wajib_foto').ilike('area', user.hk_area_pic || 'TIDAK_ADA');
      const { data: hkLogs } = await supabase.from('housekeeping_logs').select('id, sop_id, tanggal, status').eq('user_id', user.id).gte('tanggal', startOfMonth);
      
      const activeDates = new Set();
      if (hkLogs) hkLogs.forEach(log => activeDates.add(log.tanggal));
      const activeDaysCount = activeDates.size === 0 ? 1 : activeDates.size;
      const expectedNoPhoto = (hkSops ? hkSops.filter(s => !s.wajib_foto).length : 0) * activeDaysCount;
      const expectedPhoto = (hkSops ? hkSops.filter(s => s.wajib_foto).length : 0) * activeDaysCount;

      let doneNoPhoto = 0, kendalaNoPhoto = 0; let donePhoto = 0, kendalaPhoto = 0;
      if (hkLogs && hkSops) {
        hkLogs.forEach(log => {
          const sop = hkSops.find(s => s.id === log.sop_id);
          if (!sop) return;
          if (sop.wajib_foto) { if (log.status === 'Selesai') donePhoto++; else if (log.status === 'Kendala') kendalaPhoto++; } 
          else { if (log.status === 'Selesai') doneNoPhoto++; else if (log.status === 'Kendala') kendalaNoPhoto++; }
        });
      }
      const totalBebanHk = (expectedNoPhoto - kendalaNoPhoto) + (expectedPhoto - kendalaPhoto);
      const totalDoneHk = doneNoPhoto + donePhoto;

      const productivityPercent = Math.round((countHaircut / targetKepala) * 100);
      let prodScore = 5; if (productivityPercent >= 120) prodScore = 30; else if (productivityPercent >= 100) prodScore = 25; else if (productivityPercent >= 80) prodScore = 15;
      let disiplinScore = 0; if (totalPelanggaranDisiplin === 0) disiplinScore = 20; else if (totalPelanggaranDisiplin <= 2) disiplinScore = 15; else if (totalPelanggaranDisiplin <= 4) disiplinScore = 10;
      const crmPercent = totalCrmFields === 0 ? 0 : Math.round((filledCrmFields / totalCrmFields) * 100);
      let crmScore = 5; if (crmPercent >= 100) crmScore = 20; else if (crmPercent >= 90) crmScore = 15; else if (crmPercent >= 70) crmScore = 10;
      const durationPercent = totalVisitDihitung === 0 ? 0 : Math.round((totalVisitAman / totalVisitDihitung) * 100);
      let durationScore = 0; if (durationPercent >= 90) durationScore = 20; else if (durationPercent >= 80) durationScore = 15; else if (durationPercent >= 60) durationScore = 10;
      let komplainScore = 0; if (jumlahKomplain === 0) komplainScore = 10; else if (jumlahKomplain <= 2) komplainScore = 5;
      const upsellPercent = countHaircut === 0 ? 0 : Math.round((countUpsell / countHaircut) * 100);
      let upsellScore = 7; if (upsellPercent >= 12) upsellScore = 30; else if (upsellPercent >= 8) upsellScore = 24; else if (upsellPercent >= 4) upsellScore = 14;
      const logbookPercent = totalBebanHk > 0 ? Math.round((totalDoneHk / totalBebanHk) * 100) : 0;
      let logbookScore = 20; if (logbookPercent >= 100) logbookScore = 130; else if (logbookPercent >= 80) logbookScore = 90; else if (logbookPercent >= 70) logbookScore = 50;

      const finalScore = prodScore + disiplinScore + crmScore + durationScore + komplainScore + upsellScore + logbookScore;

      setStats({ 
        totalKepala: countHaircut, 
        estimasiKomisi: totalOmzet * (gajiPokok / 100),
        targetKepala: targetKepala,
        percentProgress: productivityPercent > 100 ? 100 : productivityPercent
      });
      setTotalKpiScore(finalScore);

      setKpiData([
        { label: "1. Productivity (Target Kepala)", percent: productivityPercent, score: prodScore, maxScore: 30, color: "indigo", desc: `${countHaircut} / ${targetKepala} Kepala` },
        { label: "2. Kedisiplinan (Absen & Izin)", percent: totalPelanggaranDisiplin === 0 ? 100 : (totalPelanggaranDisiplin >= 5 ? 0 : 50), score: disiplinScore, maxScore: 20, color: "emerald", desc: `${totalPelanggaranDisiplin} Pelanggaran` },
        { label: "3. Kelengkapan Database CRM", percent: crmPercent, score: crmScore, maxScore: 20, color: "blue", desc: `${filledCrmFields} / ${totalCrmFields} Field` },
        { label: "4. Service Duration Consistency", percent: durationPercent, score: durationScore, maxScore: 20, color: "cyan", desc: `${totalVisitAman} / ${totalVisitDihitung} Layanan Aman` },
        { label: "5. Komplain Valid Konsumen", percent: jumlahKomplain === 0 ? 100 : (jumlahKomplain >= 3 ? 0 : 50), score: komplainScore, maxScore: 10, color: "rose", desc: `${jumlahKomplain} Komplain` },
        { label: "6. Service Upsell Rate", percent: upsellPercent, score: upsellScore, maxScore: 30, color: "orange", desc: `${countUpsell} Upsell` },
        { label: "7. Kepatuhan SOP & Logbook", percent: logbookPercent, score: logbookScore, maxScore: 130, color: "teal", desc: `${totalDoneHk} / ${totalBebanHk} SOP` }
      ]);
    } catch (err) { console.error("Gagal narik live KPI:", err); } 
    finally { setIsLoading(false); }
  };

  const fetchHistoryKPI = async (period) => {
    setIsLoading(true);
    try {
      const { data: report } = await supabase.from('kpi_monthly_reports').select('*').eq('user_id', user.id).eq('periode_bulan', period).single();
      if (report) {
        setTotalKpiScore(report.total_score);
        setStats({ ...stats, totalKepala: "Rekap", estimasiKomisi: "Rekap", percentProgress: 100 });
        setKpiData([
          { label: "1. Productivity (Target Kepala)", percent: 100, score: report.score_productivity, maxScore: 30, color: "indigo", desc: `Data Rekap Historis` },
          { label: "2. Kedisiplinan (Absen & Izin)", percent: 100, score: report.score_kedisiplinan, maxScore: 20, color: "emerald", desc: `Data Rekap Historis` },
          { label: "3. Kelengkapan Database CRM", percent: 100, score: report.score_crm, maxScore: 20, color: "blue", desc: `Data Rekap Historis` },
          { label: "4. Service Duration Consistency", percent: 100, score: report.score_duration, maxScore: 20, color: "cyan", desc: `Data Rekap Historis` },
          { label: "5. Komplain Valid Konsumen", percent: 100, score: report.score_komplain, maxScore: 10, color: "rose", desc: `Data Rekap Historis` },
          { label: "6. Service Upsell Rate", percent: 100, score: report.score_upsell, maxScore: 30, color: "orange", desc: `Data Rekap Historis` },
          { label: "7. Kepatuhan SOP & Logbook", percent: 100, score: report.score_logbook, maxScore: 130, color: "teal", desc: `Data Rekap Historis` }
        ]);
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };


  // ==========================================
  // FUNGSI B: LEADERBOARD KLASEMEN (SUDAH FIX)
  // ==========================================
  const fetchLeaderboard = async () => {
    setShowLeaderboard(true);
    setIsLoadingLeaderboard(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: capsters } = await supabase.from('users').select('id, nama, photo_url').eq('outlet_id', user.outlet_id).ilike('role', '%Capster%');
      
      if (!capsters) return;
      const capsterIds = capsters.map(c => c.id);

      // 🚨 FIX ERROR 400: Query direvisi pakai products_services
      const { data: visits } = await supabase
        .from('visits')
        .select(`
          capster_id, 
          visit_items(qty, products_services(nama_item))
        `)
        .in('capster_id', capsterIds)
        .ilike('status_transaksi', 'paid')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      const scores = capsters.map(c => ({ ...c, totalHaircut: 0 }));
      if (visits) {
        visits.forEach(v => {
          const cTarget = scores.find(s => s.id === v.capster_id);
          if (cTarget) {
            v.visit_items?.forEach(item => {
              // 🚨 FIX LOGIC BACA NAMA ITEM
              const namaItem = item.products_services?.nama_item || '';
              if (namaItem.toLowerCase().includes('hair cut')) {
                cTarget.totalHaircut += (item.qty || 1);
              }
            });
          }
        });
      }
      
      scores.sort((a, b) => b.totalHaircut - a.totalHaircut);
      setLeaderboardData(scores);
    } catch (error) {
      console.error("Gagal load leaderboard:", error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };


  // ==========================================
  // FUNGSI C: UPDATE PROFIL (RE-LOGIN)
  // ==========================================
  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditForm({ ...editForm, photoFile: file, photoPreview: URL.createObjectURL(file) });
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      let finalPhotoUrl = profileData.photo_url;

      if (editForm.photoFile) {
        const fileExt = editForm.photoFile.name.split('.').pop();
        const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, editForm.photoFile);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalPhotoUrl = publicUrlData.publicUrl;
      }

      const updatePayload = {
        nama: editForm.nama,
        username: editForm.username,
        photo_url: finalPhotoUrl
      };

      if (editForm.password.trim() !== '') {
        updatePayload.password = editForm.password;
      }

      const { error } = await supabase.from('users').update(updatePayload).eq('id', user.id);
      if (error) throw error;

      alert("🎉 Profil berhasil diupdate! Silakan login kembali untuk memuat data baru.");
      onLogout(); 

    } catch (err) {
      alert("Gagal mengupdate profil. Pastikan koneksi aman.");
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };


  // ==========================================
  // SVG RING HITUNGAN (Progress Foto Profil)
  // ==========================================
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.percentProgress / 100) * circumference;
  
  let ringColor = "text-rose-500"; 
  if (stats.percentProgress >= 80) ringColor = "text-emerald-500"; 
  else if (stats.percentProgress >= 50) ringColor = "text-amber-400"; 

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 animate-in fade-in duration-300">
      
      {/* HEADER PROFIL DENGAN RING PROGRESS & TOMBOL EDIT */}
      <div className="bg-indigo-600 p-6 pb-20 rounded-b-[3rem] text-white relative overflow-hidden shadow-lg shadow-indigo-900/20">
        <Star size={120} className="absolute -right-10 -bottom-10 text-white opacity-10 rotate-12" />
        
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <h2 className="text-2xl font-black tracking-tighter italic uppercase">Profil Kinerja</h2>
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">Data Karyawan</p>
          </div>
          <button 
            onClick={() => {
              setEditForm({ nama: profileData.nama, username: profileData.username || '', password: '', photoFile: null, photoPreview: '' });
              setShowEditModal(true);
            }}
            className="bg-white/20 backdrop-blur-sm p-2 rounded-xl hover:bg-white/30 transition-all active:scale-95"
          >
             <Settings size={20} className="text-white"/>
          </button>
        </div>

        <div className="flex items-center gap-5 relative z-10">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-indigo-400/30" />
              <circle 
                cx="48" cy="48" r={radius} 
                stroke="currentColor" strokeWidth="4" fill="transparent" 
                className={`${ringColor} transition-all duration-1000 ease-out`}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="w-20 h-20 rounded-full bg-slate-900 overflow-hidden flex items-center justify-center border-4 border-slate-900 relative z-10 shadow-xl">
              {profileData.photo_url ? (
                <img src={profileData.photo_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-white">{profileData.nama?.charAt(0).toUpperCase() || 'U'}</span>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-2xl font-black leading-none uppercase tracking-tight mb-1">{profileData.nama}</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-[9px] font-black bg-white text-indigo-600 px-2 py-0.5 rounded uppercase tracking-widest shadow-sm">{user?.role}</span>
              <span className="text-[9px] font-black bg-indigo-500 text-white border border-indigo-400 px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1"><MapPin size={10}/> {user?.hk_area_pic || 'No Area'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-10 space-y-6 relative z-20">
        
        {/* KARTU STATISTIK (Leaderboard Clickable) */}
        <div className="bg-slate-900 p-1.5 rounded-[2rem] border border-slate-800 shadow-xl flex">
          <div 
            onClick={fetchLeaderboard}
            className="flex-1 p-4 flex flex-col items-center text-center border-r border-slate-800 cursor-pointer hover:bg-slate-800/50 rounded-l-[1.5rem] transition-all group relative"
          >
             <div className="absolute top-2 left-2 bg-indigo-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
               <Trophy size={10}/> Peringkat
             </div>
             <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mb-2 mt-2"><Scissors size={18}/></div>
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Kepala (Bulan Ini)</p>
             {isLoading ? <Loader2 size={20} className="animate-spin text-slate-600"/> : <p className="text-2xl font-black text-white">{stats.totalKepala}</p>}
          </div>
          
          <div className="flex-1 p-4 flex flex-col items-center text-center rounded-r-[1.5rem] hover:bg-slate-800/50 transition-all cursor-help">
             <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 mt-2"><DollarSign size={18}/></div>
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Est. Komisi (Bulan Ini)</p>
             {isLoading ? <Loader2 size={20} className="animate-spin text-slate-600"/> : <p className="text-sm font-black text-emerald-400 mt-1.5">{typeof stats.estimasiKomisi === 'number' ? `Rp ${stats.estimasiKomisi.toLocaleString('id-ID')}` : stats.estimasiKomisi}</p>}
          </div>
        </div>

        {/* KARTU RAPOR 7 KPI */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-sm relative overflow-hidden animate-in fade-in">
          <Award size={100} className="absolute -right-6 -top-6 text-slate-800 opacity-30" />
          
          <div className="flex flex-col mb-8 relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-400"/>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kinerja KPI</h4>
              </div>
              <span className={`text-[8px] font-bold px-2 py-1 rounded-md uppercase tracking-widest ${viewMode === 'live' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                {viewMode === 'live' ? 'Live Calc' : 'Locked'}
              </span>
            </div>

            {/* TOGGLE LIVE/HISTORY DI DALAM KARTU */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex shadow-inner">
              <button onClick={() => setViewMode('live')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${viewMode === 'live' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Activity size={12}/> {currentMonthName}</button>
              <button onClick={() => { setViewMode('history'); if (historyPeriods.length > 0 && !selectedPeriod) setSelectedPeriod(historyPeriods[0]); }} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${viewMode === 'history' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}><History size={12}/> Riwayat</button>
            </div>

            {viewMode === 'history' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                {historyPeriods.length === 0 ? (
                  <p className="text-[10px] text-center font-bold text-rose-400 mt-2">Belum ada rapor yang dicetak.</p>
                ) : (
                  <select className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-xs font-bold text-white outline-none focus:border-indigo-500" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                    {historyPeriods.map(p => <option key={p} value={p}>Rapor Bulan: {p}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6 relative z-10">
            {isLoading ? (
               <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" size={30}/></div>
            ) : (!isLoading && (viewMode === 'live' || (viewMode === 'history' && selectedPeriod))) && (
              kpiData.map((item, idx) => {
                const barWidth = item.percent > 100 ? 100 : item.percent; 
                return (
                  <div key={idx} className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/50">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">{item.label}</span>
                        <span className="text-[8px] text-slate-500 font-bold tracking-wider mt-0.5">{item.desc}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black text-${item.color}-400 leading-none`}>{item.score} <span className="text-[8px] text-slate-500">/{item.maxScore} Poin</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/50">
                        <div className={`h-full rounded-full bg-${item.color}-500 shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-1000 ease-out`} style={{ width: `${barWidth}%` }}></div>
                      </div>
                      {viewMode === 'live' && <span className="text-[9px] font-black text-slate-500 w-8 text-right">{item.percent}%</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {!isLoading && (viewMode === 'live' || (viewMode === 'history' && selectedPeriod)) && (
            <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Skor KPI</p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-white leading-none">{totalKpiScore}</span>
                  <span className="text-sm font-bold text-slate-600 mb-0.5">/ 260</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                <CheckCircle2 size={24}/>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4">
          <button onClick={onLogout} className="w-full py-4 bg-rose-900/20 border border-rose-500/30 hover:bg-rose-600 hover:text-white text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-rose-900/10">
            <LogOut size={16} /> LOGOUT DARI APLIKASI
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: EDIT PROFIL */}
      {/* ======================================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-sm rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Update Profil</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 hover:text-rose-400 transition-colors p-1"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-5">
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden mb-2">
                  {(editForm.photoPreview || profileData.photo_url) ? (
                    <img src={editForm.photoPreview || profileData.photo_url} alt="Preview" className="w-full h-full object-cover"/>
                  ) : (
                    <User size={30} className="text-slate-600"/>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white"/>
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Ketuk foto untuk ganti</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Nama Lengkap</label>
                  <input type="text" required value={editForm.nama} onChange={e => setEditForm({...editForm, nama: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-colors" placeholder="Nama Anda" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Username Login</label>
                  <input type="text" required value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-colors" placeholder="Username" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Ganti Password (Opsional)</label>
                  <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-colors" placeholder="Biarkan kosong jika tidak diganti" />
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isUpdating} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center disabled:opacity-50">
                  {isUpdating ? <Loader2 size={16} className="animate-spin" /> : "Simpan & Relogin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: LEADERBOARD KLASEMEN (UI FIX & Z-INDEX FIX) */}
      {/* ======================================================== */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-[999] flex items-end justify-center sm:items-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 bg-slate-950/50 text-center relative">
              <button onClick={() => setShowLeaderboard(false)} className="absolute right-4 top-4 text-slate-500 hover:text-white bg-slate-800 p-1.5 rounded-full"><X size={16}/></button>
              <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2"><Trophy size={24}/></div>
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Top Capster</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Klasemen Total Kepala Bulan Ini</p>
            </div>
            
            <div className="p-4 pb-8 max-h-[70vh] overflow-y-auto space-y-3">
              {isLoadingLeaderboard ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-500" size={30}/></div>
              ) : leaderboardData.length === 0 ? (
                <p className="text-center text-slate-500 text-xs py-10 font-bold">Belum ada data cukur bulan ini.</p>
              ) : (
                leaderboardData.map((capster, idx) => {
                  let badgeColor = "bg-slate-800 text-slate-400"; 
                  let icon = <span className="font-black text-sm">{idx + 1}</span>;
                  
                  if (idx === 0) { badgeColor = "bg-amber-500 text-white shadow-lg shadow-amber-500/20"; icon = <Medal size={16}/>; }
                  else if (idx === 1) { badgeColor = "bg-slate-300 text-slate-800"; icon = <Medal size={16}/>; }
                  else if (idx === 2) { badgeColor = "bg-orange-700 text-white"; icon = <Medal size={16}/>; }

                  const isMe = capster.id === user.id;

                  return (
                    <div key={capster.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${isMe ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-950/50 border-slate-800/50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${badgeColor}`}>{icon}</div>
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-slate-700 shrink-0">
                          {capster.photo_url ? <img src={capster.photo_url} alt="" className="w-full h-full object-cover"/> : <User size={20} className="text-slate-500 mx-auto mt-2"/>}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-black text-white truncate">{capster.nama} {isMe && <span className="text-[9px] text-indigo-400 ml-1 uppercase">(You)</span>}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-black text-white">{capster.totalHaircut}</span>
                        <span className="text-[8px] text-slate-500 block uppercase font-bold">Kepala</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-950">
               <button onClick={() => setShowLeaderboard(false)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">Tutup Peringkat</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}