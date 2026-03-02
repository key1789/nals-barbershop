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

  // ==========================================
  // FUNGSI TARIK DATA (KHUSUS PRODUK)
  // ==========================================
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products_services')
        .select('*')
        .eq('tipe', 'Product') // Cuma narik yang tipenya Product
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

  // ==========================================
  // FUNGSI HANDLER PRODUK
  // ==========================================
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
        payload.stok = 0; // Stok cuma 0 di awal, ngisinya lewat mutasi
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

  // ==========================================
  // FUNGSI HANDLER STOCK OPNAME
  // ==========================================
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

      // Catat di tabel CCTV mutasi (stock_logs)
      await supabase.from('stock_logs').insert([{ 
        product_id: stockForm.product_id, 
        jenis_mutasi: stockForm.jenis_mutasi, 
        qty: inputQty, 
        keterangan: stockForm.keterangan, 
        user_id: user?.id || null 
      }]);
      
      // Update Saldo Akhir
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

  // ==========================================
  // GROUPING UI (KATEGORI)
  // ==========================================
  const productsByCategory = productsList.reduce((acc, prod) => {
    const kat = prod.kategori || 'Lainnya';
    if (!acc[kat]) acc[kat] = [];
    acc[kat].push(prod);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-in fade-in duration-300 min-h-[100dvh]">
      
      {/* HEADER TAB */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-4 gap-4">
         <div>
            <h2 className="font-black text-slate-800 text-lg flex items-center gap-2">
               <Package className="text-emerald-500"/> Gudang Retail
            </h2>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Master data barang & stok</p>
         </div>
         <div className="flex gap-2 w-full md:w-auto">
            <button 
               onClick={() => setIsStockModalOpen(true)} 
               className="flex-1 md:flex-none bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
               <ClipboardList size={18} /> Stock Opname
            </button>
            <button 
               onClick={() => { 
                  setMode('add'); 
                  setFormData({ id: null, nama_item: '', tipe: 'Product', kategori: 'Grooming', harga_jual: 0, hpp: 0, vendor_name: '', is_active: true }); 
                  setIsModalOpen(true); 
               }} 
               className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
               <Plus size={18} /> Produk Baru
            </button>
         </div>
      </div>

      {/* LIST KARTU PRODUK BY KATEGORI */}
      {isLoading ? (
        <div className="text-center p-8 text-slate-400 animate-pulse font-bold">Memuat gudang...</div>
      ) : productsList.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-sm">Belum ada produk yang didaftarkan.</div>
      ) : (
        <div className="space-y-6">
          {Object.keys(productsByCategory).map(kategori => (
            <div key={kategori} className="space-y-3">
               <h2 className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                 <Box size={16} className="text-emerald-400"/> {kategori}
               </h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {productsByCategory[kategori].map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => { setMode('edit'); setFormData(item); setIsModalOpen(true); }} 
                      className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer ${!item.is_active ? 'opacity-50 grayscale-[50%] bg-slate-50' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-inner ${item.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                          <Package size={24}/>
                        </div>
                        <div>
                          <h3 className={`font-bold ${item.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{item.nama_item}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Rp {Number(item.harga_jual).toLocaleString('id-ID')}</span>
                            <span className={`text-xs font-bold flex items-center gap-1 px-2 py-0.5 rounded-md ${item.stok <= 5 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-emerald-50 text-emerald-600'}`}>
                              <Box size={12}/> Stok: {item.stok}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(item.id, item.is_active); }} className="text-slate-400 hover:text-emerald-600 transition-colors">
                        {item.is_active ? <ToggleRight size={36} className="text-emerald-500" /> : <ToggleLeft size={36} />}
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
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div
            ref={modalRef}
            tabIndex={0}
            className="bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
          >
            <div className="p-5 border-b flex justify-between items-center bg-emerald-50 border-emerald-100">
              <h2 className="font-black text-emerald-900 flex items-center gap-2">
                 <Package size={20} className="text-emerald-600"/> 
                 {mode === 'add' ? `Tambah Produk Baru` : `Edit Produk`}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white rounded-full text-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400" aria-label="Tutup modal"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Produk</label>
                <input required value={formData.nama_item} onChange={(e) => setFormData({...formData, nama_item: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 transition-colors" placeholder="Misal: Pomade Suavecito..." />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga Jual (Rp)</label>
                  <input type="number" required value={formData.harga_jual} onChange={(e) => setFormData({...formData, harga_jual: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                  <select value={formData.kategori} onChange={(e) => setFormData({...formData, kategori: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 transition-colors">
                    <option value="Grooming">Grooming (Rambut/Wajah)</option>
                    <option value="F&B">F&B (Makanan/Minuman)</option>
                    <option value="Other">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                {mode === 'edit' && (
                   <div className="bg-amber-100 text-amber-800 p-3 rounded-xl text-xs font-bold text-center border border-amber-200">
                     ⚠️ Stok saat ini: {formData.stok}.<br/>Gunakan menu <span className="inline-flex items-center gap-1 bg-amber-200 px-1 rounded"><ClipboardList size={10}/> Stock Opname</span> untuk mengubah stok fisik.
                   </div>
                )}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">HPP (Modal Kulakan)</label>
                  <input type="number" value={formData.hpp} onChange={(e) => setFormData({...formData, hpp: e.target.value})} className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Supplier / Vendor</label>
                  <input value={formData.vendor_name} onChange={(e) => setFormData({...formData, vendor_name: e.target.value})} className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 transition-colors" />
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white py-3.5 rounded-xl font-black mt-4 shadow-lg shadow-emerald-200 active:scale-95 transition-all flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" aria-label="Simpan Katalog Produk">
                {isSaving ? <Loader2 className="animate-spin" size={20}/> : 'Simpan Katalog Produk'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* =========================================
          MODAL STOCK OPNAME
          ========================================= */}
      {isStockModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onClick={e => { if (e.target === e.currentTarget) setIsStockModalOpen(false); }}
        >
          <div
            ref={stockModalRef}
            tabIndex={0}
            className="bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-amber-400 outline-none"
          >
            <div className="p-5 border-b bg-amber-50 border-amber-100 flex justify-between items-center">
              <h2 className="font-black text-amber-800 flex items-center gap-2"><ClipboardList size={20} className="text-amber-600"/> Form Stock Opname</h2>
              <button onClick={() => setIsStockModalOpen(false)} className="p-1 hover:bg-white rounded-full text-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400" aria-label="Tutup modal"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveStock} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Produk</label>
                <select required value={stockForm.product_id} onChange={(e) => setStockForm({...stockForm, product_id: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-amber-500">
                  <option value="" disabled>-- Pilih Barang --</option>
                  {productsList.map(prod => (
                    <option key={prod.id} value={prod.id}>{prod.nama_item} (Sisa Stok: {prod.stok})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Mutasi</label>
                  <select required value={stockForm.jenis_mutasi} onChange={(e) => setStockForm({...stockForm, jenis_mutasi: e.target.value})} className={`w-full mt-1 p-3 rounded-xl text-sm font-black outline-none border ${stockForm.jenis_mutasi === 'Masuk' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : stockForm.jenis_mutasi === 'Keluar' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    <option value="Masuk">Masuk (+)</option>
                    <option value="Keluar">Keluar (-)</option>
                    <option value="Penyesuaian">Penyesuaian (=)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jumlah (Qty)</label>
                  <input type="number" min="0" required value={stockForm.qty} onChange={(e) => setStockForm({...stockForm, qty: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-amber-500" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan / Alasan</label>
                <textarea required value={stockForm.keterangan} onChange={(e) => setStockForm({...stockForm, keterangan: e.target.value})} rows="2" className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-amber-500" placeholder="Misal: Kulakan dari supplier A / Barang rusak..."></textarea>
              </div>

              <button type="submit" disabled={isStockSubmitting} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-black shadow-lg shadow-amber-200 mt-4 active:scale-95 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-400" aria-label="Proses Mutasi Stok">
                {isStockSubmitting ? <Loader2 className="animate-spin" size={20}/> : <ArrowRightLeft size={18} />} 
                {isStockSubmitting ? 'Memproses...' : 'Proses Mutasi Stok'}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}