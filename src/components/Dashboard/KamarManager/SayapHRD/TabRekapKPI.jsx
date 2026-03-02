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

  // === STATE MODAL TUTUP BUKU ===
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('kpi'); // 'kpi' atau 'gaji'
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // === STATE DATA KPI ===
  const [inputManual, setInputManual] = useState({ alfa: 0, komplain: 0 });
  const [rawStats, setRawStats] = useState({});

  // === STATE DATA GAJI / PAYROLL ===
  const [bonusManual, setBonusManual] = useState(0);
  const [catatanManager, setCatatanManager] = useState('');
  const [deductions, setDeductions] = useState([{ id: Date.now(), keterangan: '', nominal: 0 }]); // State Dinamis Potongan

  // ==========================================
  // 1. FETCH DATA KARYAWAN & STATUS RAPOR
  // ==========================================
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

  // ==========================================
  // 2. TARIK DATA REAL (KPI & OMZET)
  // ==========================================
  const handleBukaRapor = async (user) => {
    setSelectedUser(user);
    setActiveModalTab('kpi'); // Default buka tab KPI dulu
    
    // Reset semua form manual
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

      // A. ABSENSI
      const { data: absen } = await supabase.from('attendance_logs').select('menit_terlambat').eq('user_id', user.id).gte('tanggal', startOnly).lte('tanggal', endOnly);
      const totalTelat = absen ? absen.filter(a => a.menit_terlambat > (user.toleransi_telat_absen_menit || 10)).length : 0;
      let totalHariKerja = absen ? absen.length : 1; 

      // B. TRANSAKSI (Narik Omzet untuk Gaji & KPI)
      // Tambahin harga_saat_ini buat ngitung omzet capster
      const { data: visits } = await supabase.from('visits').select(`status_transaksi, start_service, end_service, visit_items(qty, harga_saat_ini, products_services(nama_item, kategori, durasi_menit))`).or(`capster_id.eq.${user.id},fo_id.eq.${user.id}`).gte('created_at', startOfMonth).lte('created_at', endOfMonth);
      
      let countKepala = 0, countUpsell = 0, totalStrukFO = 0, strukGroomingFO = 0, errorVoid = 0, visitSesuaiDurasi = 0, totalVisitDiukur = 0;
      let totalOmzetLayanan = 0; // Buat komisi Capster
      
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

            // Hitung Omzet Layanan khusus buat Capster
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

      // C. TUGAS AREA (Logbook Dinamis)
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

      // D. CRM (DIPERBAIKI !inner)
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
        omzetLayanan: totalOmzetLayanan // Simpan omzet buat hitung komisi
      });

    } catch (err) { console.error(err); } 
    finally { setIsCalculating(false); }
  };

  // ==========================================
  // 3. KALKULASI SKOR (KPI)
  // ==========================================
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

  // ==========================================
  // 4. KALKULASI GAJI (PAYROLL)
  // ==========================================
  const calculateSalary = () => {
    if (!selectedUser) return { gapok: 0, komisi: 0, bonus: 0, potongan: 0, thp: 0 };
    
    let gapok = 0;
    let komisi = 0;
    let bonus = Number(bonusManual) || 0;
    
    if (selectedUser.role === 'Capster') {
        const persen = Number(selectedUser.gaji_pokok) || 0; // Gaji_pokok Capster = % Komisi
        komisi = (rawStats.omzetLayanan || 0) * (persen / 100);
    } else {
        gapok = Number(selectedUser.gaji_pokok) || 0; // Gaji_pokok FO = Nominal Rupiah
    }

    // Hitung total dari baris dinamis potongan
    const totalPotongan = deductions.reduce((sum, d) => sum + (Number(d.nominal) || 0), 0);
    const thp = gapok + komisi + bonus - totalPotongan;

    return { gapok, komisi, bonus, potongan: totalPotongan, thp };
  };
  const payroll = calculateSalary();

  // ==========================================
  // 5. SIMPAN KE DATABASE (3 TABEL SEKALIGUS)
  // ==========================================
  const handleTutupBuku = async () => {
    if (!window.confirm(`Yakin KUNCI RAPOR & CETAK GAJI untuk ${selectedUser.nama}? Data tidak bisa diubah lagi.`)) return;
    setIsSaving(true);
    
    try {
      // TEMBAKAN 1: Kunci Rapor KPI
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

      // TEMBAKAN 2: Simpan Master Gaji
      const payloadSalary = {
        user_id: selectedUser.id,
        kpi_report_id: kpiData.id, // Relasi ke KPI
        periode_bulan: selectedMonth,
        omzet_layanan: rawStats.omzetLayanan || 0,
        persentase_komisi: selectedUser.role === 'Capster' ? Number(selectedUser.gaji_pokok) : 0,
        nominal_komisi: payroll.komisi,
        nominal_gapok: payroll.gapok,
        nominal_bonus: payroll.bonus,
        total_bruto: payroll.gapok + payroll.komisi + payroll.bonus,
        total_potongan: payroll.potongan,
        take_home_pay: payroll.thp,
        catatan_manager: catatanManager
      };
      
      const { data: salaryData, error: salErr } = await supabase.from('salary_logs').insert([payloadSalary]).select().single();
      if (salErr) throw salErr;

      // TEMBAKAN 3: Simpan Rincian Potongan Dinamis (Kalau ada)
      const validDeductions = deductions.filter(d => d.keterangan.trim() !== '' && Number(d.nominal) > 0);
      if (validDeductions.length > 0) {
        const payloadDeductions = validDeductions.map(d => ({
            salary_log_id: salaryData.id,
            keterangan: d.keterangan,
            nominal: Number(d.nominal)
        }));
        const { error: dedErr } = await supabase.from('salary_deductions').insert(payloadDeductions);
        if (dedErr) throw dedErr;
      }

      setIsModalOpen(false);
      fetchDashboardData();
      alert("✅ BERHASIL! Rapor Dikunci & Slip Gaji Tercetak.");
      
    } catch (err) { alert("Gagal Simpan: " + err.message); } 
    finally { setIsSaving(false); }
  };

  // ==========================================
  // HANDLER DEDUCTIONS DINAMIS (TAMBAH KOTAK)
  // ==========================================
  const addDeduction = () => setDeductions([...deductions, { id: Date.now(), keterangan: '', nominal: 0 }]);
  const removeDeduction = (id) => setDeductions(deductions.filter(d => d.id !== id));
  const updateDeduction = (id, field, value) => setDeductions(deductions.map(d => d.id === id ? { ...d, [field]: value } : d));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Award className="text-indigo-600"/> Tutup Buku & Payroll</h2>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">Finalisasi Rapor KPI & Sinkronisasi Gaji</p>
        </div>
        <div className="bg-slate-50 p-2 rounded-xl border flex items-center gap-2">
          <Calendar size={16} className="text-slate-500 ml-2"/>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent font-black text-sm outline-none cursor-pointer" />
        </div>
      </div>

      {/* STAFF LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {staffList.map(staff => {
          const report = kpiReports.find(r => r.user_id === staff.id);
          return (
            <div key={staff.id} onClick={() => { if(!report?.is_locked) handleBukaRapor(staff); else alert("Rapor sudah dikunci!"); }} className={`p-5 rounded-2xl border flex items-center justify-between transition-all shadow-sm ${report?.is_locked ? 'bg-emerald-50 border-emerald-100 cursor-not-allowed opacity-75' : 'bg-white border-slate-200 cursor-pointer hover:border-indigo-300 hover:shadow-md active:scale-95'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black ${report?.is_locked ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{staff.nama.charAt(0)}</div>
                <div>
                  <p className="font-bold text-slate-900">{staff.nama}</p>
                  <span className="text-[10px] uppercase font-black text-slate-400">{staff.role}</span>
                </div>
              </div>
              <div className="text-right">
                {report?.is_locked ? <><Lock size={16} className="text-emerald-500 ml-auto mb-1"/><p className="text-xl font-black text-emerald-700">{report.total_score}</p></> : <Unlock size={16} className="text-slate-300 ml-auto"/>}
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL TUTUP BUKU (DENGAN 2 TAB: KPI & GAJI) */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            
            {/* MODAL HEADER & TABS NAVIGATION */}
            <div className="bg-slate-50 border-b border-slate-200">
              <div className="p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tight">{selectedUser.nama}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedUser.role} • Rapor {selectedMonth}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
              </div>
              
              <div className="flex px-5 gap-4">
                 <button onClick={() => setActiveModalTab('kpi')} className={`pb-3 font-black text-xs uppercase tracking-widest flex items-center gap-2 border-b-4 transition-all ${activeModalTab === 'kpi' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                   <FileText size={16}/> 1. Penilaian KPI
                 </button>
                 <button onClick={() => setActiveModalTab('gaji')} className={`pb-3 font-black text-xs uppercase tracking-widest flex items-center gap-2 border-b-4 transition-all ${activeModalTab === 'gaji' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                   <Wallet size={16}/> 2. Hitung Gaji
                 </button>
              </div>
            </div>

            {/* KONTEN MODAL */}
            <div className="p-6 overflow-y-auto bg-white flex-1 relative">
              {isCalculating ? <div className="absolute inset-0 bg-white/80 z-10 flex flex-col justify-center items-center"><Loader2 className="animate-spin text-indigo-600 mb-2" size={40}/><span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mengkalkulasi Data Mesin...</span></div> : null}
              
              {/* ======================= TAB 1: KPI ======================= */}
              {activeModalTab === 'kpi' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95">
                  {/* INPUT MANUAL KPI */}
                  <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-amber-800 uppercase">Alfa / Izin (Hari)</label>
                      <input type="number" value={inputManual.alfa} onChange={e => setInputManual({...inputManual, alfa: e.target.value})} className="w-full p-3 rounded-xl border mt-1 font-black outline-none focus:border-amber-400" />
                      <p className="text-[9px] text-amber-600 mt-1">Sistem deteksi {rawStats.telat}x Telat.</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-amber-800 uppercase">Komplain Valid (Kali)</label>
                      <input type="number" value={inputManual.komplain} onChange={e => setInputManual({...inputManual, komplain: e.target.value})} className="w-full p-3 rounded-xl border mt-1 font-black outline-none focus:border-amber-400" />
                    </div>
                  </div>

                  {/* PREVIEW POIN KPI */}
                  <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                    <Award className="absolute -right-4 -bottom-4 text-slate-800 opacity-50" size={100}/>
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-4 tracking-widest relative z-10">Detail Skor Akhir (Max 100 Poin)</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs relative z-10">
                      <div className="flex justify-between border-b border-slate-800 pb-1"><span>1. Productivity / RCR</span> <span className="font-black text-indigo-400">{finalScores.prod}</span></div>
                      <div className="flex justify-between border-b border-slate-800 pb-1"><span>2. Kedisiplinan</span> <span className="font-black text-indigo-400">{finalScores.disiplin}</span></div>
                      <div className="flex justify-between border-b border-slate-800 pb-1"><span>3. Update CRM</span> <span className="font-black text-indigo-400">{finalScores.crm}</span></div>
                      <div className="flex justify-between border-b border-slate-800 pb-1"><span>4. Logbook & SOP</span> <span className="font-black text-indigo-400">{finalScores.logbook}</span></div>
                      <div className="flex justify-between border-b border-slate-800 pb-1"><span>5. Komplain (0 Toleransi)</span> <span className="font-black text-indigo-400">{finalScores.komplain}</span></div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-end relative z-10">
                      <span className="text-sm font-black uppercase text-slate-400">Total Poin KPI</span>
                      <span className="text-5xl font-black text-emerald-400 leading-none">{finalScores.total}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================= TAB 2: GAJI / PAYROLL ======================= */}
              {activeModalTab === 'gaji' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95">
                  
                  {/* PENDAPATAN & BONUS */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">{selectedUser.role === 'Capster' ? `Komisi Layanan (${selectedUser.gaji_pokok}%)` : 'Gaji Pokok / Tetap'}</p>
                      <p className="text-xl font-black text-emerald-900">Rp {(selectedUser.role === 'Capster' ? payroll.komisi : payroll.gapok).toLocaleString('id-ID')}</p>
                      {selectedUser.role === 'Capster' && <p className="text-[9px] font-bold text-emerald-500 mt-1">Omzet Layanan: Rp {(rawStats.omzetLayanan || 0).toLocaleString('id-ID')}</p>}
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                       <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1 block">Bonus Akhir Bulan (Rp)</label>
                       <input type="number" value={bonusManual} onChange={e => setBonusManual(e.target.value)} className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl font-black text-indigo-900 outline-none focus:border-indigo-400" placeholder="0" />
                       <p className="text-[9px] font-bold text-indigo-500 mt-1">Rekomendasi dari Skor KPI: {finalScores.total}</p>
                    </div>
                  </div>

                  {/* POTONGAN DINAMIS */}
                  <div className="border border-rose-200 rounded-2xl p-4 bg-white shadow-sm">
                    <div className="flex justify-between items-center mb-3 border-b border-rose-100 pb-2">
                       <h4 className="text-[11px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14}/> Potongan (Denda/Kasbon)</h4>
                       <button onClick={addDeduction} type="button" className="text-[10px] bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg font-black uppercase flex items-center gap-1 hover:bg-rose-200 transition-colors"><Plus size={12}/> Kotak</button>
                    </div>
                    
                    <div className="space-y-2">
                      {deductions.map((d, index) => (
                        <div key={d.id} className="flex items-center gap-2 animate-in slide-in-from-left-2">
                          <input type="text" placeholder="Keterangan (Cth: Kasbon)" value={d.keterangan} onChange={e => updateDeduction(d.id, 'keterangan', e.target.value)} className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-400" />
                          <input type="number" placeholder="Nominal Rp" value={d.nominal} onChange={e => updateDeduction(d.id, 'nominal', e.target.value)} className="w-1/3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none focus:border-rose-400" />
                          <button onClick={() => removeDeduction(d.id)} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={16}/></button>
                        </div>
                      ))}
                      {deductions.length === 0 && <p className="text-xs font-bold text-slate-400 text-center py-2">Tidak ada potongan bulan ini.</p>}
                    </div>
                  </div>

                  {/* CATATAN MANAGER */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1"><MessageSquare size={12}/> Catatan Slip Gaji</label>
                    <textarea rows="2" placeholder="Tulis masukan untuk karyawan..." value={catatanManager} onChange={e => setCatatanManager(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 resize-none"></textarea>
                  </div>

                  {/* SUMMARY THP */}
                  <div className="bg-slate-900 rounded-2xl p-5 text-white flex justify-between items-center shadow-xl">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Gaji Bersih (Take Home Pay)</p>
                      <p className="text-[10px] font-bold text-slate-400">Total Potongan: - Rp {payroll.potongan.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="text-3xl font-black text-white">Rp {payroll.thp.toLocaleString('id-ID')}</div>
                  </div>

                </div>
              )}

            </div>

            {/* FOOTER & BUTTON SUBMIT */}
            <div className="p-5 border-t border-slate-200 bg-slate-50">
              <button onClick={handleTutupBuku} disabled={isSaving} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-black flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all uppercase tracking-widest text-sm">
                {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Lock size={20}/>} Kunci Rapor & Cetak Slip Gaji
              </button>
              <p className="text-center text-[9px] font-bold text-slate-400 mt-3">Pastikan data di Tab KPI dan Gaji sudah benar sebelum dikunci.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}