import React, { useState, useEffect } from 'react';
import { 
  User, LogOut, Loader2, Award, Target, TrendingUp, AlertCircle, 
  CalendarCheck, BookOpen, Users, Receipt, MessageSquare, Phone,
  Settings, Camera, X, Star, History, Activity
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

export default function TabProfilFO({ user, onLogout }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // --- STATE HISTORY (SUNTIKAN DARI CAPSTER) ---
  const [viewMode, setViewMode] = useState('live'); 
  const [historyPeriods, setHistoryPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');

  // Data State Profil
  const [profileData, setProfileData] = useState({ nama: user.nama, username: user.username || '', photo_url: user.photo_url || '' });
  const [editForm, setEditForm] = useState({ nama: '', username: '', password: '', photoFile: null, photoPreview: '' });

  // Data State KPI
  const [hariMasuk, setHariMasuk] = useState(0);
  const [kpiScoreData, setKpiScoreData] = useState({
    rcr: { pct: 0, poin: 0 },
    disiplin: { pelanggaran: 0, poin: 0 },
    membership: { pct: 0, poin: 0 },
    selisihKas: { totalSelisih: 0, poin: 0 },
    errorTrx: { totalError: 0, poin: 0 },
    sop: { pct: 0, poin: 0 },
    komplain: { total: 0, poin: 0 },
    reminder: { pct: 0, poin: 0 }
  });

  const currentDate = new Date();
  const currentMonthName = currentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  const periodeBulanLive = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  // Ambil list history periode saat pertama load
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: historyData } = await supabase.from('kpi_monthly_reports').select('periode_bulan').eq('user_id', user.id).order('periode_bulan', { ascending: false });
      if (historyData) setHistoryPeriods(historyData.map(d => d.periode_bulan));

      const { data: uData } = await supabase.from('users').select('nama, username, photo_url').eq('id', user.id).single();
      if (uData) setProfileData(uData);
    };
    fetchInitialData();
  }, [user.id]);

  // Trigger fetch berdasarkan mode (Live atau History)
  useEffect(() => {
    if (viewMode === 'live') fetchRaportData();
    else if (viewMode === 'history' && selectedPeriod) fetchHistoryKPI(selectedPeriod);
  }, [viewMode, selectedPeriod, user.id]);

  // ==========================================
  // FUNGSI 1: HITUNG DATA LIVE (8 KPI FO)
  // ==========================================
  const fetchRaportData = async () => {
    setIsLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const startOnly = startOfMonth.split('T')[0];
      const endOnly = endOfMonth.split('T')[0];

      // 1. Absensi
      const { data: logs } = await supabase.from('attendance_logs').select('status_kehadiran').eq('user_id', user.id).gte('tanggal', startOnly).lte('tanggal', endOnly);
      let totalPelanggaran = logs?.filter(l => l.status_kehadiran === 'Telat' || l.status_kehadiran === 'Alfa').length || 0;
      setHariMasuk(logs?.length || 0);

      // 2. RCR & Error (Void)
      const { data: visits } = await supabase.from('visits').select(`status_transaksi, visit_items(products_services(kategori))`).eq('outlet_id', user.outlet_id).gte('created_at', startOfMonth).lte('created_at', endOfMonth);
      let totalStruk = 0, strukGrooming = 0, totalVoid = 0;
      visits?.forEach(v => {
        if (v.status_transaksi?.toLowerCase() === 'void') totalVoid++;
        else if (v.status_transaksi?.toLowerCase() === 'paid') {
          totalStruk++;
          if (v.visit_items?.some(item => item.products_services?.kategori?.toLowerCase().includes('produk'))) strukGrooming++;
        }
      });
      const rcrPct = totalStruk === 0 ? 0 : Math.round((strukGrooming / totalStruk) * 100);

      // 3. Membership
      const { data: customers } = await supabase.from('customers').select('*').eq('created_by', user.id).gte('tanggal_daftar', startOnly).lte('tanggal_daftar', endOnly);
      let memberPct = 0;
      if (customers?.length > 0) {
        let fields = 0;
        customers.forEach(c => {
          if (c.nama) fields++; if (c.no_wa) fields++; if (c.alamat) fields++; if (c.tanggal_lahir) fields++;
          if (c.estimasi_repeat) fields++; if (c.inisial_panggilan) fields++; if (c.tier) fields++;
        });
        memberPct = Math.round((fields / (customers.length * 7)) * 100);
      }

      // 4. Selisih Kas
      const { data: closings } = await supabase.from('shift_closings').select('selisih').eq('fo_id', user.id).gte('created_at', startOfMonth).lte('created_at', endOfMonth);
      let selisih = 0;
      closings?.forEach(c => selisih += Math.abs(parseFloat(c.selisih) || 0));

      // 5. Reminder
      const { data: reminders } = await supabase.from('reminder_logs').select('status').eq('fo_id', user.id).gte('due_date', startOnly).lte('due_date', endOnly);
      const reminderPct = reminders?.length === 0 ? 0 : Math.round((reminders.filter(r => r.status === 'Sent').length / reminders.length) * 100);

      // Mapping Poin
      const calcRcr = (p) => p >= 12 ? 20 : p >= 8 ? 16 : p >= 4 ? 8 : 0;
      const calcDisiplin = (p) => p === 0 ? 13 : p <= 2 ? 10 : 7;
      const calcMember = (p) => p === 100 ? 13 : p >= 90 ? 10 : 7;
      const calcSelisih = (s) => s === 0 ? 13 : s <= 10000 ? 10 : 7;
      const calcError = (e) => e === 0 ? 13 : e <= 2 ? 10 : 7;
      const calcReminder = (p) => p >= 90 ? 7 : p >= 70 ? 5 : 0;

      setKpiScoreData({
        rcr: { pct: rcrPct, poin: calcRcr(rcrPct) },
        disiplin: { pelanggaran: totalPelanggaran, poin: calcDisiplin(totalPelanggaran) },
        membership: { pct: memberPct, poin: calcMember(memberPct) },
        selisihKas: { totalSelisih: selisih, poin: calcSelisih(selisih) },
        errorTrx: { totalError: totalVoid, poin: calcError(totalVoid) },
        sop: { pct: 100, poin: 13 },
        komplain: { total: 0, poin: 8 },
        reminder: { pct: reminderPct, poin: calcReminder(reminderPct) }
      });
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  // ==========================================
  // FUNGSI 2: AMBIL DATA HISTORY (DARI DATABASE)
  // ==========================================
  const fetchHistoryKPI = async (period) => {
    setIsLoading(true);
    try {
      const { data: report } = await supabase.from('kpi_monthly_reports').select('*').eq('user_id', user.id).eq('periode_bulan', period).single();
      if (report) {
        // Kita petakan data history ke format 8 KPI FO
        // Karena tabel report mungkin didesain umum, kita tampilkan totalnya
        setKpiScoreData({
          rcr: { pct: 0, poin: report.score_upsell || 0 }, // RCR dipetakan ke upsell di history
          disiplin: { pelanggaran: 0, poin: report.score_kedisiplinan || 0 },
          membership: { pct: 0, poin: report.score_crm || 0 },
          selisihKas: { totalSelisih: 0, poin: report.score_error || 0 }, // Misal error kas masuk sini
          errorTrx: { totalError: 0, poin: report.score_duration || 0 },
          sop: { pct: 100, poin: report.score_logbook || 0 },
          komplain: { total: 0, poin: report.score_komplain || 0 },
          reminder: { pct: 0, poin: report.total_score > 100 ? 7 : 0 } // Logika dummy history
        });
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
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
      await supabase.from('users').update({ nama: editForm.nama, username: editForm.username, photo_url: finalPhotoUrl }).eq('id', user.id);
      alert("Profil diupdate!"); onLogout();
    } catch (err) { alert("Gagal update!"); } finally { setIsUpdating(false); }
  };

  const totalPoinAkhir = kpiScoreData.rcr.poin + kpiScoreData.disiplin.poin + kpiScoreData.membership.poin + kpiScoreData.selisihKas.poin + kpiScoreData.errorTrx.poin + kpiScoreData.sop.poin + kpiScoreData.komplain.poin + kpiScoreData.reminder.poin;

  // Progress Ring logic
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(totalPoinAkhir, 100) / 100) * circumference;
  let ringColor = totalPoinAkhir >= 80 ? "text-emerald-500" : totalPoinAkhir >= 50 ? "text-amber-400" : "text-rose-500";

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 animate-in fade-in duration-300">
      
      {/* HEADER PROFIL - CLEAN VERSION */}
      <div className="bg-indigo-600 p-6 pb-20 rounded-b-[3rem] text-white relative overflow-hidden shadow-lg shadow-indigo-900/20">
        <Star size={120} className="absolute -right-10 -bottom-10 text-white opacity-10 rotate-12" />
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <h2 className="text-2xl font-black tracking-tighter italic uppercase">Profil Kinerja</h2>
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">Data Real-time</p>
          </div>
          <button onClick={() => {
              setEditForm({ nama: profileData.nama, username: profileData.username || '', password: '', photoFile: null, photoPreview: '' });
              setShowEditModal(true);
            }} className="bg-white/20 backdrop-blur-sm p-2 rounded-xl hover:bg-white/30 transition-all active:scale-95">
            <Settings size={20}/>
          </button>
        </div>

        <div className="flex items-center gap-5 relative z-10">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-indigo-400/30" />
              <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="4" fill="transparent" className={`${ringColor} transition-all duration-1000`} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
            </svg>
            <div className="w-20 h-20 rounded-full bg-slate-900 overflow-hidden flex items-center justify-center border-4 border-slate-900 relative z-10 shadow-xl">
              {profileData.photo_url ? <img src={profileData.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl font-black text-white">{profileData.nama?.charAt(0).toUpperCase()}</span>}
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black leading-none uppercase tracking-tight mb-2">{profileData.nama}</h3>
            <span className="text-[10px] font-black bg-white text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">Front Office</span>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-10 relative z-20 space-y-4">
        
        {/* KEHADIRAN */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-[1.5rem] flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><CalendarCheck size={18}/></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hari Masuk</p>
              <p className="text-sm font-bold text-white italic">Bulan Ini</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-400 leading-none">{hariMasuk}</span>
            <span className="text-xs font-bold text-slate-500 ml-1">Hari</span>
          </div>
        </div>

        {/* RAPORT KPI DENGAN TOGGLE HISTORY (VERSI CAPSTER) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-[2rem] shadow-xl">
          <div className="flex flex-col mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-amber-400"/>
                <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">Raport KPI FO</h3>
              </div>
              <span className={`text-[8px] font-bold px-2 py-1 rounded-md uppercase tracking-widest ${viewMode === 'live' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                {viewMode === 'live' ? 'Live' : 'Rekap'}
              </span>
            </div>

            {/* TAB TOGGLE LIVE/HISTORY */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex shadow-inner">
              <button onClick={() => setViewMode('live')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${viewMode === 'live' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                <Activity size={12}/> {currentMonthName}
              </button>
              <button onClick={() => { setViewMode('history'); if (historyPeriods.length > 0 && !selectedPeriod) setSelectedPeriod(historyPeriods[0]); }} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${viewMode === 'history' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
                <History size={12}/> Riwayat
              </button>
            </div>

            {viewMode === 'history' && (
              <select className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-xs font-bold text-white outline-none focus:border-indigo-500" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                <option value="">Pilih Bulan...</option>
                {historyPeriods.map(p => <option key={p} value={p}>Bulan: {p}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-5">
            <KpiRow icon={<Receipt/>} title="1. Retail Conversion Rate (RCR)" value={`${kpiScoreData.rcr.pct}%`} target="12%" poin={kpiScoreData.rcr.poin} maxPoin={20} pct={Math.min((kpiScoreData.rcr.pct/12)*100, 100)} color="bg-blue-500" />
            <KpiRow icon={<AlertCircle/>} title="2. Kedisiplinan" value={`${kpiScoreData.disiplin.pelanggaran} Kali`} target="0" poin={kpiScoreData.disiplin.poin} maxPoin={13} pct={kpiScoreData.disiplin.pelanggaran === 0 ? 100 : 50} color="bg-rose-500" />
            <KpiRow icon={<Users/>} title="3. Membership Completion" value={`${kpiScoreData.membership.pct}%`} target="100%" poin={kpiScoreData.membership.poin} maxPoin={13} pct={kpiScoreData.membership.pct} color="bg-purple-500" />
            <KpiRow icon={<TrendingUp/>} title="4. Cash Balance Accuracy" value={`Selisih ${kpiScoreData.selisihKas.totalSelisih/1000}K`} target="Rp 0" poin={kpiScoreData.selisihKas.poin} maxPoin={13} pct={kpiScoreData.selisihKas.totalSelisih === 0 ? 100 : 50} color="bg-emerald-500" />
            <KpiRow icon={<Target/>} title="5. Error Transaksi" value={`${kpiScoreData.errorTrx.totalError} Void`} target="0" poin={kpiScoreData.errorTrx.poin} maxPoin={13} pct={kpiScoreData.errorTrx.totalError === 0 ? 100 : 50} color="bg-orange-500" />
            <KpiRow icon={<BookOpen/>} title="6. Logbook" value={`${kpiScoreData.sop.pct}%`} target="100%" poin={kpiScoreData.sop.poin} maxPoin={13} pct={kpiScoreData.sop.pct} color="bg-teal-500" />
            <KpiRow icon={<MessageSquare/>} title="7. Komplain Valid" value={`${kpiScoreData.komplain.total} Valid`} target="0" poin={kpiScoreData.komplain.poin} maxPoin={8} pct={kpiScoreData.komplain.total === 0 ? 100 : 50} color="bg-rose-500" />
            <KpiRow icon={<Phone/>} title="8. Reminder Konsumen (Follow-up)" value={`${kpiScoreData.reminder.pct}%`} target="90%" poin={kpiScoreData.reminder.poin} maxPoin={7} pct={kpiScoreData.reminder.pct} color="bg-indigo-500" />
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800 flex justify-between items-end">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Poin Bulanan</p>
              <h4 className="text-3xl font-black text-white leading-none">{totalPoinAkhir} <span className="text-sm text-slate-500">/ 100</span></h4>
            </div>
            <div className={`px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest ${totalPoinAkhir >= 80 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : totalPoinAkhir >= 60 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
               {totalPoinAkhir >= 80 ? 'Excellent' : totalPoinAkhir >= 60 ? 'Good Job' : 'Need Review'}
            </div>
          </div>
        </div>

        <button onClick={onLogout} className="w-full py-4 bg-rose-900/20 border border-rose-500/30 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
          <LogOut size={16} /> LOGOUT APLIKASI
        </button>
      </div>

      {/* MODAL EDIT PROFIL */}
      {showEditModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-sm rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Update Profil</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 hover:text-rose-400 transition-colors p-1"><X size={20}/></button>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-5">
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden mb-2">
                  {(editForm.photoPreview || profileData.photo_url) ? <img src={editForm.photoPreview || profileData.photo_url} alt="" className="w-full h-full object-cover"/> : <User size={30} className="text-slate-600 m-auto mt-6"/>}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Ketuk foto untuk ganti</p>
              </div>
              <div className="space-y-4">
                <input type="text" required value={editForm.nama} onChange={e => setEditForm({...editForm, nama: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none" placeholder="Nama Lengkap" />
                <input type="text" required value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none" placeholder="Username" />
                <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none" placeholder="Password Baru (Opsional)" />
              </div>
              <button type="submit" disabled={isUpdating} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50">
                {isUpdating ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Simpan & Relogin"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiRow({ icon, title, value, target, poin, maxPoin, pct, color }) {
  return (
    <div className="w-full">
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex gap-2.5 items-center min-w-0">
          <div className="w-7 h-7 shrink-0 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-400">
             {React.cloneElement(icon, { size: 12 })}
          </div>
          <div className="truncate">
            <p className="text-[10px] font-black text-slate-200 uppercase tracking-wide leading-none mb-0.5 truncate">{title}</p>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{value} <span className="text-slate-700">/</span> Target {target}</p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <span className="text-xs font-black text-white">{poin}</span>
          <span className="text-[8px] text-slate-500 font-bold ml-0.5">/ {maxPoin}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 shrink-0"></div>
        <div className="flex-1 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
          <div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
        </div>
      </div>
    </div>
  );
}