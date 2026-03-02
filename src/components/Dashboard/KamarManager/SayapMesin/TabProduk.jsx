import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Box, ClipboardList, ToggleRight, ToggleLeft, X, ArrowRightLeft, Loader2 } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

export default function TabProduk({ user }) {
  const [productsList, setProductsList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // === STATE MODAL PRODUK ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState('add');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ 
    id: null, nama_item: '', tipe: 'Product', kategori: 'Grooming', 
    harga_jual: 0, hpp: 0, vendor_name: '', stok: 0, is_active: true 
  });
  const modalRef = useRef(null);

  // === STATE MODAL STOCK OPNAME ===
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isStockSubmitting, setIsStockSubmitting] = useState(false);
  const [stockForm, setStockForm] = useState({ product_id: '', jenis_mutasi: 'Masuk', qty: '', keterangan: '' });
  const stockModalRef = useRef(null);

  // Lock scroll & ESC & auto-focus untuk semua modal
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (isStockModalOpen) setIsStockModalOpen(false);
      }
    };
    if (isModalOpen || isStockModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKey);
      setTimeout(() => {
        if (isModalOpen && modalRef.current) modalRef.current.focus();
        if (isStockModalOpen && stockModalRef.current) stockModalRef.current.focus();
      }, 10);
    } else {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [isModalOpen, isStockModalOpen]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products_services')
        .select('*')
        .eq('tipe', 'Product') 
        .order('nama_item', { ascending: true });
        
      if (error) throw error;
      setProductsList(data || []);
    } catch (error) {
      console.error("Gagal narik data produk:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggleStatus = async (id, currentStatus) => { 
    try { 
      await supabase.from('products_services').update({ is_active: !currentStatus }).eq('id', id); 
      fetchData(); 
    } catch (error) { alert("Gagal update status!"); } 
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault(); 
    setIsSaving(true);
    try {
      const payload = { 
        nama_item: formData.nama_item, 
        tipe: 'Product', 
        kategori: formData.kategori, 
        harga_jual: formData.harga_jual, 
        hpp: formData.hpp,
        vendor_name: formData.vendor_name,
        is_active: formData.is_active 
      };

      if (mode === 'add') { 
        payload.stok = 0; 
        await supabase.from('products_services').insert([payload]); 
      } else { 
        await supabase.from('products_services').update(payload).eq('id', formData.id); 
      }
      setIsModalOpen(false); 
      fetchData();
    } catch (error) { 
      alert("Gagal menyimpan produk: " + error.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleSaveStock = async (e) => {
    e.preventDefault(); 
    if (!stockForm.product_id) return alert("Pilih produknya dulu!");
    if (!stockForm.qty || stockForm.qty < 0) return alert("Qty tidak valid!");

    setIsStockSubmitting(true);
    try {
      const targetProduct = productsList.find(i => i.id === stockForm.product_id); 
      const currentStok = targetProduct.stok || 0; 
      const inputQty = parseInt(stockForm.qty, 10);
      
      let newStok = currentStok;
      if (stockForm.jenis_mutasi === 'Masuk') newStok = currentStok + inputQty;
      else if (stockForm.jenis_mutasi === 'Keluar') newStok = currentStok - inputQty;
      else if (stockForm.jenis_mutasi === 'Penyesuaian') newStok = inputQty;

      if (newStok < 0) throw new Error("Stok fisik tidak cukup sampai minus!");

      await supabase.from('stock_logs').insert([{ 
        product_id: stockForm.product_id, 
        jenis_mutasi: stockForm.jenis_mutasi, 
        qty: inputQty, 
        keterangan: stockForm.keterangan, 
        user_id: user?.id || null 
      }]);
      
      await supabase.from('products_services').update({ stok: newStok }).eq('id', stockForm.product_id);
      
      setIsStockModalOpen(false); 
      fetchData(); 
      setStockForm({ product_id: '', jenis_mutasi: 'Masuk', qty: '', keterangan: '' });
      alert("Mutasi Stok Berhasil Dicatat!");
    } catch (error) { 
      alert("Gagal Opname: " + error.message); 
    } finally { 
      setIsStockSubmitting(false); 
    }
  };

  const productsByCategory = productsList.reduce((acc, prod) => {
    const kat = prod.kategori || 'Lainnya';
    if (!acc[kat]) acc[kat] = [];
    acc[kat].push(prod);
    return acc;
  }, {});

  return (
    <div className="space-y-6 px-1 md:px-2 animate-in fade-in duration-300 min-h-[100dvh]">
      
      {/* HEADER TAB */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200/80 pb-5 gap-4 mt-2">
         <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
               <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-500 border border-emerald-100/50">
                 <Package size={22} strokeWidth={1.5}/>
               </div>
               Gudang Retail
            </h2>
            <p className="text-[14px] font-medium text-slate-500 mt-1.5 md:ml-[54px]">Master data barang dan persediaan stok</p>
         </div>
         <div className="flex gap-3 w-full md:w-auto">
            <button 
               onClick={() => setIsStockModalOpen(true)} 
               className="flex-1 md:flex-none bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 px-5 py-3 rounded-2xl font-semibold text-[14px] shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 focus:outline-none"
            >
               <ClipboardList size={18} strokeWidth={1.5} /> Stock Opname
            </button>
            <button 
               onClick={() => { 
                  setMode('add'); 
                  setFormData({ id: null, nama_item: '', tipe: 'Product', kategori: 'Grooming', harga_jual: 0, hpp: 0, vendor_name: '', is_active: true }); 
                  setIsModalOpen(true); 
               }} 
               className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl font-semibold text-[14px] shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 active:scale-95 focus:outline-none"
            >
               <Plus size={18} strokeWidth={1.5} /> Produk Baru
            </button>
         </div>
      </div>

      {/* LIST KARTU PRODUK BY KATEGORI */}
      {isLoading ? (
        <div className="text-center p-12 text-slate-400 animate-pulse font-medium flex flex-col items-center">
          <Loader2 size={32} strokeWidth={1.5} className="animate-spin mb-3 text-emerald-400"/>
          Memuat gudang...
        </div>
      ) : productsList.length === 0 ? (
        <div className="text-center p-16 border border-dashed border-slate-300 bg-slate-50/50 rounded-3xl text-slate-500 font-medium flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
            <Package size={28} strokeWidth={1.5} className="text-slate-400"/>
          </div>
          Belum ada produk yang didaftarkan.
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(productsByCategory).map(kategori => (
            <div key={kategori} className="space-y-4">
               <h2 className="flex items-center gap-2 text-[13px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                 <Box size={16} strokeWidth={1.5} className="text-emerald-500"/> {kategori}
               </h2>
               
               {/* PERBAIKAN LAYOUT: 
                 Pakai xl:grid-cols-3 dan md:grid-cols-2 biar kotak punya nafas lega di PC.
               */}
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                 {productsByCategory[kategori].map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => { setMode('edit'); setFormData(item); setIsModalOpen(true); }} 
                      className={`bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-200/60 flex items-center justify-between gap-3 transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer ${!item.is_active ? 'opacity-60 grayscale-[40%] bg-slate-50' : ''}`}
                    >
                      
                      {/* PERBAIKAN: min-w-0 flex-1 memaksa teks gak nabrak tombol toggle */}
                      <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                        
                        {/* PERBAIKAN: Hapus text-white yang bikin konflik warna */}
                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 border ${item.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                          <Package size={24} strokeWidth={1.5}/>
                        </div>

                        {/* Container teks dengan truncate dan wrap */}
                        <div className="min-w-0 flex-1">
                          <h3 className={`font-bold text-[14px] md:text-[15px] truncate ${item.is_active ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                            {item.nama_item}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="text-[11px] md:text-[12px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full truncate">
                              Rp {Number(item.harga_jual).toLocaleString('id-ID')}
                            </span>
                            <span className={`text-[11px] md:text-[12px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full border shrink-0 ${item.stok <= 5 ? 'bg-rose-50 border-rose-100 text-rose-600 animate-pulse' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                              <Box size={12} strokeWidth={1.5}/> Stok: {item.stok}
                            </span>
                          </div>
                        </div>

                      </div>

                      {/* Tombol Toggle aman karena dapet shrink-0 */}
                      <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(item.id, item.is_active); }} className="text-slate-400 hover:text-emerald-600 transition-colors focus:outline-none shrink-0 ml-1">
                        {item.is_active ? <ToggleRight size={32} strokeWidth={1.5} className="text-emerald-500" /> : <ToggleLeft size={32} strokeWidth={1.5} />}
                      </button>

                    </div>
                 ))}
               </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================
          MODAL FORM PRODUK BARU/EDIT
          ========================================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div
            ref={modalRef}
            tabIndex={0}
            className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="font-extrabold text-slate-900 text-lg tracking-tight flex items-center gap-2">
                 <Package size={20} strokeWidth={1.5} className="text-emerald-500"/> 
                 {mode === 'add' ? `Tambah Produk Baru` : `Edit Produk`}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors focus:outline-none" aria-label="Tutup modal"><X size={20} strokeWidth={1.5} /></button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-5 bg-slate-50/50 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nama Produk</label>
                {/* PERBAIKAN NULL WARNING: || '' */}
                <input required value={formData.nama_item || ''} onChange={(e) => setFormData({...formData, nama_item: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all" placeholder="Misal: Pomade Suavecito..." />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Harga Jual (Rp)</label>
                  {/* PERBAIKAN NULL WARNING: || '' */}
                  <input type="number" required value={formData.harga_jual || ''} onChange={(e) => setFormData({...formData, harga_jual: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-bold text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Kategori</label>
                  {/* PERBAIKAN NULL WARNING: || 'Grooming' */}
                  <select value={formData.kategori || 'Grooming'} onChange={(e) => setFormData({...formData, kategori: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all appearance-none">
                    <option value="Grooming">Grooming (Rambut/Wajah)</option>
                    <option value="F&B">F&B (Makanan/Minuman)</option>
                    <option value="Other">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 p-5 bg-emerald-50/50 border border-emerald-100 rounded-3xl">
                {mode === 'edit' && (
                   <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl text-[13px] font-medium text-center border border-amber-200/60 leading-relaxed">
                     ⚠️ Stok saat ini: <strong>{formData.stok || 0}</strong>.<br/>Gunakan menu <span className="inline-flex items-center gap-1 bg-amber-100 px-1.5 rounded-md font-semibold"><ClipboardList size={12} strokeWidth={1.5}/> Stock Opname</span> untuk mengubah stok fisik.
                   </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-emerald-800 mb-1.5 block">HPP (Modal Kulakan)</label>
                  {/* PERBAIKAN NULL WARNING: || '' */}
                  <input type="number" value={formData.hpp || ''} onChange={(e) => setFormData({...formData, hpp: e.target.value})} className="w-full px-4 py-3 bg-white border border-emerald-200/60 rounded-2xl text-[15px] font-bold text-emerald-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-emerald-800 mb-1.5 block">Nama Supplier / Vendor</label>
                  {/* PERBAIKAN NULL WARNING: || '' */}
                  <input value={formData.vendor_name || ''} onChange={(e) => setFormData({...formData, vendor_name: e.target.value})} className="w-full px-4 py-3 bg-white border border-emerald-200/60 rounded-2xl text-[15px] font-medium text-emerald-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" />
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isSaving} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white py-4 rounded-2xl font-bold text-[15px] shadow-md shadow-slate-900/10 active:scale-[0.98] transition-all flex justify-center items-center gap-2 focus:outline-none focus:ring-4 focus:ring-slate-200" aria-label="Simpan Katalog Produk">
                  {isSaving ? <Loader2 className="animate-spin" size={20} strokeWidth={1.5}/> : 'Simpan Katalog Produk'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* =========================================
          MODAL STOCK OPNAME
          ========================================= */}
      {isStockModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onClick={e => { if (e.target === e.currentTarget) setIsStockModalOpen(false); }}
        >
          <div
            ref={stockModalRef}
            tabIndex={0}
            className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-amber-200 outline-none"
          >
            <div className="px-6 py-5 border-b bg-amber-50 border-amber-100 flex justify-between items-center">
              <h2 className="font-extrabold text-amber-900 text-lg tracking-tight flex items-center gap-2">
                <ClipboardList size={20} strokeWidth={1.5} className="text-amber-600"/> Form Stock Opname
              </h2>
              <button onClick={() => setIsStockModalOpen(false)} className="p-2 hover:bg-amber-100 rounded-full text-amber-700 transition-colors focus:outline-none"><X size={20} strokeWidth={1.5}/></button>
            </div>

            <form onSubmit={handleSaveStock} className="p-6 space-y-5 bg-white">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Pilih Produk</label>
                <select required value={stockForm.product_id} onChange={(e) => setStockForm({...stockForm, product_id: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all appearance-none">
                  <option value="" disabled>-- Pilih Barang --</option>
                  {productsList.map(prod => (
                    <option key={prod.id} value={prod.id}>{prod.nama_item} (Sisa Stok: {prod.stok})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Jenis Mutasi</label>
                  <select required value={stockForm.jenis_mutasi} onChange={(e) => setStockForm({...stockForm, jenis_mutasi: e.target.value})} className={`w-full px-4 py-3 rounded-2xl text-[15px] font-bold outline-none border transition-all appearance-none ${stockForm.jenis_mutasi === 'Masuk' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : stockForm.jenis_mutasi === 'Keluar' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    <option value="Masuk">Masuk (+)</option>
                    <option value="Keluar">Keluar (-)</option>
                    <option value="Penyesuaian">Penyesuaian (=)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Jumlah (Qty)</label>
                  <input type="number" min="0" required value={stockForm.qty} onChange={(e) => setStockForm({...stockForm, qty: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-bold text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Keterangan / Alasan</label>
                <textarea required value={stockForm.keterangan} onChange={(e) => setStockForm({...stockForm, keterangan: e.target.value})} rows="2" className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all resize-none" placeholder="Misal: Kulakan dari supplier A..."></textarea>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isStockSubmitting} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl font-bold text-[15px] shadow-md shadow-amber-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-amber-100" aria-label="Proses Mutasi Stok">
                  {isStockSubmitting ? <Loader2 className="animate-spin" size={20} strokeWidth={1.5}/> : <ArrowRightLeft size={18} strokeWidth={1.5}/>} 
                  {isStockSubmitting ? 'Memproses...' : 'Proses Mutasi Stok'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}