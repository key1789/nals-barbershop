import React, { useState, useEffect } from 'react';
import { 
  Vault, Plus, Calendar, Search, 
  Trash2, Loader2, CheckCircle, Clock, 
  AlertTriangle, DollarSign, X, FileText, QrCode, UploadCloud, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
import imageCompression from 'browser-image-compression';

export default function TabClosingKasir({ user }) {
  // Setup Tanggal Aman (Anti Timezone Bug)
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentDay = String(currentDate.getDate()).padStart(2, '0');
  const todayLocal = `${currentYear}-${currentMonth}-${currentDay}`;

  const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${currentMonth}`);
  
  const [closings, setClosings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State Hitung Otomatis & Upload
  const [isCalculating, setIsCalculating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // State Modal Tambah
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tanggal: todayLocal,
    shift: 'Full Day',
    cash_system: 0,
    cash_fisik: '',
    qris_total_system: 0,
    qris_total_verified: '',
    catatan_closing: '',
    bukti_setoran_url: ''
  });

  // ==========================================
  // 1. FETCH DATA CLOSING HARIAN
  // ==========================================
  const fetchClosings = async () => {
    setIsLoading(true);
    try {
      const year = selectedMonth.split('-')[0];
      const month = selectedMonth.split('-')[1];
      const lastDay = new Date(year, month, 0).getDate();
      
      const startOfMonth = `${year}-${month}-01`;
      const endOfMonth = `${year}-${month}-${lastDay}`;

      // Ambil data murni
      const { data, error } = await supabase
        .from('shift_closings')
        .select('*') 
        .gte('tanggal', startOfMonth)
        .lte('tanggal', endOfMonth)
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClosings(data || []);
    } catch (err) {
      console.error("Gagal narik data closing:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchClosings(); }, [selectedMonth]);

  // ==========================================
  // 2. AUTO-HITUNG OMZET SISTEM PER TANGGAL
  // ==========================================
  const fetchSystemOmzet = async (tgl) => {
    setIsCalculating(true);
    try {
      const startOfDay = `${tgl}T00:00:00.000Z`;
      const endOfDay = `${tgl}T23:59:59.999Z`;

      // Tarik semua transaksi "Paid" hari itu (Pakai * biar aman dari kolom kapital)
      const { data: visits, error } = await supabase
        .from('visits')
        .select('*, visit_items(*, products_services(*))') 
        .eq('status_transaksi', 'Paid')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      if (error) throw error;

      let totalCash = 0;
      let totalQris = 0;

      visits?.forEach(v => {
        let notaTotal = 0;
        v.visit_items?.forEach(item => {
          const qty = item.qty || item.Qty || item.QTY || 1;
          const harga = item.harga || item.Harga || item.HARGA || 0;
          notaTotal += (qty * harga);
        });

        // Cek dia bayar pakai apa
        const metode = (v.metode_pembayaran || v.MetodePembayaran || '').toLowerCase();
        if (metode.includes('qris') || metode.includes('transfer') || metode.includes('edc')) {
          totalQris += notaTotal;
        } else {
          totalCash += notaTotal; // Kalau kosong/Cash masuk sini
        }
      });

      setFormData(prev => ({ ...prev, cash_system: totalCash, qris_total_system: totalQris }));
    } catch (err) {
      console.error("Gagal hitung sistem:", err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  // Jalankan Auto-Hitung tiap FO ganti tanggal di Modal
  useEffect(() => {
    if (isModalOpen && formData.tanggal) {
      fetchSystemOmzet(formData.tanggal);
    }
  }, [formData.tanggal, isModalOpen]);

  // ==========================================
  // 3. UPLOAD BUKTI (DENGAN KOMPRESI OTOMATIS)
  // ==========================================
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // SETTING MESIN KOMPRESI
      const options = {
        maxSizeMB: 0.5, // Maks 500KB
        maxWidthOrHeight: 1200, // HD tapi ringan
        useWebWorker: true
      };

      // PROSES KOMPRESI
      const compressedFile = await imageCompression(file, options);
      
      const fileExt = compressedFile.name.split('.').pop() || 'jpg';
      const fileName = `mutasi_${Date.now()}.${fileExt}`;

      // UPLOAD KE BUCKET 'bukti_setoran'
      const { error: uploadError } = await supabase.storage
        .from('bukti_setoran') 
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      // AMBIL LINK PUBLIC
      const { data: { publicUrl } } = supabase.storage
        .from('bukti_setoran')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, bukti_setoran_url: publicUrl }));
    } catch (error) {
      alert("Gagal upload SS Mutasi: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================
  // 4. SIMPAN SETORAN (FO)
  // ==========================================
  const handleSaveClosing = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Hitung otomatis selisihnya (Fisik - Sistem)
    const selisihKas = Number(formData.cash_fisik) - Number(formData.cash_system);

    try {
      const payload = {
        tanggal: formData.tanggal,
        shift: formData.shift,
        cash_system: Number(formData.cash_system),
        cash_fisik: Number(formData.cash_fisik),
        selisih: selisihKas,
        qris_total_system: Number(formData.qris_total_system),
        qris_total_verified: Number(formData.qris_total_verified),
        catatan_closing: formData.catatan_closing,
        bukti_setoran_url: formData.bukti_setoran_url,
        status_setoran: 'Pending', 
        fo_id: user?.id,
        outlet_id: user?.outlet_id
      };

      const { error } = await supabase.from('shift_closings').insert([payload]);
      if (error) throw error;

      setIsModalOpen(false);
      setFormData({ tanggal: todayLocal, shift: 'Full Day', cash_system: 0, cash_fisik: '', qris_total_system: 0, qris_total_verified: '', catatan_closing: '', bukti_setoran_url: '' }); 
      fetchClosings(); 
    } catch (err) {
      alert("Gagal menyimpan closing: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // 5. VERIFIKASI (MANAGER) & HAPUS
  // ==========================================
  const handleVerify = async (id) => {
    if (!window.confirm("Verifikasi setoran ini? Pastikan uang fisik & QRIS sudah masuk ke rekening/brankas utama!")) return;
    try {
      const { error } = await supabase.from('shift_closings').update({ status_setoran: 'Verified', manager_id: user?.id, verified_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      fetchClosings();
    } catch (err) { alert("Gagal verifikasi: " + err.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus laporan closing ini?")) return;
    try {
      const { error } = await supabase.from('shift_closings').delete().eq('id', id);
      if (error) throw error;
      fetchClosings();
    } catch (err) { alert("Gagal menghapus: " + err.message); }
  };

  // Kalkulasi Summary
  const totalCashVerified = closings.filter(c => c.status_setoran === 'Verified').reduce((sum, item) => sum + Number(item.cash_fisik), 0);
  const totalQrisVerified = closings.filter(c => c.status_setoran === 'Verified').reduce((sum, item) => sum + Number(item.qris_total_verified), 0);
  const totalNombok = closings.filter(c => c.selisih < 0).reduce((sum, item) => sum + Math.abs(Number(item.selisih)), 0);

  return (
    <div className="space-y-6 px-1 md:px-2 animate-in fade-in duration-300">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mt-2">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100/50">
              <Vault size={22} strokeWidth={1.5}/>
            </div>
            Daily Closing
          </h2>
          <p className="text-[14px] text-slate-500 font-medium mt-1.5 md:ml-[54px]">Laporan serah terima uang fisik & QRIS dari Kasir</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Month Picker */}
          <div className="bg-white hover:bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl flex items-center gap-2 flex-1 md:flex-none transition-colors shadow-sm shadow-slate-100">
            <Calendar size={18} strokeWidth={1.5} className="text-slate-400 ml-1"/>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent font-semibold text-[15px] text-slate-700 outline-none cursor-pointer w-full focus:ring-0" />
          </div>
          {/* Tombol Tambah */}
          <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl font-semibold shadow-md shadow-slate-900/10 transition-all active:scale-95 flex items-center gap-2 focus:outline-none">
            <Plus size={18} strokeWidth={1.5}/> <span className="hidden md:inline text-[14px]">Buat Laporan</span>
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="bg-white p-6 md:p-7 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 relative overflow-hidden group">
          <DollarSign className="absolute -right-4 -bottom-4 text-emerald-50 opacity-50 group-hover:scale-110 transition-transform duration-500" size={100} strokeWidth={1.5}/>
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">Total Uang Fisik (Verified)</p>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Rp {totalCashVerified.toLocaleString('id-ID')}</h3>
          </div>
        </div>
        
        <div className="bg-white p-6 md:p-7 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 relative overflow-hidden group">
          <QrCode className="absolute -right-4 -bottom-4 text-indigo-50 opacity-50 group-hover:scale-110 transition-transform duration-500" size={100} strokeWidth={1.5}/>
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">Total QRIS (Verified)</p>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Rp {totalQrisVerified.toLocaleString('id-ID')}</h3>
          </div>
        </div>
        
        <div className={`${totalNombok > 0 ? 'bg-rose-900' : 'bg-slate-900'} p-6 md:p-7 rounded-3xl shadow-xl shadow-slate-900/10 text-white relative overflow-hidden group`}>
          <AlertTriangle className={`absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform duration-500 ${totalNombok > 0 ? 'text-rose-400' : 'text-slate-700'}`} size={100} strokeWidth={1.5}/>
          <div className="relative z-10">
            <p className="text-sm font-medium text-slate-300 mb-2">Total Kasir Nombok / Kurang</p>
            <h3 className="text-3xl font-extrabold tracking-tight">Rp {totalNombok.toLocaleString('id-ID')}</h3>
            {totalNombok > 0 && <p className="text-[11px] text-rose-300 mt-2 font-medium bg-rose-950/50 inline-block px-2 py-1 rounded-md">Harus ditagih ke FO bersangkutan!</p>}
          </div>
        </div>
      </div>

      {/* LIST CLOSING */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center"><Loader2 className="animate-spin text-slate-400 mx-auto" size={32} strokeWidth={1.5}/></div>
        ) : closings.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100"><Search className="text-slate-300" size={28} strokeWidth={1.5}/></div>
            <p className="text-[15px] font-medium text-slate-500">Belum ada laporan closing bulan ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {closings.map((item) => {
              const isVerified = item.status_setoran === 'Verified';
              const isNombok = item.selisih < 0;
              const isLebih = item.selisih > 0;
              
              return (
                <div key={item.id} className="p-5 md:px-6 md:py-6 flex flex-col lg:flex-row justify-between lg:items-center gap-5 hover:bg-slate-50/50 transition-colors group">
                  
                  <div className="flex items-start gap-4 lg:w-1/3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${isVerified ? 'bg-emerald-50 text-emerald-500 border-emerald-100/50' : 'bg-amber-50 text-amber-500 border-amber-100/50'}`}>
                      {isVerified ? <CheckCircle size={22} strokeWidth={1.5}/> : <Clock size={22} strokeWidth={1.5}/>}
                    </div>
                    <div className="mt-0.5">
                      <h4 className="font-bold text-slate-900 text-[15px] flex items-center gap-2">
                        {item.tanggal}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.status_setoran}</span>
                      </h4>
                      <div className="flex flex-wrap items-center gap-2.5 mt-2">
                        <span className="text-[12px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{item.shift}</span>
                        {item.bukti_setoran_url && (
                          <a href={item.bukti_setoran_url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                            <ImageIcon size={12}/> Lihat Mutasi
                          </a>
                        )}
                        {item.catatan_closing && <span className="text-[12px] font-medium text-slate-400 max-w-[150px] truncate">"{item.catatan_closing}"</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 lg:w-1/2 border-y lg:border-y-0 border-slate-100 py-4 lg:py-0">
                    <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-500 mb-1">Setoran Cash Fisik</p>
                      <p className="font-extrabold text-slate-900">Rp {Number(item.cash_fisik).toLocaleString('id-ID')}</p>
                      <div className={`mt-1.5 text-[11px] font-bold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${isNombok ? 'bg-rose-100 text-rose-700' : isLebih ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isNombok ? `Nombok: Rp ${Math.abs(item.selisih).toLocaleString()}` : isLebih ? `Lebih: Rp ${item.selisih.toLocaleString()}` : 'Balance / Pas'}
                      </div>
                    </div>
                    
                    <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1"><QrCode size={12}/> Setoran QRIS</p>
                      <p className="font-extrabold text-indigo-600">Rp {Number(item.qris_total_verified).toLocaleString('id-ID')}</p>
                      <p className="text-[10px] font-medium text-slate-400 mt-1">Sistem POS: Rp {Number(item.qris_total_system).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 lg:w-auto">
                    {!isVerified && (
                      <button onClick={() => handleVerify(item.id)} className="bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white px-4 py-2 rounded-xl text-[12px] font-bold transition-all border border-emerald-200 hover:border-emerald-500">
                        Verifikasi
                      </button>
                    )}
                    <button onClick={() => handleDelete(item.id)} className="p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors focus:outline-none">
                      <Trash2 size={18} strokeWidth={1.5}/>
                    </button>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL BUAT LAPORAN CLOSING */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Buat Laporan Closing</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Sistem akan otomatis menarik data hari ini.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-full transition-colors focus:outline-none"><X size={20} strokeWidth={1.5}/></button>
            </div>

            <div className="overflow-y-auto p-6 bg-slate-50/50">
              <form onSubmit={handleSaveClosing} className="space-y-5">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tanggal Closing</label>
                    <input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl font-medium text-[15px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Shift Kasir</label>
                    <select value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl font-medium text-[15px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all appearance-none">
                      <option value="Pagi">Shift Pagi</option>
                      <option value="Malam">Shift Malam</option>
                      <option value="Full Day">Full Day</option>
                    </select>
                  </div>
                </div>

                {/* SECTION CASH */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-[13px] font-bold text-slate-800 flex items-center gap-2"><DollarSign size={16} className="text-emerald-500"/> Validasi Uang Cash</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        Cash di Sistem POS {isCalculating && <Loader2 size={10} className="animate-spin text-emerald-500"/>}
                      </label>
                      {/* INPUT INI DI-LOCK (READONLY) BIAR FO GAK BISA NIPU */}
                      <input type="text" readOnly value={`Rp ${formData.cash_system.toLocaleString('id-ID')}`} className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500 outline-none cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block text-emerald-600">Cash Fisik di Laci (Rp)</label>
                      <input type="number" placeholder="Hitung di laci..." value={formData.cash_fisik} onChange={e => setFormData({...formData, cash_fisik: e.target.value})} className="w-full px-3 py-2.5 bg-white border-2 border-emerald-200 rounded-xl font-extrabold text-emerald-700 outline-none focus:border-emerald-500 transition-all" required />
                    </div>
                  </div>
                  {formData.cash_fisik && (
                     <div className={`p-2 rounded-lg text-xs font-bold text-center ${Number(formData.cash_fisik) - Number(formData.cash_system) < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                       Selisih: Rp {(Number(formData.cash_fisik) - Number(formData.cash_system)).toLocaleString('id-ID')}
                     </div>
                  )}
                </div>

                {/* SECTION QRIS & UPLOAD */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[13px] font-bold text-slate-800 flex items-center gap-2"><QrCode size={16} className="text-indigo-500"/> Validasi Transfer / QRIS</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        QRIS di Sistem POS {isCalculating && <Loader2 size={10} className="animate-spin text-indigo-500"/>}
                      </label>
                      {/* INPUT INI JUGA DI-LOCK */}
                      <input type="text" readOnly value={`Rp ${formData.qris_total_system.toLocaleString('id-ID')}`} className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500 outline-none cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block text-indigo-600">QRIS Masuk Mutasi (Rp)</label>
                      <input type="number" placeholder="Cek Mutasi..." value={formData.qris_total_verified} onChange={e => setFormData({...formData, qris_total_verified: e.target.value})} className="w-full px-3 py-2.5 bg-white border-2 border-indigo-200 rounded-xl font-extrabold text-indigo-700 outline-none focus:border-indigo-500 transition-all" required />
                    </div>
                  </div>

                  {/* UPLOAD BUKTI MUTASI */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <label className="text-[11px] font-semibold text-slate-500 mb-2 block">Upload Bukti SS Mutasi (Opsional)</label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2 border border-slate-200">
                        {isUploading ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16}/>}
                        {isUploading ? 'Uploading...' : 'Pilih Foto Mutasi'}
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                      </label>
                      {formData.bukti_setoran_url && <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={14}/> Sukses Upload</span>}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5"><FileText size={14} strokeWidth={1.5}/> Catatan Closing</label>
                  <textarea rows="2" placeholder="Contoh: Ada selisih karena..." value={formData.catatan_closing} onChange={e => setFormData({...formData, catatan_closing: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl font-medium text-[14px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all resize-none placeholder-slate-400"></textarea>
                </div>

                <div className="pt-2 sticky bottom-0 bg-slate-50/90 backdrop-blur-md pb-2">
                  <button type="submit" disabled={isSaving || isCalculating || isUploading} className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl font-semibold text-[15px] flex justify-center items-center gap-2 shadow-md shadow-slate-900/10 transition-all focus:outline-none disabled:opacity-50">
                    {(isSaving || isCalculating || isUploading) ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin"/> : 'Kirim Laporan Closing'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}