import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Lock, Unlock, AlertTriangle, Loader2, X, FileText, 
  Award, Wallet, Plus, Trash2, MessageSquare, DollarSign
} from 'lucide-react';
import { supabase } from '../../../../supabaseClient'; 

export default function TabRekapKPI({ outletId }) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`);
  
  const [staffList, setStaffList] = useState([]);
  const [kpiReports, setKpiReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // === STATE MODAL ===
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('kpi');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // === STATE DATA ===
  const [inputManual, setInputManual] = useState({ alfa: 0, komplain: 0 });
  const [rawStats, setRawStats] = useState({});
  const [bonusManual, setBonusManual] = useState(0);
  const [catatanManager, setCatatanManager] = useState('');
  const [deductions, setDeductions] = useState([{ id: Date.now(), keterangan: '', nominal: 0 }]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: users } = await supabase.from('users').select('*').in('role', ['Capster', 'FO']).eq('is_active', true);
      const { data: reports } = await supabase.from('kpi_monthly_reports').select('user_id, total_score, is_locked').eq('periode_bulan', selectedMonth);
      setStaffList(users || []);
      setKpiReports(reports || []);
    } catch (err) { console.error(err); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchDashboardData(); }, [selectedMonth]);

  const handleBukaRapor = async (user) => {
    setSelectedUser(user);
    setActiveModalTab('kpi');
    setInputManual({ alfa: 0, komplain: 0 });
    setBonusManual(0);
    setCatatanManager('');
    setDeductions([{ id: Date.now(), keterangan: '', nominal: 0 }]);
    setIsModalOpen(true);
    setIsCalculating(true);

    try {
      const startOfMonth = `${selectedMonth}-01T00:00:00.000Z`;
      const endOfMonth = new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0, 23, 59, 59).toISOString();
      const startOnly = startOfMonth.split('T')[0];
      const endOnly = endOfMonth.split('T')[0];

      const { data: absen } = await supabase.from('attendance_logs').select('menit_terlambat').eq('user_id', user.id).gte('tanggal', startOnly).lte('tanggal', endOnly);
      const totalTelat = absen ? absen.filter(a => a.menit_terlambat > (user.toleransi_telat_absen_menit || 10)).length : 0;
      let totalHariKerja = absen ? absen.length : 1; 

      const { data: visits } = await supabase.from('visits').select(`status_transaksi, start_service, end_service, visit_items(qty, harga_saat_ini, products_services(nama_item, kategori, durasi_menit))`).or(`capster_id.eq.${user.id},fo_id.eq.${user.id}`).gte('created_at', startOfMonth).lte('created_at', endOfMonth);
      
      let countKepala = 0, countUpsell = 0, totalStrukFO = 0, strukGroomingFO = 0, errorVoid = 0, visitSesuaiDurasi = 0, totalVisitDiukur = 0;
      let totalOmzetLayanan = 0; 
      
      visits?.forEach(v => {
        if (v.status_transaksi?.toLowerCase() === 'void') errorVoid++;
        if (v.status_transaksi?.toLowerCase() === 'paid') {
          totalStrukFO++;
          let isGrooming = false;
          let durasiStandar = 0;

          v.visit_items?.forEach(item => {
            const qty = item.qty || 1;
            const nama = item.products_services?.nama_item?.toLowerCase() || '';
            const kat = item.products_services?.kategori?.toLowerCase() || '';
            const harga = item.harga_saat_ini || 0;
            
            if (nama.includes('hair cut')) countKepala += qty;
            else countUpsell += qty;
            if (kat.includes('grooming')) isGrooming = true;
            durasiStandar += (item.products_services?.durasi_menit || 0) * qty;
            if (user.role === 'Capster') totalOmzetLayanan += (qty * harga);
          });

          if (isGrooming) strukGroomingFO++;
          if (v.start_service && v.end_service) {
            totalVisitDiukur++;
            const actualMin = (new Date(v.end_service) - new Date(v.start_service)) / 60000;
            const tol = user.toleransi_durasi_layanan_menit || 15;
            if (actualMin >= (durasiStandar - tol) && actualMin <= (durasiStandar + tol)) visitSesuaiDurasi++;
          }
        }
      });

      const { data: dLogs } = await supabase.from('daily_duty_logs').select('id').eq('user_id', user.id).gte('tanggal', startOnly).lte('tanggal', endOnly);
      const { data: hLogs } = await supabase.from('housekeeping_logs').select('id').eq('user_id', user.id).gte('tanggal', startOnly).lte('tanggal', endOnly);
      
      let totalTugasHk = 0;
      if (user.hk_area_pic) {
        const { count } = await supabase.from('housekeeping_sops').select('id', { count: 'exact', head: true }).ilike('area', user.hk_area_pic);
        totalTugasHk = count || 0;
      }
      
      const targetLaporanHarian = 2 + totalTugasHk;
      const totalTargetLaporanBulanan = totalHariKerja * targetLaporanHarian;
      const totalLaporanTerkirim = (dLogs?.length || 0) + (hLogs?.length || 0);
      const logbookPct = totalTargetLaporanBulanan === 0 ? 0 : (totalLaporanTerkirim / totalTargetLaporanBulanan) * 200;

      let crmPct = 0;
      if (user.role === 'Capster') {
        const { data: notes } = await supabase.from('service_notes').select('*, visits!inner(capster_id)').eq('visits.capster_id', user.id).gte('created_at', startOfMonth).lte('created_at', endOfMonth);
        const totalFields = (notes?.length || 0) * 8;
        let filled = 0;
        notes?.forEach(n => { if(n.final_style) filled++; if(n.kondisi_rambut) filled++; if(n.rekomendasi_produk) filled++; if(n.catatan_obrolan) filled++; if(n.foto_depan) filled++; if(n.foto_belakang) filled++; if(n.foto_kanan) filled++; if(n.foto_kiri) filled++; });
        crmPct = totalFields === 0 ? 0 : (filled / totalFields) * 100;
      } else {
        const { data: custs } = await supabase.from('customers').select('*').eq('created_by', user.id).gte('tanggal_daftar', startOnly).lte('tanggal_daftar', endOnly);
        const totalFields = (custs?.length || 0) * 7;
        let filled = 0;
        custs?.forEach(c => { if(c.nama) filled++; if(c.no_wa) filled++; if(c.alamat) filled++; if(c.tanggal_lahir) filled++; if(c.estimasi_repeat) filled++; if(c.inisial_panggilan) filled++; if(c.tier) filled++; });
        crmPct = totalFields === 0 ? 0 : (filled / totalFields) * 100;
      }

      setRawStats({
        telat: totalTelat, kepala: countKepala, upsell: countUpsell, strukTotal: totalStrukFO, strukRetail: strukGroomingFO, void: errorVoid,
        durasiAman: visitSesuaiDurasi, durasiTotal: totalVisitDiukur, crmPct: crmPct, logbookPct: Math.min(logbookPct, 200),
        omzetLayanan: totalOmzetLayanan 
      });

    } catch (err) { console.error(err); } 
    finally { setIsCalculating(false); }
  };

  const calculateFinalScores = () => {
    if (!selectedUser || Object.keys(rawStats).length === 0) return {};
    const totalPelanggaran = rawStats.telat + Number(inputManual.alfa);
    const totalKomplain = Number(inputManual.komplain);

    const skorDisiplin = totalPelanggaran === 0 ? 13 : totalPelanggaran <= 2 ? 10 : totalPelanggaran <= 4 ? 7 : 0;
    const lb = rawStats.logbookPct;
    const skorLogbook = lb >= 200 ? 13 : lb >= 180 ? 10 : lb >= 170 ? 7 : lb >= 150 ? 4 : 0;

    if (selectedUser.role === 'Capster') {
      const prodPct = (rawStats.kepala / (selectedUser.target_kepala_bulanan || 200)) * 100;
      const skorProd = prodPct >= 120 ? 20 : prodPct >= 100 ? 17 : prodPct >= 80 ? 10 : 0;
      const skorCrm = rawStats.crmPct >= 100 ? 12 : rawStats.crmPct >= 90 ? 9 : 0;
      const durPct = (rawStats.durasiAman / (rawStats.durasiTotal || 1)) * 100;
      const skorDur = durPct >= 90 ? 12 : durPct >= 80 ? 9 : 0;
      const upPct = (rawStats.upsell / (rawStats.kepala || 1)) * 100;
      const skorUpsell = upPct >= 12 ? 20 : upPct >= 8 ? 16 : 0;
      const skorKomplain = totalKomplain === 0 ? 10 : totalKomplain <= 2 ? 5 : 0;
      const total = skorProd + skorDisiplin + skorCrm + skorDur + skorUpsell + skorLogbook + skorKomplain;
      return { prod: skorProd, disiplin: skorDisiplin, crm: skorCrm, dur: skorDur, upsell: skorUpsell, logbook: skorLogbook, komplain: skorKomplain, total };
    } else {
      const rcrPct = (rawStats.strukRetail / (rawStats.strukTotal || 1)) * 100;
      const skorRcr = rcrPct >= 12 ? 20 : rcrPct >= 8 ? 16 : 0;
      const skorCrm = rawStats.crmPct >= 100 ? 13 : rawStats.crmPct >= 90 ? 10 : 7;
      const skorError = rawStats.void === 0 ? 13 : rawStats.void <= 2 ? 10 : 7;
      const skorKomplain = totalKomplain === 0 ? 8 : totalKomplain <= 2 ? 4 : 0;
      const total = skorRcr + skorDisiplin + skorCrm + skorError + skorLogbook + skorKomplain;
      return { prod: skorRcr, disiplin: skorDisiplin, crm: skorCrm, dur: skorError, logbook: skorLogbook, komplain: skorKomplain, total };
    }
  };
  const finalScores = calculateFinalScores();

  const calculateSalary = () => {
    if (!selectedUser) return { gapok: 0, komisi: 0, bonus: 0, potongan: 0, thp: 0 };
    let gapok = 0, komisi = 0, bonus = Number(bonusManual) || 0;
    
    if (selectedUser.role === 'Capster') {
        const persen = Number(selectedUser.gaji_pokok) || 0; 
        komisi = (rawStats.omzetLayanan || 0) * (persen / 100);
    } else {
        gapok = Number(selectedUser.gaji_pokok) || 0; 
    }
    const totalPotongan = deductions.reduce((sum, d) => sum + (Number(d.nominal) || 0), 0);
    const thp = gapok + komisi + bonus - totalPotongan;
    return { gapok, komisi, bonus, potongan: totalPotongan, thp };
  };
  const payroll = calculateSalary();

  const handleTutupBuku = async () => {
    if (!window.confirm(`Yakin KUNCI RAPOR & CETAK GAJI untuk ${selectedUser.nama}? Data tidak bisa diubah lagi.`)) return;
    setIsSaving(true);
    
    try {
      const payloadKpi = {
        user_id: selectedUser.id, periode_bulan: selectedMonth, target_kepala: selectedUser.target_kepala_bulanan || 0,
        toleransi_waktu_menit: selectedUser.toleransi_durasi_layanan_menit || 0, toleransi_telat_menit: selectedUser.toleransi_telat_absen_menit || 0,
        jumlah_alfa: Number(inputManual.alfa), jumlah_komplain: Number(inputManual.komplain),
        score_productivity: finalScores.prod || 0, score_crm: finalScores.crm || 0, score_duration: finalScores.dur || 0,
        score_upsell: finalScores.upsell || 0, score_logbook: finalScores.logbook || 0, score_kedisiplinan: finalScores.disiplin || 0,
        score_komplain: finalScores.komplain || 0, total_score: finalScores.total || 0, is_locked: true
      };
      const { data: kpiData, error: kpiErr } = await supabase.from('kpi_monthly_reports').upsert([payloadKpi], { onConflict: 'user_id, periode_bulan' }).select().single();
      if (kpiErr) throw kpiErr;

      const payloadSalary = {
        user_id: selectedUser.id, kpi_report_id: kpiData.id, periode_bulan: selectedMonth,
        omzet_layanan: rawStats.omzetLayanan || 0, persentase_komisi: selectedUser.role === 'Capster' ? Number(selectedUser.gaji_pokok) : 0,
        nominal_komisi: payroll.komisi, nominal_gapok: payroll.gapok, nominal_bonus: payroll.bonus,
        total_bruto: payroll.gapok + payroll.komisi + payroll.bonus, total_potongan: payroll.potongan,
        take_home_pay: payroll.thp, catatan_manager: catatanManager
      };
      const { data: salaryData, error: salErr } = await supabase.from('salary_logs').insert([payloadSalary]).select().single();
      if (salErr) throw salErr;

      const validDeductions = deductions.filter(d => d.keterangan.trim() !== '' && Number(d.nominal) > 0);
      if (validDeductions.length > 0) {
        const payloadDeductions = validDeductions.map(d => ({ salary_log_id: salaryData.id, keterangan: d.keterangan, nominal: Number(d.nominal) }));
        const { error: dedErr } = await supabase.from('salary_deductions').insert(payloadDeductions);
        if (dedErr) throw dedErr;
      }

      setIsModalOpen(false);
      fetchDashboardData();
    } catch (err) { alert("Gagal Simpan: " + err.message); } 
    finally { setIsSaving(false); }
  };

  const addDeduction = () => setDeductions([...deductions, { id: Date.now(), keterangan: '', nominal: 0 }]);
  const removeDeduction = (id) => setDeductions(deductions.filter(d => d.id !== id));
  const updateDeduction = (id, field, value) => setDeductions(deductions.map(d => d.id === id ? { ...d, [field]: value } : d));

  return (
    <div className="space-y-6 px-1 md:px-2 animate-in fade-in duration-300">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100/50">
              <Award size={22} strokeWidth={1.5}/>
            </div>
            Closing KPI & Payroll
          </h2>
          <p className="text-[14px] text-slate-500 font-medium mt-1.5 md:ml-[54px]">Finalisasi rapor dan hitung gaji otomatis</p>
        </div>
        
        <div className="bg-white hover:bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl flex items-center gap-2 w-full md:w-auto transition-colors shadow-sm shadow-slate-100">
          <Calendar size={18} strokeWidth={1.5} className="text-slate-400 ml-1"/>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)} 
            className="bg-transparent font-semibold text-[15px] text-slate-700 outline-none cursor-pointer w-full focus:ring-0" 
          />
        </div>
      </div>

      {/* STAFF LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {staffList.map(staff => {
          const report = kpiReports.find(r => r.user_id === staff.id);
          return (
            <div key={staff.id} onClick={() => { if(!report?.is_locked) handleBukaRapor(staff); else alert("Rapor sudah dikunci!"); }} className={`p-6 rounded-3xl border flex items-center justify-between transition-all shadow-sm ${report?.is_locked ? 'bg-slate-50 border-slate-200/50 cursor-not-allowed opacity-80' : 'bg-white border-slate-200/60 cursor-pointer hover:border-indigo-300 hover:shadow-md active:scale-[0.98]'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border ${report?.is_locked ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                  {staff.nama.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-[16px] text-slate-900 leading-tight">{staff.nama}</p>
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full mt-1.5 inline-block">{staff.role}</span>
                </div>
              </div>
              <div className="text-right">
                {report?.is_locked ? (
                  <>
                    <Lock size={16} strokeWidth={1.5} className="text-emerald-500 ml-auto mb-1"/>
                    <p className="text-xl font-extrabold text-slate-900">{report.total_score}</p>
                  </>
                ) : (
                  <Unlock size={20} strokeWidth={1.5} className="text-slate-300 ml-auto"/>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL TUTUP BUKU */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            
            {/* HEADER MODAL */}
            <div className="bg-white border-b border-slate-100 z-10">
              <div className="p-6 md:px-8 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xl tracking-tight">{selectedUser.nama}</h3>
                  <p className="text-[13px] font-medium text-slate-500 mt-1">{selectedUser.role} • Rapor {selectedMonth}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"><X size={20} strokeWidth={1.5}/></button>
              </div>
              
              <div className="flex px-6 md:px-8 gap-3 pb-4">
                 <button onClick={() => setActiveModalTab('kpi')} className={`px-5 py-2.5 font-bold text-[13px] rounded-full transition-all flex items-center gap-2 focus:outline-none ${activeModalTab === 'kpi' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200/80'}`}>
                   <FileText size={16} strokeWidth={1.5}/> 1. Penilaian KPI
                 </button>
                 <button onClick={() => setActiveModalTab('gaji')} className={`px-5 py-2.5 font-bold text-[13px] rounded-full transition-all flex items-center gap-2 focus:outline-none ${activeModalTab === 'gaji' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200/80'}`}>
                   <Wallet size={16} strokeWidth={1.5}/> 2. Hitung Gaji
                 </button>
              </div>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto bg-slate-50/50 flex-1 relative">
              {isCalculating && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col justify-center items-center">
                  <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} strokeWidth={1.5}/>
                  <span className="text-[14px] font-medium text-slate-600">Mengkalkulasi Data Mesin...</span>
                </div>
              )}
              
              {/* TAB 1: KPI */}
              {activeModalTab === 'kpi' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95">
                  <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm shadow-amber-50 grid grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Alfa / Izin (Hari)</label>
                      <input type="number" value={inputManual.alfa} onChange={e => setInputManual({...inputManual, alfa: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl font-bold text-[15px] outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all" />
                      <p className="text-[11px] font-medium text-amber-600 mt-2">Sistem mendeteksi {rawStats.telat}x Telat.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Komplain Valid (Kali)</label>
                      <input type="number" value={inputManual.komplain} onChange={e => setInputManual({...inputManual, komplain: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl font-bold text-[15px] outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all" />
                    </div>
                  </div>

                  <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl shadow-slate-900/10 relative overflow-hidden group">
                    <Award className="absolute -right-6 -bottom-6 text-indigo-500/20 group-hover:scale-110 transition-transform duration-700" size={140} strokeWidth={1.5}/>
                    <h4 className="text-[12px] font-bold text-indigo-300 uppercase tracking-widest mb-6 relative z-10">Detail Skor Akhir (Max 100)</h4>
                    
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-[13px] relative z-10">
                      <div className="flex justify-between border-b border-slate-700/50 pb-2"><span className="text-slate-300">1. Productivity</span> <span className="font-extrabold text-white">{finalScores.prod}</span></div>
                      <div className="flex justify-between border-b border-slate-700/50 pb-2"><span className="text-slate-300">2. Kedisiplinan</span> <span className="font-extrabold text-white">{finalScores.disiplin}</span></div>
                      <div className="flex justify-between border-b border-slate-700/50 pb-2"><span className="text-slate-300">3. Update CRM</span> <span className="font-extrabold text-white">{finalScores.crm}</span></div>
                      <div className="flex justify-between border-b border-slate-700/50 pb-2"><span className="text-slate-300">4. Logbook & SOP</span> <span className="font-extrabold text-white">{finalScores.logbook}</span></div>
                      <div className="flex justify-between border-b border-slate-700/50 pb-2 col-span-2"><span className="text-slate-300">5. Komplain (Toleransi 0)</span> <span className="font-extrabold text-white">{finalScores.komplain}</span></div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-between items-end relative z-10">
                      <span className="text-[15px] font-medium text-slate-400">Total Poin KPI</span>
                      <span className="text-5xl font-extrabold text-emerald-400 tracking-tight leading-none">{finalScores.total}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GAJI / PAYROLL */}
              {activeModalTab === 'gaji' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm shadow-emerald-50">
                      <p className="text-xs font-semibold text-emerald-600 mb-2">{selectedUser.role === 'Capster' ? `Komisi Layanan (${selectedUser.gaji_pokok}%)` : 'Gaji Pokok / Tetap'}</p>
                      <p className="text-2xl font-extrabold text-slate-900 tracking-tight">Rp {(selectedUser.role === 'Capster' ? payroll.komisi : payroll.gapok).toLocaleString('id-ID')}</p>
                      {selectedUser.role === 'Capster' && <p className="text-[11px] font-medium text-slate-500 mt-1.5">Omzet Layanan: Rp {(rawStats.omzetLayanan || 0).toLocaleString('id-ID')}</p>}
                    </div>
                    
                    <div className="bg-white p-5 rounded-3xl border border-indigo-100 shadow-sm shadow-indigo-50">
                       <label className="text-xs font-semibold text-indigo-600 mb-2 block">Bonus Prestasi (Rp)</label>
                       <input type="number" value={bonusManual} onChange={e => setBonusManual(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl font-bold text-slate-900 text-[15px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="0" />
                       <p className="text-[11px] font-medium text-slate-500 mt-2">Saran KPI ({finalScores.total} Poin)</p>
                    </div>
                  </div>

                  <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm shadow-rose-50">
                    <div className="flex justify-between items-center mb-4 border-b border-rose-50 pb-3">
                       <h4 className="text-[13px] font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={16} strokeWidth={1.5} className="text-rose-500"/> Potongan (Denda/Kasbon)</h4>
                       <button onClick={addDeduction} type="button" className="text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none"><Plus size={14} strokeWidth={1.5}/> Baris</button>
                    </div>
                    
                    <div className="space-y-3">
                      {deductions.map((d) => (
                        <div key={d.id} className="flex items-center gap-3 animate-in slide-in-from-left-2">
                          <input type="text" placeholder="Cth: Kasbon" value={d.keterangan} onChange={e => updateDeduction(d.id, 'keterangan', e.target.value)} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] font-medium outline-none focus:border-rose-400 transition-all" />
                          <input type="number" placeholder="Nominal" value={d.nominal} onChange={e => updateDeduction(d.id, 'nominal', e.target.value)} className="w-1/3 px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] font-bold outline-none focus:border-rose-400 transition-all" />
                          <button onClick={() => removeDeduction(d.id)} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors focus:outline-none"><Trash2 size={18} strokeWidth={1.5}/></button>
                        </div>
                      ))}
                      {deductions.length === 0 && <p className="text-[13px] font-medium text-slate-400 text-center py-2">Tidak ada potongan.</p>}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm shadow-slate-50">
                    <label className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5"><MessageSquare size={14} strokeWidth={1.5}/> Catatan Slip Gaji</label>
                    <textarea rows="2" placeholder="Tulis pesan/motivasi untuk karyawan..." value={catatanManager} onChange={e => setCatatanManager(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] font-medium outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-50 resize-none transition-all"></textarea>
                  </div>

                  <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shadow-xl shadow-slate-900/10">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-300 mb-1 block">Gaji Bersih (Take Home Pay)</p>
                      <span className="text-[11px] font-medium bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-full border border-rose-500/30">Total Potongan: - Rp {payroll.potongan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Rp {payroll.thp.toLocaleString('id-ID')}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white">
              <button 
                onClick={handleTutupBuku} 
                disabled={isSaving} 
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-slate-900/10 transition-all text-[15px] focus:outline-none"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} strokeWidth={1.5}/> : <Lock size={20} strokeWidth={1.5}/>} 
                Kunci Rapor & Cetak Slip Gaji
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}