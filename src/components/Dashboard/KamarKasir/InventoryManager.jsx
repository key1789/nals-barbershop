import React, { useState, useEffect } from 'react';
import { 
  Package, Scissors, History, Search, Plus, 
  ArrowDownRight, ArrowUpRight, Loader2, XCircle, AlertCircle, User
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const InventoryManager = ({ user }) => {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State untuk Modal Tambah Stok
  const [restockModal, setRestockModal] = useState({ isOpen: false, item: null, qty: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Format Rupiah
  const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  const getCleanType = (tipe) => (tipe || 'service').toLowerCase().trim();

  // 1. Tarik Data Katalog & Log Mutasi dari Supabase
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Tarik Master Produk & Jasa
      const { data: productsData } = await supabase
        .from('products_services')
        .select('*')
        .eq('is_active', true)
        .order('nama_item', { ascending: true });
      if (productsData) setItems(productsData);

      // Tarik Log Mutasi Hari Ini (Biar kasir bisa mantau)
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      
      // PERBAIKAN: Hilangkan users(nama) biar nggak error 400 karena relasi FK belum disetting
      const { data: logsData, error: logErr } = await supabase
        .from('stock_logs')
        .select('*, products_services(nama_item)')
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false });
        
      if (logErr) console.error("Error Log:", logErr.message);
      if (logsData) setLogs(logsData);

    } catch (error) {
      console.error("Gagal tarik data inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Fungsi Eksekusi Tambah Stok (Restock dari Supplier)
  const handleAddStock = async () => {
    const qtyToAdd = parseInt(restockModal.qty);
    if (!qtyToAdd || qtyToAdd <= 0) return alert("Masukkan jumlah stok yang valid (Minimal 1).");
    
    setIsSaving(true);
    try {
      const targetItem = restockModal.item;
      const newStock = (targetItem.stok || 0) + qtyToAdd;

      // Update angka stok di tabel master
      await supabase
        .from('products_services')
        .update({ stok: newStock })
        .eq('id', targetItem.id);

      // Catat di buku logbook
      await supabase
        .from('stock_logs')
        .insert({
          user_id: user.id,
          product_id: targetItem.id,
          qty: qtyToAdd,
          jenis_mutasi: 'Restock (In)',
          keterangan: `Barang Masuk / Tambah Stok via Kasir`
        });

      // Tutup modal & Refresh Layar
      setRestockModal({ isOpen: false, item: null, qty: '' });
      fetchData(); 
    } catch (error) {
      alert("Gagal menambah stok: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Filter & Grouping Data
  const filteredItems = items.filter(item => item.nama_item.toLowerCase().includes(searchQuery.toLowerCase()));
  
  // Pisah Jasa dan Produk
  const listLayanan = filteredItems.filter(i => getCleanType(i.tipe) !== 'product');
  const listProduk = filteredItems.filter(i => getCleanType(i.tipe) === 'product');

  // Grouping Produk berdasarkan 'kategori' (kalau ada) atau 'tipe'
  const groupedProducts = listProduk.reduce((acc, item) => {
    const groupName = item.kategori || item.tipe || 'Produk Umum';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-full bg-[#f8fafc] font-sans overflow-hidden">
      
      {/* AREA KIRI: MASTER KATALOG (PRODUK & JASA) */}
      <div className="flex-1 flex flex-col p-6 md:p-8 overflow-hidden">
        
        {/* Header & Search */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex justify-between items-center mb-6 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic flex items-center gap-3">
              <Package className="text-indigo-600"/> Master Katalog
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Stok & Harga (View Only)</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
            <input 
              type="text" 
              placeholder="Cari item..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* List Data (Scrollable) */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 pb-10">
          {isLoading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>
          ) : (
            <>
              {/* SECTION: PRODUK RETAIL (Bisa Tambah Stok) */}
              <div>
                <h3 className="text-sm font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 border-b-2 border-emerald-100 pb-2">
                  <Package size={16}/> Produk Retail (Barang Fisik)
                </h3>
                
                {Object.keys(groupedProducts).length === 0 ? (
                   <p className="text-slate-400 text-xs font-bold italic">Tidak ada produk ditemukan.</p>
                ) : (
                  Object.keys(groupedProducts).map(group => (
                    <div key={group} className="mb-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{group}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedProducts[group].map(item => {
                          const isLowStock = item.stok <= 5;
                          return (
                            <div key={item.id} className="bg-white p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-200 transition-colors shadow-sm flex flex-col justify-between group">
                              <div>
                                <h4 className="font-black text-slate-800 uppercase text-sm mb-1">{item.nama_item}</h4>
                                <p className="text-xs font-bold text-slate-500">{formatIDR(item.harga_jual)}</p>
                              </div>
                              <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                                <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isLowStock ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                  {isLowStock && <AlertCircle size={12}/>} Stok: {item.stok || 0}
                                </div>
                                {/* TOMBOL TAMBAH STOK (Khusus Produk) */}
                                <button 
                                  onClick={() => setRestockModal({ isOpen: true, item: item, qty: '' })}
                                  className="w-8 h-8 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg flex items-center justify-center transition-all shadow-sm"
                                  title="Tambah Stok (Barang Masuk)"
                                >
                                  <Plus size={16} strokeWidth={3}/>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* SECTION: JASA / LAYANAN (View Only Murni) */}
              <div className="mt-10">
                <h3 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 border-b-2 border-indigo-100 pb-2">
                  <Scissors size={16}/> Jasa & Layanan Cukur
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {listLayanan.length === 0 ? (
                    <p className="text-slate-400 text-xs font-bold italic col-span-full">Tidak ada layanan ditemukan.</p>
                  ) : (
                    listLayanan.map(item => (
                      <div key={item.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity">
                        <div>
                          <h4 className="font-black text-slate-800 uppercase text-xs mb-1">{item.nama_item}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.kategori || item.tipe}</p>
                        </div>
                        <p className="text-sm font-black text-indigo-600">{formatIDR(item.harga_jual)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* AREA KANAN: BUKU LOG MUTASI */}
      <div className="w-[380px] bg-slate-900 text-white flex flex-col border-l border-slate-800 shadow-2xl relative z-10">
        <div className="p-8 border-b border-slate-800 shrink-0">
          <h3 className="text-xl font-black italic uppercase tracking-widest flex items-center gap-3">
            <History size={24} className="text-indigo-400"/> Log Mutasi
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Aktivitas Gudang Hari Ini</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {isLoading ? (
            <p className="text-center text-slate-500 text-xs font-bold mt-10">Memuat log...</p>
          ) : logs.length === 0 ? (
            <div className="text-center mt-10 p-6 border-2 border-dashed border-slate-700 rounded-3xl">
              <History size={40} className="mx-auto text-slate-600 mb-3"/>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Belum ada pergerakan stok hari ini.</p>
            </div>
          ) : (
            logs.map(log => {
              // Styling berdasarkan jenis mutasi
              const isIn = log.qty > 0;
              const isSale = log.jenis_mutasi.includes('Sale') || log.jenis_mutasi.includes('Keluar');
              const isRestock = log.jenis_mutasi.includes('Restock');
              
              let colorClass = 'text-slate-300';
              let bgIcon = 'bg-slate-800';
              if (isIn && isRestock) { colorClass = 'text-emerald-400'; bgIcon = 'bg-emerald-500/20 text-emerald-400'; }
              else if (isIn) { colorClass = 'text-amber-400'; bgIcon = 'bg-amber-500/20 text-amber-400'; } 
              else if (!isIn) { colorClass = 'text-rose-400'; bgIcon = 'bg-rose-500/20 text-rose-400'; } 

              return (
                <div key={log.id} className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 flex gap-4 items-start">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgIcon}`}>
                    {isIn ? <ArrowDownRight size={18}/> : <ArrowUpRight size={18}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-black uppercase text-white truncate pr-2">{log.products_services?.nama_item || 'Item Terhapus'}</p>
                      <p className={`text-sm font-black ${colorClass}`}>
                        {isIn ? '+' : ''}{log.qty}
                      </p>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{log.jenis_mutasi}</p>
                    <p className="text-[10px] text-slate-300 leading-snug italic opacity-80">"{log.keterangan}"</p>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
                      {/* PERBAIKAN: Fallback ke text statis dulu krn relasi users belum ada */}
                      <span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-1"><User size={10}/> Kasir / Sistem</span>
                      <span className="text-[8px] font-black text-slate-500 uppercase">{new Date(log.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* MODAL TAMBAH STOK (KASIR FO) */}
      {restockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-emerald-600 uppercase italic">Barang Masuk</h3>
              <button onClick={() => setRestockModal({ isOpen: false, item: null, qty: '' })} className="text-emerald-300 hover:text-emerald-600 transition-colors"><XCircle size={24}/></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Produk Target</p>
                <p className="text-lg font-black text-slate-800 uppercase leading-tight">{restockModal.item?.nama_item}</p>
                <p className="text-xs font-bold text-slate-500 mt-2">Stok Saat Ini: <span className="text-indigo-600 font-black">{restockModal.item?.stok || 0}</span></p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Jumlah Tambahan (+)</label>
                <input 
                  type="number" 
                  min="1"
                  placeholder="Contoh: 12" 
                  className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl text-2xl font-black text-center text-emerald-600 outline-none focus:border-emerald-500 transition-colors"
                  value={restockModal.qty}
                  onChange={(e) => setRestockModal({...restockModal, qty: e.target.value})}
                  autoFocus
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={handleAddStock} 
                disabled={isSaving} 
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20}/> : <><Plus size={20}/> Simpan Stok Masuk</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InventoryManager;