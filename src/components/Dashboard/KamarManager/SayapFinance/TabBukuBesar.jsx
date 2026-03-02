import React, { useState, useEffect } from 'react';
import { 
  LockKeyhole, Plus, Calendar, Search, 
  Trash2, Loader2, DollarSign, FileText, Tag, X
} from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

export default function TabBukuBesar({ user }) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentDay = String(currentDate.getDate()).padStart(2, '0');
  const todayLocal = `${currentYear}-${currentMonth}-${currentDay}`; // Timezone-safe date

  const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${currentMonth}`);
  
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State Modal Tambah
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tanggal: todayLocal,
    kategori: 'Operasional',
    deskripsi: '',
    nominal: ''
  });

  const kategoriOptions = ['Sewa Tempat', 'Operasional', 'Pajak & Legal', 'Marketing & Ads', 'Aset & Inventaris', 'Lainnya'];

  // ==========================================
  // 1. FETCH DATA BUKU BESAR
  // ==========================================
  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      // PERBAIKAN: Menghindari UTC Timezone Shift Bug
      const year = selectedMonth.split('-')[0];
      const month = selectedMonth.split('-')[1];
      const lastDay = new Date(year, month, 0).getDate(); // Cari tanggal terakhir di bulan itu
      
      const startOfMonth = `${year}-${month}-01`;
      const endOfMonth = `${year}-${month}-${lastDay}`;

      const { data, error } = await supabase
        .from('management_expenses')
        .select('*') // Narik data langsung tanpa harus maksain relasi yang rawan error
        .gte('tanggal', startOfMonth)
        .lte('tanggal', endOfMonth)
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error("Gagal menarik Buku Besar:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedMonth]);

  // ==========================================
  // 2. SIMPAN PENGELUARAN BARU
  // ==========================================
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!formData.nominal || formData.nominal <= 0) return alert("Nominal harus diisi dengan benar!");
    if (!formData.deskripsi) return alert("Deskripsi pengeluaran wajib diisi!");

    setIsSaving(true);
    try {
      const payload = {
        tanggal: formData.tanggal,
        kategori: formData.kategori,
        deskripsi: formData.deskripsi,
        nominal: Number(formData.nominal),
        user_id: user?.id
      };

      // Safety net kalau lu nambahin outlet_id ke depannya
      if (user?.outlet_id) payload.outlet_id = user.outlet_id;

      const { error } = await supabase.from('management_expenses').insert([payload]);
      if (error) throw error;

      setIsModalOpen(false);
      setFormData({ ...formData, deskripsi: '', nominal: '' }); 
      fetchExpenses(); 
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // 3. HAPUS PENGELUARAN
  // ==========================================
  const handleDelete = async (id, deskripsi) => {
    if (!window.confirm(`Yakin ingin menghapus catatan: "${deskripsi}"?`)) return;
    try {
      const { error } = await supabase.from('management_expenses').delete().eq('id', id);
      if (error) throw error;
      fetchExpenses();
    } catch (err) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  const totalPengeluaran = expenses.reduce((sum, item) => sum + Number(item.nominal), 0);

  return (
    <div className="space-y-6 px-1 md:px-2 animate-in fade-in duration-300">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mt-2">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100/50">
              <LockKeyhole size={22} strokeWidth={1.5}/>
            </div>
            Management Expenses
          </h2>
          <p className="text-[14px] text-slate-500 font-medium mt-1.5 md:ml-[54px]">Pencatatan khusus pengeluaran level manajemen</p>
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
            <span className="hidden md:inline text-[14px]">Tambah Data</span>
          </button>
        </div>
      </div>

      {/* SUMMARY CARD (Soft Dark Theme) */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden flex justify-between items-center group">
        <DollarSign className="absolute -right-6 -bottom-8 text-rose-500 opacity-20 group-hover:scale-110 transition-transform duration-500" size={160} strokeWidth={1}/>
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Total Pengeluaran Bulan Ini</p>
          <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Rp {totalPengeluaran.toLocaleString('id-ID')}
          </h3>
        </div>
      </div>

      {/* LIST PENGELUARAN */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center"><Loader2 className="animate-spin text-slate-400 mx-auto" size={32} strokeWidth={1.5}/></div>
        ) : expenses.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <Search className="text-slate-300" size={28} strokeWidth={1.5}/>
            </div>
            <p className="text-[15px] font-medium text-slate-500">Belum ada pengeluaran dicatat bulan ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {expenses.map((item) => (
              <div key={item.id} className="p-5 md:px-6 md:py-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-50/50 transition-colors group">
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-100/50">
                    <DollarSign size={20} strokeWidth={1.5}/>
                  </div>
                  <div className="mt-0.5">
                    <h4 className="font-bold text-slate-900 text-[15px]">{item.deskripsi}</h4>
                    <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                      <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{item.kategori}</span>
                      <span className="text-[12px] font-medium text-slate-400 flex items-center gap-1.5">
                        <Calendar size={12} strokeWidth={1.5}/> {item.tanggal}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] font-medium text-slate-400 mb-0.5">Nominal</p>
                    <p className="font-extrabold text-slate-900 tracking-tight">Rp {Number(item.nominal).toLocaleString('id-ID')}</p>
                  </div>
                  <button 
                    onClick={() => handleDelete(item.id, item.deskripsi)} 
                    className="p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 size={18} strokeWidth={1.5}/>
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL TAMBAH PENGELUARAN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Catat Pengeluaran</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-full transition-colors focus:outline-none">
                <X size={20} strokeWidth={1.5}/>
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-6 space-y-5 bg-slate-50/50">
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
                <select 
                  value={formData.kategori} 
                  onChange={e => setFormData({...formData, kategori: e.target.value})} 
                  className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl font-medium text-[15px] outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all appearance-none"
                >
                  {kategoriOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5"><FileText size={14} strokeWidth={1.5}/> Deskripsi Lengkap</label>
                <textarea 
                  rows="2" 
                  placeholder="Contoh: Bayar Iklan IG Bulan Ini" 
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
                  placeholder="500000" 
                  value={formData.nominal} 
                  onChange={e => setFormData({...formData, nominal: e.target.value})} 
                  className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl font-extrabold text-slate-900 text-lg outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all placeholder-slate-300" 
                  required 
                />
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isSaving} className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl font-semibold text-[15px] flex justify-center items-center gap-2 shadow-md shadow-slate-900/10 transition-all focus:outline-none">
                  {isSaving ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin"/> : 'Simpan ke Buku Besar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}