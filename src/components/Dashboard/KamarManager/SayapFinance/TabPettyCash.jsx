import React, { useState, useEffect } from 'react';
import { 
  Receipt, Plus, Calendar, Search, 
  Trash2, Loader2, ArrowUpCircle, ArrowDownCircle, Wallet, Tag, FileText, DollarSign, X
} from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

export default function TabPettyCash({ user }) {
  // Setup Tanggal Aman dari Bug Timezone
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentDay = String(currentDate.getDate()).padStart(2, '0');
  const todayLocal = `${currentYear}-${currentMonth}-${currentDay}`;

  const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${currentMonth}`);
  
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State Modal Tambah
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tanggal: todayLocal,
    jenis: 'OUT', // Default Pengeluaran
    kategori: '',
    deskripsi: '',
    nominal: ''
  });

  // ==========================================
  // 1. FETCH DATA KAS KECIL (FINAL & CLEAN VER)
  // ==========================================
  const fetchPettyCash = async () => {
    setIsLoading(true);
    try {
      const year = selectedMonth.split('-')[0];
      const month = selectedMonth.split('-')[1];
      const lastDay = new Date(year, month, 0).getDate();
      
      const startOfMonth = `${year}-${month}-01`;
      const endOfMonth = `${year}-${month}-${lastDay}`;

      // Karena relasi FK udah lo bikin, kita bisa langsung panggil users(nama)!
      // Kalau misal masih rewel, kita pakai nama constraint lo: users!expenses_created_by_fkey(nama)
      const { data, error } = await supabase
        .from('petty_cash_transactions')
        .select('*, users!expenses_created_by_fkey(nama)') // <--- FIX RELASI SESUAI NAMA FK LO
        .gte('tanggal', startOfMonth)
        .lte('tanggal', endOfMonth)
        .order('tanggal', { ascending: false });

      // Coba pakai yang standard kalau yang atas error: .select('*, users(nama)')

      if (error) throw error;
      setTransactions(data || []);
      
    } catch (err) {
      console.error("Gagal narik kas kecil:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPettyCash(); }, [selectedMonth]);

  // ==========================================
  // 2. SIMPAN TRANSAKSI (IN/OUT)
  // ==========================================
  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!formData.nominal || formData.nominal <= 0) return alert("Nominal harus lebih dari 0!");
    if (!formData.deskripsi) return alert("Deskripsi wajib diisi!");
    if (!formData.kategori) return alert("Kategori wajib diisi!");

    setIsSaving(true);
    try {
      const payload = {
        tanggal: formData.tanggal,
        jenis: formData.jenis,
        kategori: formData.kategori,
        deskripsi: formData.deskripsi,
        nominal: Number(formData.nominal),
        created_by: user?.id,
        outlet_id: user?.outlet_id
      };

      const { error } = await supabase.from('petty_cash_transactions').insert([payload]);
      if (error) throw error;

      setIsModalOpen(false);
      setFormData({ ...formData, deskripsi: '', nominal: '', kategori: '' }); 
      fetchPettyCash(); 
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // 3. HAPUS TRANSAKSI
  // ==========================================
  const handleDelete = async (id, deskripsi) => {
    if (!window.confirm(`Hapus catatan kas: "${deskripsi}"?`)) return;
    try {
      const { error } = await supabase.from('petty_cash_transactions').delete().eq('id', id);
      if (error) throw error;
      fetchPettyCash();
    } catch (err) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  // ==========================================
  // 4. KALKULASI DEBIT, KREDIT & SALDO
  // ==========================================
  const totalIn = transactions.filter(t => t.jenis?.toUpperCase() === 'IN').reduce((sum, item) => sum + Number(item.nominal), 0);
  const totalOut = transactions.filter(t => t.jenis?.toUpperCase() === 'OUT').reduce((sum, item) => sum + Number(item.nominal), 0);
  const sisaSaldo = totalIn - totalOut;

  return (
    <div className="space-y-6 px-1 md:px-2 animate-in fade-in duration-300">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mt-2">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600 border border-amber-100/50">
              <Receipt size={22} strokeWidth={1.5}/>
            </div>
            Kas Kecil (Petty Cash)
          </h2>
          <p className="text-[14px] text-slate-500 font-medium mt-1.5 md:ml-[54px]">Catatan arus kas operasional Front Office</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Month Picker */}
          <div className="bg-white hover:bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl flex items-center gap-2 flex-1 md:flex-none transition-colors shadow-sm shadow-slate-100">
            <Calendar size={18} strokeWidth={1.5} className="text-slate-400 ml-1"/>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              className="bg-transparent font-semibold text-[15px] text-slate-700 outline-none cursor-pointer w-full focus:ring-0" 
            />
          </div>
          {/* Tombol Tambah */}
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl font-semibold shadow-md shadow-slate-900/10 transition-all active:scale-95 flex items-center gap-2 focus:outline-none"
          >
            <Plus size={18} strokeWidth={1.5}/> 
            <span className="hidden md:inline text-[14px]">Catat Kas</span>
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS (DEBIT / KREDIT / SALDO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="bg-white p-6 md:p-7 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 relative overflow-hidden group">
          <ArrowUpCircle className="absolute -right-4 -bottom-4 text-emerald-100 opacity-50 group-hover:scale-110 transition-transform duration-500" size={100} strokeWidth={1.5}/>
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Total Pemasukan (In)
            </p>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Rp {totalIn.toLocaleString('id-ID')}</h3>
          </div>
        </div>
        
        <div className="bg-white p-6 md:p-7 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 relative overflow-hidden group">
          <ArrowDownCircle className="absolute -right-4 -bottom-4 text-rose-100 opacity-50 group-hover:scale-110 transition-transform duration-500" size={100} strokeWidth={1.5}/>
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Total Pengeluaran (Out)
            </p>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Rp {totalOut.toLocaleString('id-ID')}</h3>
          </div>
        </div>
        
        <div className={`${sisaSaldo >= 0 ? 'bg-slate-900' : 'bg-rose-900'} p-6 md:p-7 rounded-3xl shadow-xl shadow-slate-900/10 text-white relative overflow-hidden group`}>
          <Wallet className={`absolute -right-6 -bottom-6 opacity-20 group-hover:scale-110 transition-transform duration-500 ${sisaSaldo >= 0 ? 'text-white' : 'text-rose-400'}`} size={120} strokeWidth={1}/>
          <div className="relative z-10">
            <p className="text-sm font-medium text-slate-300 mb-2">Sisa Saldo Kas Fisik</p>
            <h3 className="text-3xl font-extrabold tracking-tight">Rp {sisaSaldo.toLocaleString('id-ID')}</h3>
          </div>
        </div>
      </div>

      {/* LIST TRANSAKSI */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center"><Loader2 className="animate-spin text-slate-400 mx-auto" size={32} strokeWidth={1.5}/></div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <Search className="text-slate-300" size={28} strokeWidth={1.5}/>
            </div>
            <p className="text-[15px] font-medium text-slate-500">Belum ada transaksi kas bulan ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {transactions.map((item) => {
              const isOut = item.jenis?.toUpperCase() === 'OUT';
              return (
                <div key={item.id} className="p-5 md:px-6 md:py-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-50/50 transition-colors group">
                  
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${isOut ? 'bg-rose-50 text-rose-500 border-rose-100/50' : 'bg-emerald-50 text-emerald-500 border-emerald-100/50'}`}>
                      {isOut ? <ArrowDownCircle size={20} strokeWidth={1.5}/> : <ArrowUpCircle size={20} strokeWidth={1.5}/>}
                    </div>
                    <div className="mt-0.5">
                      <h4 className="font-bold text-slate-900 text-[15px]">{item.deskripsi}</h4>
                      <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                        <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{item.kategori}</span>
                        <span className="text-[12px] font-medium text-slate-400 flex items-center gap-1.5">
                          <Calendar size={12} strokeWidth={1.5}/> {item.tanggal}
                        </span>
                        <span className="text-[12px] font-medium text-slate-400">
                          • FO: {item.users?.nama?.split(' ')[0] || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="text-[11px] font-medium text-slate-400 mb-0.5">{isOut ? 'Kredit (Keluar)' : 'Debit (Masuk)'}</p>
                      <p className={`font-extrabold tracking-tight ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isOut ? '- ' : '+ '}Rp {Number(item.nominal).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDelete(item.id, item.deskripsi)} 
                      className="p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 size={18} strokeWidth={1.5}/>
                    </button>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL TAMBAH TRANSAKSI KAS */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Catat Kas Kecil</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-full transition-colors focus:outline-none">
                <X size={20} strokeWidth={1.5}/>
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-6 space-y-5 bg-slate-50/50">
              
              {/* SELECTOR IN / OUT - Premium Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-200/50 rounded-2xl">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, jenis: 'IN'})}
                  className={`py-2.5 rounded-xl font-bold text-[13px] transition-all focus:outline-none ${formData.jenis === 'IN' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Uang Masuk (IN)
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, jenis: 'OUT'})}
                  className={`py-2.5 rounded-xl font-bold text-[13px] transition-all focus:outline-none ${formData.jenis === 'OUT' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Pengeluaran (OUT)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tanggal</label>
                  <input 
                    type="date" 
                    value={formData.tanggal} 
                    onChange={e => setFormData({...formData, tanggal: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl font-medium text-[15px] outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all" 
                    required 
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5"><Tag size={14} strokeWidth={1.5}/> Kategori</label>
                  <input 
                    type="text" 
                    list="kategori-kas"
                    placeholder="Bebas Ketik..."
                    value={formData.kategori} 
                    onChange={e => setFormData({...formData, kategori: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl font-medium text-[15px] outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all" 
                    required 
                  />
                  <datalist id="kategori-kas">
                    <option value="Barang habis pakai" />
                    <option value="ATK (Kertas/Pena)" />
                    <option value="Kebersihan" />
                    <option value="Top Up Kasir" />
                    <option value="Titipan Owner" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5"><FileText size={14} strokeWidth={1.5}/> Deskripsi Lengkap</label>
                <textarea 
                  rows="2" 
                  placeholder={formData.jenis === 'OUT' ? "Contoh: Beli sabun cuci tangan" : "Contoh: Kembalian belanja / Topup"} 
                  value={formData.deskripsi} 
                  onChange={e => setFormData({...formData, deskripsi: e.target.value})} 
                  className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl font-medium text-[15px] outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all resize-none placeholder-slate-400" 
                  required
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5"><DollarSign size={14} strokeWidth={1.5}/> Nominal (Rp)</label>
                <input 
                  type="number" 
                  placeholder="50000" 
                  value={formData.nominal} 
                  onChange={e => setFormData({...formData, nominal: e.target.value})} 
                  className={`w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl font-extrabold text-lg outline-none focus:ring-4 transition-all placeholder-slate-300 ${formData.jenis === 'OUT' ? 'text-rose-600 focus:border-rose-400 focus:ring-rose-50' : 'text-emerald-600 focus:border-emerald-400 focus:ring-emerald-50'}`} 
                  required 
                />
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isSaving} className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl font-semibold text-[15px] flex justify-center items-center gap-2 shadow-md shadow-slate-900/10 transition-all focus:outline-none">
                  {isSaving ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin"/> : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}