import React, { useState } from 'react';
import { 
  Clock, Printer, User, Scissors, RefreshCw, XCircle, Phone, 
  ChevronRight, Ban, Lightbulb, Plus, Minus, Trash2, ShoppingBag, 
  AlertCircle, Star, Search, CalendarCheck, Package
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import PaymentModal from './PaymentModal';

const AntrianView = ({ user, queues = [], services = [], onRefresh }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [cancelModal, setCancelModal] = useState({ isOpen: false, type: 'Cancel', reason: '' });
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  const safeQueues = queues || [];
  const selectedData = safeQueues.find(q => q.id === selectedId);
  
  const isSelectedWaiting = selectedData?.status_layanan === 'Waiting';
  const isSelectedDone = selectedData?.status_layanan === 'Done';
  const isSelectedOnProcess = selectedData?.status_layanan === 'On Process';

  const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  const getCleanType = (tipe) => (tipe || 'service').toLowerCase().trim();

  // Helper: Cek apakah tanggal = hari ini
  const isToday = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const todayBookings = safeQueues.filter(q => q.status_layanan === 'Booking Order' && isToday(q.transaction_date));
  
  // Grouping item keranjang (Poin 4)
  const cartServices = selectedData?.visit_items?.filter(i => getCleanType(i.products_services?.tipe) === 'service') || [];
  const cartProducts = selectedData?.visit_items?.filter(i => getCleanType(i.products_services?.tipe) === 'product') || [];

  // =========================================================================
  // LOGIKA MESIN DATABASE
  // =========================================================================
  const recalculateTotal = async (visitId) => {
    const { data: items } = await supabase.from('visit_items').select('qty, harga_saat_ini').eq('visit_id', visitId);
    if (items) {
      const newTotal = items.reduce((sum, it) => sum + (it.qty * it.harga_saat_ini), 0);
      await supabase.from('visits').update({ total_tagihan: newTotal }).eq('id', visitId);
    }
  };

  const handleAddItem = async (serviceProduct) => {
    setIsUpdating(true);
    try {
      const isProduct = getCleanType(serviceProduct.tipe) === 'product';
      const existingItem = selectedData.visit_items?.find(it => it.item_id === serviceProduct.id);
      
      if (existingItem) {
        await supabase.from('visit_items').update({ qty: existingItem.qty + 1 }).eq('id', existingItem.id);
      } else {
        await supabase.from('visit_items').insert([{
          visit_id: selectedData.id, item_id: serviceProduct.id,
          qty: 1, harga_saat_ini: serviceProduct.harga_jual, harga_asli: serviceProduct.harga_jual
        }]);
      }

      if (isProduct) {
        await supabase.from('products_services').update({ stok: serviceProduct.stok - 1 }).eq('id', serviceProduct.id);
        await supabase.from('stock_logs').insert({
          user_id: user.id, product_id: serviceProduct.id, qty: -1,
          jenis_mutasi: 'Sale', keterangan: `Tambah di Antrean - Visit ID: ${selectedData.id}`
        });
      }

      await recalculateTotal(selectedData.id);
      onRefresh();
      setCatalogSearch('');
      setIsCatalogOpen(false); 
    } catch (err) { alert("Gagal tambah item: " + err.message); }
    finally { setIsUpdating(false); }
  };

  const handleUpdateQty = async (it, delta) => {
    const newQty = it.qty + delta;
    if (newQty < 1) return;
    
    setIsUpdating(true);
    try {
      const isProduct = getCleanType(it.products_services?.tipe) === 'product';
      const masterProduct = isProduct ? services.find(s => s.id === it.item_id) : null;

      if (isProduct && delta > 0 && masterProduct && masterProduct.stok <= 0) {
         return alert("Stok barang ini sudah habis!");
      }

      await supabase.from('visit_items').update({ qty: newQty }).eq('id', it.id);

      if (isProduct && masterProduct) {
        await supabase.from('products_services').update({ stok: masterProduct.stok - delta }).eq('id', masterProduct.id);
        await supabase.from('stock_logs').insert({
          user_id: user.id, product_id: masterProduct.id, qty: -delta,
          jenis_mutasi: delta > 0 ? 'Sale' : 'Batal/Return', 
          keterangan: `Ubah Qty Antrean - Visit ID: ${selectedData.id}`
        });
      }

      await recalculateTotal(selectedData.id);
      onRefresh();
    } catch (err) { alert("Gagal update Qty: " + err.message); }
    finally { setIsUpdating(false); }
  };

  const handleRemoveItem = async (it) => {
    if(!window.confirm(`Yakin hapus ${it.products_services?.nama_item} dari nota?`)) return;
    setIsUpdating(true);
    try {
      const isProduct = getCleanType(it.products_services?.tipe) === 'product';
      const masterProduct = isProduct ? services.find(s => s.id === it.item_id) : null;

      await supabase.from('visit_items').delete().eq('id', it.id);

      if (isProduct && masterProduct) {
        await supabase.from('products_services').update({ stok: masterProduct.stok + it.qty }).eq('id', masterProduct.id);
        await supabase.from('stock_logs').insert({
          user_id: user.id, product_id: masterProduct.id, qty: Math.abs(it.qty),
          jenis_mutasi: 'Batal/Return', keterangan: `Hapus Item Antrean - Visit ID: ${selectedData.id}`
        });
      }

      await recalculateTotal(selectedData.id);
      onRefresh();
    } catch (err) { alert("Gagal hapus item: " + err.message); }
    finally { setIsUpdating(false); }
  };

  const handleCheckInBooking = async (visitId) => {
    setIsUpdating(true);
    try {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const { count } = await supabase.from('visits').select('*', { count: 'exact', head: true })
        .eq('outlet_id', user.outlet_id).gte('created_at', startOfDay.toISOString());
      const nextQueueNumber = (count || 0) + 1;

      await supabase.from('visits').update({
        status_layanan: 'Waiting',
        no_antrean: nextQueueNumber
      }).eq('id', visitId);

      onRefresh();
    } catch (err) { alert("Gagal Check-in: " + err.message); }
    finally { setIsUpdating(false); }
  };

  const handleCancelAntrean = async () => {
    if (!cancelModal.reason.trim()) { alert("Alasan pembatalan wajib diisi!"); return; }
    setIsUpdating(true);
    
    try {
      // --- 🚨 1. LOGIKA BALIKIN STOK (PENYELAMATAN INVENTORI) 🚨 ---
      // Cek apakah di nota orang ini ada produk retail (bukan jasa)
      const itemsToReturn = selectedData.visit_items?.filter(
        it => getCleanType(it.products_services?.tipe) === 'product'
      );

      // Kalau ternyata ada produknya, kita balikin satu-satu
      if (itemsToReturn && itemsToReturn.length > 0) {
        for (const it of itemsToReturn) {
          const masterProduct = services.find(s => s.id === it.item_id);
          
          if (masterProduct) {
            // A. Balikin angka stok di tabel 'products_services'
            await supabase.from('products_services')
              .update({ stok: masterProduct.stok + it.qty })
              .eq('id', masterProduct.id);

            // B. Catat di buku logbook gudang ('stock_logs')
            await supabase.from('stock_logs').insert({
              user_id: user.id, 
              product_id: masterProduct.id, 
              qty: Math.abs(it.qty), // Dibuat positif karena barang masuk lagi
              jenis_mutasi: 'Batal/Return', 
              keterangan: `Batal Antrean [${cancelModal.type}] - Visit ID: ${selectedData.id}`
            });
          }
        }
      }

      // --- 2. LANJUT BATALIN ANTREAN ---
      await supabase.from('visits').update({ 
        status_layanan: 'Cancel', 
        status_transaksi: cancelModal.type, 
        alasan_cancel: `[${cancelModal.type}] ${cancelModal.reason}`
      }).eq('id', selectedData.id);
      
      setCancelModal({ isOpen: false, type: 'Cancel', reason: '' });
      setSelectedId(null);
      onRefresh();
      
    } catch (err) { 
      alert("Gagal membatalkan: " + err.message); 
    } finally { 
      setIsUpdating(false); 
    }
  };

  const getSaranProdukText = () => {
    if (!selectedData || !selectedData.service_notes) return null;
    const notes = selectedData.service_notes;
    const text = Array.isArray(notes) ? notes[0]?.rekomendasi_produk : notes?.rekomendasi_produk;
    return text && text.trim() !== '' ? text : null;
  };

  const saranProdukAsli = getSaranProdukText();
  const filteredCatalog = services.filter(item => item.nama_item?.toLowerCase().includes(catalogSearch.toLowerCase()));

  // KARTU ANTREAN (KANBAN)
  const QueueCard = ({ q }) => {
    const isWaiting = q.status_layanan === 'Waiting';
    const isOnProcess = q.status_layanan === 'On Process';
    const isDone = q.status_layanan === 'Done';

    let cardColor = 'border-transparent hover:border-slate-200';
    if (isWaiting) cardColor = selectedId === q.id ? 'border-orange-500 shadow-orange-100' : 'border-transparent hover:border-orange-200';
    else if (isOnProcess) cardColor = selectedId === q.id ? 'border-indigo-600 shadow-indigo-100' : 'border-transparent hover:border-indigo-200';
    else if (isDone) cardColor = selectedId === q.id ? 'border-emerald-500 shadow-emerald-100' : 'border-transparent hover:border-emerald-200';

    return (
      <div onClick={() => setSelectedId(q.id)} className={`bg-white rounded-[1.5rem] p-5 shadow-sm border-2 transition-all cursor-pointer relative overflow-hidden group ${cardColor} ${selectedId === q.id ? 'shadow-lg scale-[1.02]' : 'hover:-translate-y-1'}`}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
             <p className="text-xl font-black text-slate-800 leading-none">#{String(q.no_antrean || 0).padStart(3, '0')}</p>
             <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-widest ${q.status_transaksi === 'Paid' ? 'bg-emerald-100 text-emerald-600' : q.status_transaksi === 'Unpaid' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                {q.status_transaksi || 'UNPAID'}
             </span>
          </div>
        </div>
        <div className="mb-4">
          <h4 className="text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">{q.customers?.inisial_panggilan}. {q.customers?.nama || 'UMUM'}</h4>
          <span className="inline-block mt-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500">Tier: {q.customers?.tier || 'Member'}</span>
        </div>
        <div className="flex items-center justify-between pt-3 border-t-2 border-slate-50">
           <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Scissors size={12}/> {q.users?.nama || 'Tanpa Capster'}</p>
           {isOnProcess && (<span className="flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md animate-pulse"><Clock size={12} /> Sedang Cukur</span>)}
        </div>
      </div>
    );
  };

  // KOMPONEN ITEM RENDERER (Untuk Grouping Jasa vs Produk)
  const ItemRow = ({ it, isLocked }) => (
    <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 transition-colors ${isLocked ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-4">
          <p className="text-sm font-black text-slate-800 leading-tight mb-1 uppercase">{it.products_services?.nama_item || 'Item'}</p>
          <p className="text-xs font-bold text-slate-400">{formatIDR(it.harga_saat_ini)}</p>
        </div>
        <p className="text-base font-black text-slate-900">{formatIDR(it.qty * it.harga_saat_ini)}</p>
      </div>
      
      {!isLocked ? (
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button onClick={() => handleRemoveItem(it)} disabled={isUpdating} className="text-[10px] font-black uppercase text-rose-500 flex items-center gap-1 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
            <Trash2 size={14}/> Hapus
          </button>
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button onClick={() => handleUpdateQty(it, -1)} disabled={isUpdating} className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-600 shadow-sm hover:text-rose-500 font-black disabled:opacity-50"><Minus size={14}/></button>
            <span className="w-8 text-center text-sm font-black text-slate-800">{it.qty}</span>
            <button onClick={() => handleUpdateQty(it, 1)} disabled={isUpdating} className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-600 shadow-sm hover:text-indigo-600 font-black disabled:opacity-50"><Plus size={14}/></button>
          </div>
        </div>
      ) : (
        <div className="pt-2 border-t border-slate-100"><span className="text-[9px] font-black text-slate-400 uppercase bg-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 w-max"><Scissors size={10}/> Terkunci (Sedang/Selesai Dikerjakan)</span></div>
      )}
    </div>
  );

  return (
    <div className="h-full flex bg-[#f8fafc] overflow-hidden text-left font-sans relative">
      
      {/* AREA KIRI: KANBAN BOARD & BOOKING WIDGET */}
      <div className="flex-1 p-6 md:p-8 flex flex-col overflow-hidden print:hidden relative z-0">
        
        {/* HEADER GLASSMORPHISM */}
        <div className="flex justify-between items-center mb-6 bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none italic">Traffic Antrean</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Live Monitor & Control</p>
          </div>
          <button onClick={onRefresh} className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl font-black uppercase text-xs hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 flex items-center gap-2 shadow-sm active:scale-95">
            <RefreshCw size={18} className={isUpdating ? 'animate-spin' : ''}/> Sync Data
          </button>
        </div>

        {/* WIDGET: BOOKING HARI INI (HYBRID) */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck size={18} className="text-amber-500"/>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Jadwal Booking Hari Ini (Belum Hadir)</h3>
          </div>
          
          {todayBookings.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
              {todayBookings.map(b => (
                <div key={b.id} className="min-w-[280px] bg-slate-900 p-4 rounded-[1.5rem] shadow-lg border border-slate-700 flex justify-between items-center group animate-in slide-in-from-right-4">
                  <div>
                    <span className="text-[9px] bg-amber-400 text-slate-900 font-black uppercase tracking-widest px-2 py-0.5 rounded mb-1 inline-block">BOOKING</span>
                    <p className="font-black text-white uppercase text-sm leading-tight">{b.customers?.nama}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1"><Scissors size={10} className="inline mr-1"/>{b.users?.nama || 'N/A'}</p>
                  </div>
                  <button onClick={() => handleCheckInBooking(b.id)} disabled={isUpdating} className="p-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-emerald-500/20 transition-all active:scale-90 flex flex-col items-center gap-1">
                    Hadir
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full bg-slate-200/50 border-2 border-dashed border-slate-300 rounded-[1.5rem] p-4 text-center">
              <p className="text-xs font-bold text-slate-400 italic">Tidak ada jadwal booking tersisa untuk hari ini.</p>
            </div>
          )}
        </div>

        {/* KANBAN BOARD */}
        <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden h-full">
          {['Waiting', 'On Process', 'Done'].map(status => {
            const columnColor = status === 'Waiting' ? 'bg-orange-500' : status === 'On Process' ? 'bg-indigo-500' : 'bg-emerald-500';
            let columnQueues = [];
            if (status === 'Done') {
               columnQueues = safeQueues.filter(q => q.status_layanan === 'Done' && q.status_transaksi !== 'Paid');
            } else {
               columnQueues = safeQueues.filter(q => q.status_layanan === status);
            }

            return (
              <div key={status} className="flex flex-col gap-4 overflow-hidden bg-slate-200/50 p-4 rounded-[2.5rem] border border-slate-200/80">
                <div className="flex items-center justify-between px-3 py-1">
                  <p className="text-xs font-black uppercase text-slate-700 flex items-center gap-2 tracking-widest">
                    <span className={`w-3 h-3 rounded-full ${columnColor} ${status === 'On Process' ? 'animate-pulse' : ''}`}></span>
                    {status}
                  </p>
                  <span className="bg-white px-3 py-1 rounded-full text-xs font-black text-slate-500 shadow-sm border border-slate-200">{columnQueues.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-10 px-1">
                  {columnQueues.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-[2rem] text-slate-400"><p className="text-xs font-bold uppercase tracking-widest opacity-50">Kosong</p></div>
                  ) : ( columnQueues.map(q => <QueueCard key={q.id} q={q} />) )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AREA KANAN: PANEL DETAIL (SULTAN MODE) */}
      <div className={`w-[480px] print:hidden bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 z-10 ${selectedData ? 'translate-x-0' : 'translate-x-full absolute right-0 h-full'}`}>
        {selectedData && (
          <div className="flex flex-col h-full text-left relative">
            
            {/* HEADER DETAIL */}
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none italic">
                  {selectedData.customers?.nama || 'UMUM'}
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-2"><Phone size={14}/> {selectedData.customers?.no_wa || 'Tanpa Kontak'}</p>
                <div className="flex items-center gap-2 mt-4">
                  <span className="px-3 py-1.5 bg-slate-900 text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                    {selectedData.customers?.tier || 'Member'}
                  </span>
                  <span className="px-3 py-1.5 bg-amber-100 border border-amber-200 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                    <Star size={12} fill="currentColor"/> Poin: {selectedData.customers?.poin || 0}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="w-12 h-12 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center hover:text-indigo-600 hover:border-indigo-300 transition-colors shadow-sm active:scale-90" title="Print Ulang Antrean"><Printer size={20} strokeWidth={2.5}/></button>
                <button onClick={() => setSelectedId(null)} className="w-12 h-12 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center hover:text-rose-500 hover:bg-rose-50 transition-colors shadow-sm active:scale-90"><XCircle size={24} strokeWidth={2.5}/></button>
              </div>
            </div>

            {/* ACTION BAR: HANYA ADA TOMBOL BATAL UNTUK FO */}
            <div className="px-8 py-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-2">
                 <span className={`w-3 h-3 rounded-full ${isSelectedWaiting ? 'bg-orange-500' : isSelectedOnProcess ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                 <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{selectedData.status_layanan}</p>
               </div>
               
               <button onClick={() => setCancelModal({ ...cancelModal, isOpen: true })} className="px-4 py-2 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center gap-2"><Ban size={14}/> Batalkan Antrean</button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-8 bg-white space-y-8">
               
               {/* UPSELLING PANEL */}
               {(isSelectedDone || isSelectedOnProcess) && (
                 <div className={`p-6 rounded-3xl relative overflow-hidden shadow-sm border-2 ${saranProdukAsli ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <Lightbulb size={80} className={`absolute -right-6 -bottom-6 rotate-12 ${saranProdukAsli ? 'text-amber-200 opacity-50' : 'text-slate-200 opacity-30'}`}/>
                    <div className="flex items-center gap-2 mb-3 relative z-10">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm text-lg ${saranProdukAsli ? 'bg-amber-400 text-slate-900' : 'bg-slate-300'}`}>💡</span>
                      <p className={`text-[11px] font-black uppercase tracking-widest ${saranProdukAsli ? 'text-amber-800' : 'text-slate-500'}`}>Peluang Upselling</p>
                    </div>
                    {saranProdukAsli ? (
                      <p className="text-base font-bold text-slate-800 leading-snug relative z-10 italic">"{saranProdukAsli}"</p>
                    ) : (
                      <p className="text-sm font-bold text-slate-400 italic relative z-10">Belum ada saran produk dari Capster.</p>
                    )}
                 </div>
               )}

               {/* CART ITEMS: DI-GROUPING */}
               <div>
                 <div className="flex justify-between items-center mb-6">
                   <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Rincian Tagihan</p>
                   <button onClick={() => setIsCatalogOpen(true)} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-indigo-600 transition-colors shadow-sm active:scale-95">
                     <Plus size={14} strokeWidth={3}/> Tambah Item
                   </button>
                 </div>
                 
                 {/* GROUP: JASA LAYANAN */}
                 {cartServices.length > 0 && (
                   <div className="mb-6">
                     <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3 border-b-2 border-indigo-100 pb-2 flex items-center gap-2"><Scissors size={12}/> Jasa Layanan</p>
                     <div className="space-y-3">
                       {cartServices.map((it, idx) => (
                         <ItemRow key={`svc-${idx}`} it={it} isLocked={!isSelectedWaiting} />
                       ))}
                     </div>
                   </div>
                 )}

                 {/* GROUP: PRODUK RETAIL */}
                 {cartProducts.length > 0 && (
                   <div className="mb-6">
                     <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3 border-b-2 border-emerald-100 pb-2 flex items-center gap-2"><Package size={12}/> Produk Retail</p>
                     <div className="space-y-3">
                       {cartProducts.map((it, idx) => (
                         <ItemRow key={`prd-${idx}`} it={it} isLocked={false} /> // Produk ga pernah dikunci, FO bebas ngedit
                       ))}
                     </div>
                   </div>
                 )}
                 
                 {cartServices.length === 0 && cartProducts.length === 0 && (
                   <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm font-bold">Keranjang Kosong</div>
                 )}
               </div>
            </div>

            {/* DARK PANEL BOTTOM (Lanjut Pembayaran) */}
            <div className="p-8 bg-slate-900 text-white shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.15)] rounded-t-[2.5rem] relative z-20">
               <div className="flex justify-between items-end mb-8">
                 <div>
                   <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2 opacity-80">Total Tagihan</p>
                   <p className="text-4xl font-black text-white leading-none italic">{formatIDR(selectedData.total_tagihan)}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</p>
                   <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 ${selectedData.status_transaksi === 'Paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-rose-500/20 text-rose-400 border-rose-500/50'}`}>
                     {selectedData.status_transaksi || 'UNPAID'}
                   </span>
                 </div>
               </div>
               <button onClick={() => setIsPaymentOpen(true)} className="w-full h-20 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 active:scale-95 transition-all flex items-center justify-center gap-3">
                 LANJUT PEMBAYARAN <ChevronRight size={20} strokeWidth={3}/>
               </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL LACI KATALOG TAMBAH ITEM */}
      {isCatalogOpen && (
        <div className="absolute inset-0 z-50 flex justify-end print:hidden">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsCatalogOpen(false)}></div>
          <div className="w-[450px] h-full bg-slate-50 shadow-2xl relative flex flex-col animate-in slide-in-from-right-8 duration-300 rounded-l-[3rem] overflow-hidden">
            <div className="p-8 border-b border-slate-200 bg-white flex flex-col gap-5">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-800 uppercase italic flex items-center gap-3"><ShoppingBag size={24}/> Katalog Item</h3>
                <button onClick={() => setIsCatalogOpen(false)} className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-colors"><XCircle size={24}/></button>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <input type="text" placeholder="Cari layanan atau produk..." className="w-full pl-12 pr-4 py-4 bg-slate-100 border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               {filteredCatalog.map(item => {
                 const isProduct = getCleanType(item.tipe) === 'product';
                 const isOutOfStock = isProduct && (item.stok === 0 || item.stok === null);
                 
                 return (
                   <div key={item.id} className={`p-5 bg-white border-2 rounded-3xl flex justify-between items-center transition-all ${isOutOfStock ? 'opacity-50 border-slate-100 grayscale' : 'border-slate-100 hover:border-indigo-300 shadow-sm'}`}>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-sm font-black text-slate-800 uppercase">{item.nama_item}</p>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${isProduct ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>{isProduct ? 'Produk' : 'Layanan'}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-500">{formatIDR(item.harga_jual)}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        {isProduct && <p className={`text-[10px] font-black uppercase mb-3 ${isOutOfStock ? 'text-rose-500' : 'text-slate-400'}`}>Stok: {item.stok || 0}</p>}
                        <button onClick={() => handleAddItem(item)} disabled={isOutOfStock || isUpdating} className="px-5 py-3 bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm hover:bg-indigo-600 flex items-center gap-2">
                          {isUpdating ? <RefreshCw size={14} className="animate-spin"/> : (isOutOfStock ? 'Kosong' : <><Plus size={14}/> Tambah</>)}
                        </button>
                      </div>
                   </div>
                 );
               })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL BATALKAN ANTREAN */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
             <div className="p-8 bg-rose-50 border-b border-rose-100 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4 shadow-sm border-4 border-rose-100"><Ban size={40} strokeWidth={2.5}/></div>
                <h3 className="text-2xl font-black text-rose-600 uppercase tracking-tight italic">Batalkan Antrean</h3>
             </div>
             <div className="p-8 space-y-6">
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Tipe Pembatalan</label>
                 <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => setCancelModal({...cancelModal, type: 'Cancel'})} className={`py-4 rounded-2xl border-2 font-black text-sm uppercase transition-all ${cancelModal.type === 'Cancel' ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>Cancel <br/><span className="text-[9px] font-bold normal-case text-slate-400 mt-1 block">Tamu Pulang/Batal</span></button>
                   <button onClick={() => setCancelModal({...cancelModal, type: 'Void'})} className={`py-4 rounded-2xl border-2 font-black text-sm uppercase transition-all ${cancelModal.type === 'Void' ? 'bg-rose-50 border-rose-500 text-rose-600 shadow-sm' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>Void <br/><span className="text-[9px] font-bold normal-case text-slate-400 mt-1 block">Kesalahan Sistem</span></button>
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Alasan Wajib (Untuk Audit)</label>
                 <textarea rows="3" placeholder="Tuliskan alasannya dengan jelas..." className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-sm text-slate-800 outline-none focus:border-rose-500 focus:bg-white transition-colors" value={cancelModal.reason} onChange={e => setCancelModal({...cancelModal, reason: e.target.value})}></textarea>
               </div>
             </div>
             <div className="p-6 bg-slate-50 flex gap-4 border-t border-slate-100">
               <button onClick={() => setCancelModal({ isOpen: false, type: 'Cancel', reason: '' })} className="flex-1 py-5 bg-white border-2 border-slate-200 text-slate-500 rounded-[1.5rem] font-black uppercase text-xs tracking-widest hover:bg-slate-100 transition-colors">Tutup</button>
               <button onClick={handleCancelAntrean} disabled={isUpdating} className="flex-1 py-5 bg-rose-600 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-600/30 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2">{isUpdating ? <RefreshCw size={18} className="animate-spin"/> : 'Konfirmasi Batal'}</button>
             </div>
          </div>
        </div>
      )}

      {/* STRUK PRINT THERMAL INVISIBLE (Disembunyikan jika Payment Modal Terbuka) */}
      {!isPaymentOpen && selectedData && (
        <div className="hidden print:flex print:fixed print:inset-0 print:bg-white print:z-[99999] print:items-start print:justify-center w-full text-black font-mono p-4 text-[12px] uppercase">
          <div className="w-[58mm] pt-4">
             <div className="text-center border-b-2 border-dashed border-black pb-4 mb-4">
                 <h2 className="text-lg font-bold italic">{user?.outlet_name || "NAL'S BARBERSHOP"}</h2>
                 <p className="text-[10px]">{user?.outlet_address || "Jl. Alamat Belum Diatur"}</p>
             </div>
             <div className="text-center py-6">
                 <p className="text-[10px] font-bold tracking-widest mb-1">NO. ANTRIAN</p>
                 <h1 className="text-[100px] font-bold leading-none my-4">{selectedData.no_antrean || '-'}</h1>
                 <p className="text-[10px] mt-4 font-bold border-2 border-black inline-block px-3 py-1">HARAP TUNGGU PANGGILAN</p>
             </div>
             <div className="border-t border-b border-black py-4 my-4 space-y-2 font-bold text-[11px]">
                 <div className="flex justify-between"><span>Customer</span><span>{selectedData.customers?.nama || '-'}</span></div>
                 <div className="flex justify-between"><span>Capster</span><span>{selectedData.users?.nama || '-'}</span></div>
                 <div className="flex justify-between"><span>Waktu</span><span>{new Date().toLocaleString('id-ID')}</span></div>
             </div>
             <div className="text-center italic font-bold mt-6 text-[10px]">Terima kasih atas kunjungan Anda.</div>
          </div>
        </div>
      )}

      {/* MODAL PEMBAYARAN KASIR */}
      {isPaymentOpen && selectedData && (
        <PaymentModal 
          visit={selectedData} 
          onClose={() => setIsPaymentOpen(false)} 
          onSuccess={() => {
            setIsPaymentOpen(false);
            setSelectedId(null);
            onRefresh(); 
          }} 
        />
      )}
    </div>
  );
};

export default AntrianView;