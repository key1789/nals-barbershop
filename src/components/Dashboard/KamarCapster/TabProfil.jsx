import React, { useState, useEffect } from 'react';
import { 
  User, Award, TrendingUp, Scissors, MapPin, 
  LogOut, Star, Loader2, DollarSign, CheckCircle2, History, Activity,
  Settings, Camera, X, Trophy, Medal
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

export default function TabProfil({ user, onLogout }) {
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState('live'); 
  const [historyPeriods, setHistoryPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  const [stats, setStats] = useState({ totalOmzet: 0, estimasiKomisi: 0, totalKepala: 0, targetKepala: 200, percentProgress: 0 });
  const [kpiData, setKpiData] = useState([]);
  const [totalKpiScore, setTotalKpiScore] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState([]);
  
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

      const { data: visitsData } = await supabase.from('visits').select(`id, status_transaksi, start_service, end_service, visit_items (qty, harga_saat_ini, products_services (nama_item, durasi_menit))`).eq('capster_id', user.id).ilike('status_transaksi', 'paid').gte('created_at', startOfMonth).lte('created_at', endOfMonth);
      
      let countHaircut = 0; let countUpsell = 0; let totalOmzet = 0;
      let totalVisitAman = 0; let totalVisitDihitung = 0;

      if (visitsData) {
        visitsData.forEach(visit => {
          let totalDurasiStandar = 0;
          visit.visit_items?.forEach(item => {
            const qty = item.qty || 1; totalOmzet += (qty * (item.harga_saat_ini || 0));
            const namaItem = item.products_services?.nama_item || '';
            const durasiMenit = item.products_services?.durasi_menit || 0;

            if (namaItem.toLowerCase().includes('hair cut')) countHaircut += qty;
            else countUpsell += qty;

            totalDurasiStandar += (durasiMenit * qty);
          });

          if (visit.start_service && visit.end_service) {
            totalVisitDihitung++;
            const start = new Date(visit.start_service); const end = new Date(visit.end_service);
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
        { label: "2. Kedisiplinan (Absen & Izin)", percent: totalPelanggaranDisiplin === 0 ? 100 : (totalPelanggaranDisiplin >= 5 ? 0 : 50), score: disiplinScore, maxScore: 20, color: "red", desc: `${totalPelanggaranDisiplin} Pelanggaran` },
        { label: "3. Kelengkapan Database CRM", percent: crmPercent, score: crmScore, maxScore: 20, color: "blue", desc: `${filledCrmFields} / ${totalCrmFields} Field` },
        { label: "4. Service Duration Consistency", percent: durationPercent, score: durationScore, maxScore: 20, color: "cyan", desc: `${totalVisitAman} / ${totalVisitDihitung} Aman` },
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
          { label: "1. Productivity (Target)", percent: 100, score: report.score_productivity, maxScore: 30, color: "indigo", desc: `Data Historis` },
          { label: "2. Kedisiplinan (Absen)", percent: 100, score: report.score_kedisiplinan, maxScore: 20, color: "red", desc: `Data Historis` },
          { label: "3. Kelengkapan CRM", percent: 100, score: report.score_crm, maxScore: 20, color: "blue", desc: `Data Historis` },
          { label: "4. Service Duration", percent: 100, score: report.score_duration, maxScore: 20, color: "cyan", desc: `Data Historis` },
          { label: "5. Komplain Konsumen", percent: 100, score: report.score_komplain, maxScore: 10, color: "rose", desc: `Data Historis` },
          { label: "6. Service Upsell", percent: 100, score: report.score_upsell, maxScore: 30, color: "orange", desc: `Data Historis` },
          { label: "7. Kepatuhan SOP", percent: 100, score: report.score_logbook, maxScore: 130, color: "teal", desc: `Data Historis` }
        ]);
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  const fetchLeaderboard = async () => {
    setShowLeaderboard(true);
    setIsLoadingLeaderboard(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: capsters } = await supabase.from('users').select('id, nama, photo_url').eq('outlet_id', user.outlet_id).ilike('role', '%Capster%');
      if (!capsters) return;
      const capsterIds = capsters.map(c => c.id);

      const { data: visits } = await supabase.from('visits').select(`capster_id, visit_items(qty, products_services(nama_item))`).in('capster_id', capsterIds).ilike('status_transaksi', 'paid').gte('created_at', startOfMonth).lte('created_at', endOfMonth);

      const scores = capsters.map(c => ({ ...c, totalHaircut: 0 }));
      if (visits) {
        visits.forEach(v => {
          const cTarget = scores.find(s => s.id === v.capster_id);
          if (cTarget) {
            v.visit_items?.forEach(item => {
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
    } catch (error) { console.error("Gagal load leaderboard:", error); } 
    finally { setIsLoadingLeaderboard(false); }
  };

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
        await supabase.storage.from('avatars').upload(fileName, editForm.photoFile);
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalPhotoUrl = publicUrlData.publicUrl;
      }
      const updatePayload = { nama: editForm.nama, username: editForm.username, photo_url: finalPhotoUrl };
      if (editForm.password.trim() !== '') updatePayload.password = editForm.password;

      await supabase.from('users').update(updatePayload).eq('id', user.id);
      alert("🎉 Profil berhasil diupdate! Silakan login ulang.");
      onLogout(); 
    } catch (err) { alert("Gagal mengupdate profil."); } 
    finally { setIsUpdating(false); }
  };

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.percentProgress / 100) * circumference;
  let ringColor = "text-red-500"; 
  if (stats.percentProgress >= 80) ringColor = "text-green-500"; 
  else if (stats.percentProgress >= 50) ringColor = "text-orange-500"; 

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-28 animate-in fade-in duration-300 font-sans">
      
      {/* HEADER PROFIL - AIRBNB LIGHT MODE */}
      <div className="bg-white p-6 pb-16 rounded-b-[3rem] relative overflow-hidden shadow-sm">
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase">Profil Kinerja</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Data Capster</p>
          </div>
          <button 
            onClick={() => {
              setEditForm({ nama: profileData.nama, username: profileData.username || '', password: '', photoFile: null, photoPreview: '' });
              setShowEditModal(true);
            }}
            className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl hover:bg-gray-100 transition-all active:scale-95 text-gray-600"
          >
             <Settings size={20}/>
          </button>
        </div>

        <div className="flex items-center gap-5 relative z-10">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-100" />
              <circle 
                cx="48" cy="48" r={radius} 
                stroke="currentColor" strokeWidth="4" fill="transparent" 
                className={`${ringColor} transition-all duration-1000 ease-out`}
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
              />
            </svg>
            <div className="w-20 h-20 rounded-full bg-gray-50 overflow-hidden flex items-center justify-center border-[3px] border-white relative z-10 shadow-sm">
              {profileData.photo_url ? (
                <img src={profileData.photo_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-gray-400">{profileData.nama?.charAt(0).toUpperCase() || 'U'}</span>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-2xl font-black leading-none uppercase tracking-tight mb-2">{profileData.nama}</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-[9px] font-black bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 py-1 rounded uppercase tracking-widest shadow-sm">{user?.role}</span>
              <span className="text-[9px] font-black bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded uppercase tracking-widest flex items-center gap-1"><MapPin size={10}/> {user?.hk_area_pic || 'No Area'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-8 space-y-6 relative z-20">
        
        {/* KARTU STATISTIK */}
        <div className="bg-white p-1.5 rounded-[2.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex">
          <div 
            onClick={fetchLeaderboard}
            className="flex-1 p-5 flex flex-col items-center text-center border-r border-gray-100 cursor-pointer hover:bg-gray-50 rounded-l-[2.5rem] transition-all group relative"
          >
             <div className="absolute top-3 left-3 bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-bold px-2 py-1 rounded-md flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
               <Trophy size={10}/> Peringkat
             </div>
             <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-500 border border-orange-100 flex items-center justify-center mb-3 mt-4 shadow-sm"><Scissors size={20}/></div>
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Total Kepala (Bulan Ini)</p>
             {isLoading ? <Loader2 size={24} className="animate-spin text-gray-400"/> : <p className="text-3xl font-black text-gray-900 tracking-tighter">{stats.totalKepala}</p>}
          </div>
          
          <div className="flex-1 p-5 flex flex-col items-center text-center rounded-r-[2.5rem] hover:bg-gray-50 transition-all cursor-help">
             <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 border border-green-100 flex items-center justify-center mb-3 mt-4 shadow-sm"><DollarSign size={20}/></div>
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Est. Komisi (Bulan Ini)</p>
             {isLoading ? <Loader2 size={24} className="animate-spin text-gray-400"/> : <p className="text-sm font-black text-green-600 mt-2">{typeof stats.estimasiKomisi === 'number' ? `Rp ${stats.estimasiKomisi.toLocaleString('id-ID')}` : stats.estimasiKomisi}</p>}
          </div>
        </div>

        {/* KARTU RAPOR 7 KPI */}
        <div className="bg-white border border-gray-100 p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden animate-in fade-in">
          <Award size={120} className="absolute -right-8 -top-8 text-gray-50 opacity-50" />
          
          <div className="flex flex-col mb-8 relative z-10 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-indigo-600"/>
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Raport KPI Capster</h4>
              </div>
              <span className={`text-[9px] font-bold px-3 py-1 rounded-md uppercase tracking-widest border ${viewMode === 'live' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                {viewMode === 'live' ? 'Live Calc' : 'Locked'}
              </span>
            </div>

            <div className="bg-gray-50 p-1.5 rounded-2xl border border-gray-200 flex shadow-sm">
              <button onClick={() => setViewMode('live')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${viewMode === 'live' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}><Activity size={14}/> {currentMonthName}</button>
              <button onClick={() => { setViewMode('history'); if (historyPeriods.length > 0 && !selectedPeriod) setSelectedPeriod(historyPeriods[0]); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${viewMode === 'history' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}><History size={14}/> Riwayat</button>
            </div>

            {viewMode === 'history' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                {historyPeriods.length === 0 ? (
                  <p className="text-[10px] text-center font-bold text-red-500 mt-2">Belum ada rapor yang dicetak.</p>
                ) : (
                  <select className="w-full bg-gray-50 border border-gray-200 p-3.5 rounded-xl text-xs font-bold text-gray-900 outline-none focus:border-indigo-400" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                    {historyPeriods.map(p => <option key={p} value={p}>Rapor Bulan: {p}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 relative z-10">
            {isLoading ? (
               <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" size={30}/></div>
            ) : (!isLoading && (viewMode === 'live' || (viewMode === 'history' && selectedPeriod))) && (
              kpiData.map((item, idx) => {
                const barWidth = item.percent > 100 ? 100 : item.percent; 
                return (
                  <div key={idx} className="bg-gray-50 p-4 rounded-[1.5rem] border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex justify-between items-end mb-2.5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{item.label}</span>
                        <span className="text-[9px] text-gray-500 font-bold tracking-widest mt-1">{item.desc}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black text-${item.color}-600 leading-none`}>{item.score} <span className="text-[9px] text-gray-400">/{item.maxScore}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full rounded-full bg-${item.color}-500 transition-all duration-1000 ease-out`} style={{ width: `${barWidth}%` }}></div>
                      </div>
                      {viewMode === 'live' && <span className="text-[10px] font-black text-gray-500 w-8 text-right">{item.percent}%</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {!isLoading && (viewMode === 'live' || (viewMode === 'history' && selectedPeriod)) && (
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Skor KPI</p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-gray-900 leading-none tracking-tighter">{totalKpiScore}</span>
                  <span className="text-sm font-bold text-gray-400 mb-0.5">/ 260</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shadow-sm">
                <CheckCircle2 size={28} strokeWidth={2}/>
              </div>
            </div>
          )}
        </div>

        <div className="pt-2">
          <button onClick={onLogout} className="w-full py-4 bg-red-50 border border-red-100 hover:bg-red-500 hover:text-white text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
            <LogOut size={16} /> LOGOUT DARI APLIKASI
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: EDIT PROFIL */}
      {/* ======================================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 pb-8 sm:pb-0">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Update Profil</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-900 transition-colors bg-gray-100 rounded-full p-1.5"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24 rounded-full bg-gray-50 border-2 border-gray-200 flex items-center justify-center overflow-hidden mb-3 shadow-inner">
                  {(editForm.photoPreview || profileData.photo_url) ? (
                    <img src={editForm.photoPreview || profileData.photo_url} alt="Preview" className="w-full h-full object-cover"/>
                  ) : (
                    <User size={32} className="text-gray-300"/>
                  )}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white"/>
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ketuk foto untuk ganti</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-1">Nama Lengkap</label>
                  <input type="text" required value={editForm.nama} onChange={e => setEditForm({...editForm, nama: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-bold text-gray-900 outline-none focus:border-indigo-400 focus:bg-white transition-colors" placeholder="Nama Anda" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-1">Username Login</label>
                  <input type="text" required value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-bold text-gray-900 outline-none focus:border-indigo-400 focus:bg-white transition-colors" placeholder="Username" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-1">Ganti Password (Opsional)</label>
                  <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-bold text-gray-900 outline-none focus:border-indigo-400 focus:bg-white transition-colors" placeholder="Kosongkan jika tidak ganti" />
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isUpdating} className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center disabled:opacity-50 shadow-lg">
                  {isUpdating ? <Loader2 size={16} className="animate-spin" /> : "Simpan & Relogin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: LEADERBOARD KLASEMEN */}
      {/* ======================================================== */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-[999] flex items-end justify-center sm:items-center bg-gray-900/60 backdrop-blur-sm animate-in fade-in pb-10 sm:pb-0">
          <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 text-center relative">
              <button onClick={() => setShowLeaderboard(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-900 bg-white border border-gray-200 p-2 rounded-full shadow-sm transition-colors"><X size={16}/></button>
              <div className="w-14 h-14 bg-amber-50 text-amber-500 border border-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm"><Trophy size={28}/></div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Top Capster</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Klasemen Bulan Ini</p>
            </div>
            
            <div className="p-5 pb-8 max-h-[60vh] overflow-y-auto space-y-4">
              {isLoadingLeaderboard ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-500" size={30}/></div>
              ) : leaderboardData.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-10 font-bold uppercase tracking-widest">Belum ada data cukur.</p>
              ) : (
                leaderboardData.map((capster, idx) => {
                  let badgeColor = "bg-gray-100 text-gray-500"; 
                  let icon = <span className="font-black text-sm">{idx + 1}</span>;
                  
                  if (idx === 0) { badgeColor = "bg-amber-100 text-amber-600 border border-amber-200"; icon = <Medal size={18}/>; }
                  else if (idx === 1) { badgeColor = "bg-gray-200 text-gray-600"; icon = <Medal size={18}/>; }
                  else if (idx === 2) { badgeColor = "bg-orange-100 text-orange-600"; icon = <Medal size={18}/>; }

                  const isMe = capster.id === user.id;

                  return (
                    <div key={capster.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${isMe ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-gray-100'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${badgeColor}`}>{icon}</div>
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-gray-50 overflow-hidden border border-gray-200 shrink-0">
                          {capster.photo_url ? <img src={capster.photo_url} alt="" className="w-full h-full object-cover"/> : <User size={24} className="text-gray-300 mx-auto mt-2.5"/>}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-black text-gray-900 truncate">{capster.nama}</p>
                          {isMe && <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mt-0.5">Anda</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm">
                        <span className="text-xl font-black text-gray-900 block leading-none">{capster.totalHaircut}</span>
                        <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mt-1 block">Kepala</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            
            <div className="p-5 border-t border-gray-100 bg-white">
               <button onClick={() => setShowLeaderboard(false)} className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Tutup Peringkat</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}