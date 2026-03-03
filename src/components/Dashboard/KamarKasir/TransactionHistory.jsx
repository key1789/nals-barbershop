import React, { useState, useEffect } from 'react';
import { 
  History, Search, Printer, CalendarClock, 
  CheckCircle2, XCircle, Scissors, RefreshCw, Ban
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const TransactionHistory = ({ user }) => {
  const [activeTab, setActiveTab] = useState('history'); // 'history' (Paid/Void/Cancel) atau 'booking'
  const [transactions, setTransactions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrx, setSelectedTrx] = useState(null);

  const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

      // 1. Tarik Data Transaksi (Paid, Void, Cancel) Hari Ini
      const { data: historyData } = await supabase
        .from('visits')
        .select(`
          *,
          customers(nama, no_wa, tier),
          users!capster_id(nama),
          visit_items(id, qty, harga_saat_ini, products_services(nama_item, tipe))
        `)
        .eq('outlet_id', user.outlet_id)
        .in('status_transaksi', ['Paid', 'Void', 'Cancel'])
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (historyData) setTransactions(historyData);

      // 2. Tarik Data BOOKING (Dibuat hari ini ATAU Jadwalnya hari ini)
      const { data: bookData } = await supabase
        .from('visits')
        .select(`
          *,
          customers(nama, no_wa, tier),
          users!capster_id(nama),
          visit_items(id, qty, harga_saat_ini, products_services(nama_item, tipe))
        `)
        .eq('outlet_id', user.outlet_id)
        .eq('status_layanan', 'Booking Order')
        .gte('transaction_date', startOfDay.toISOString())
        .lte('transaction_date', endOfDay.toISOString())
        .order('transaction_date', { ascending: true });

      if (bookData) setBookings(bookData);

    } catch (error) {
      console.error("Gagal tarik history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Search
  const displayData = activeTab === 'history' ? transactions : bookings;
  const filteredData = displayData.filter(trx => 
    trx.customers?.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trx.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // GROUPING UNTUK TAB HISTORY
  const paidList = filteredData.filter(t => t.status_transaksi === 'Paid');
  const voidList = filteredData.filter(t => t.status_transaksi !== 'Paid');

  // Komponen Card biar kodingan gak kepanjangan diulang-ulang
  const TransactionCard = ({ trx }) => {
    const isPaid = trx.status_transaksi === 'Paid';
    const isVoid = trx.status_transaksi === 'Void';
    const isCancel = trx.status_transaksi === 'Cancel';
    
    return (
      <div 
        onClick={() => setSelectedTrx(trx)}
        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center group ${selectedTrx?.id === trx.id ? 'bg-indigo-50 border-indigo-400 shadow-md' : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm'} ${!isPaid && activeTab === 'history' ? 'opacity-70' : ''}`}
      >
        <div className="flex gap-4 items-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-inner ${activeTab === 'booking' ? 'bg-orange-500' : isPaid ? 'bg-emerald-500' : isVoid ? 'bg-rose-500' : 'bg-slate-400'}`}>
            {activeTab === 'booking' ? <CalendarClock size={24}/> : isPaid ? <CheckCircle2 size={24}/> : <Ban size={24}/>}
          </div>
          <div>
            <h4 className={`font-black uppercase ${!isPaid && activeTab === 'history' ? 'text-slate-500' : 'text-slate-800'}`}>{trx.customers?.nama || 'UMUM'}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {activeTab === 'history' ? (
                <>{trx.status_transaksi} • {new Date(trx.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</>
              ) : (
                <>Jadwal: {new Date(trx.transaction_date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</>
              )}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className={`text-lg font-black ${!isPaid && activeTab === 'history' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {formatIDR(trx.total_tagihan)}
          </p>
          <p className={`text-[9px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded inline-block ${
            activeTab === 'booking' ? 'bg-slate-100 text-slate-400' :
            isPaid ? 'bg-emerald-100 text-emerald-600' : 
            isVoid ? 'bg-rose-100 text-rose-600' : 
            'bg-slate-200 text-slate-500'
          }`}>
            {activeTab === 'booking' ? 'BELUM BAYAR' : isPaid ? (trx.metode_bayar || 'LUNAS') : trx.status_transaksi}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full bg-[#f8fafc] font-sans overflow-hidden text-slate-900">
      
      {/* KIRI: DAFTAR TRANSAKSI */}
      <div className="flex-1 flex flex-col p-6 md:p-8 overflow-hidden">
        
        {/* Header Sederhana */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm mb-6 shrink-0 print:hidden flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic flex items-center gap-3">
              <History className="text-indigo-600"/> Riwayat Harian
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Daftar Nota & Jadwal Booking</p>
          </div>
          <button onClick={fetchData} className="p-3 bg-slate-50 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors border border-slate-100 flex items-center gap-2 font-bold text-xs">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""}/> Sync Data
          </button>
        </div>

        {/* TAB CONTROL & SEARCH */}
        <div className="flex gap-4 mb-6 shrink-0 print:hidden">
          <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200">
            <button 
              onClick={() => { setActiveTab('history'); setSelectedTrx(null); }}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Semua Nota ({transactions.length})
            </button>
            <button 
              onClick={() => { setActiveTab('booking'); setSelectedTrx(null); }}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'booking' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Jadwal Booking ({bookings.length})
            </button>
          </div>
          
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
            <input 
              type="text" 
              placeholder="Cari nama pelanggan..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* LIST TRANSAKSI */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-10 print:hidden">
          {isLoading ? (
            <p className="text-center text-slate-400 font-bold py-10">Memuat data...</p>
          ) : filteredData.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center">
              <p className="text-slate-400 font-bold">Tidak ada data untuk hari ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* JIKA TAB BOOKING: Tampil biasa tanpa grouping */}
              {activeTab === 'booking' && (
                <div className="space-y-4">
                  {filteredData.map(trx => <TransactionCard key={trx.id} trx={trx} />)}
                </div>
              )}

              {/* JIKA TAB HISTORY: Lakukan Grouping */}
              {activeTab === 'history' && (
                <>
                  {/* GROUP: LUNAS */}
                  {paidList.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-3 border-b-2 border-emerald-100 pb-2 flex items-center gap-2">
                        <CheckCircle2 size={14}/> Berhasil / Lunas ({paidList.length})
                      </h3>
                      <div className="space-y-4">
                        {paidList.map(trx => <TransactionCard key={trx.id} trx={trx} />)}
                      </div>
                    </div>
                  )}

                  {/* GROUP: VOID / CANCEL */}
                  {voidList.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3 border-b-2 border-rose-100 pb-2 flex items-center gap-2">
                        <Ban size={14}/> Dibatalkan / Void ({voidList.length})
                      </h3>
                      <div className="space-y-4">
                        {voidList.map(trx => <TransactionCard key={trx.id} trx={trx} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KANAN: DETAIL NOTA & PRINT */}
      <div className={`w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 z-10 print:hidden ${selectedTrx ? 'translate-x-0' : 'translate-x-full absolute right-0 h-full'}`}>
        {selectedTrx && (
          <div className="flex flex-col h-full relative">
            
            {/* Header Detail */}
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-start shrink-0">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {activeTab === 'history' ? 'Detail Transaksi' : 'Detail Booking'}
                </p>
                <h3 className="text-2xl font-black text-slate-800 uppercase italic leading-tight">
                  {selectedTrx.customers?.nama || 'UMUM'}
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-2 flex items-center gap-2">
                  <Scissors size={14}/> Capster: {selectedTrx.users?.nama || 'Belum dipilih'}
                </p>
              </div>
              <button onClick={() => setSelectedTrx(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shadow-sm">
                <XCircle size={24}/>
              </button>
            </div>

            {/* List Item */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
               
               {/* BANNER ALASAN VOID/CANCEL JIKA ADA */}
               {selectedTrx.alasan_cancel && (
                 <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                   <Ban size={20} className="text-rose-500 shrink-0 mt-0.5"/>
                   <div>
                     <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Dibatalkan</p>
                     <p className="text-xs font-bold text-rose-700 italic">"{selectedTrx.alasan_cancel}"</p>
                   </div>
                 </div>
               )}

               <div className="space-y-3">
                 <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] border-b-2 border-indigo-100 pb-2">Item Terjual</p>
                 {selectedTrx.visit_items?.map((it, idx) => (
                   <div key={idx} className={`flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 ${selectedTrx.status_transaksi !== 'Paid' && activeTab === 'history' ? 'opacity-50' : ''}`}>
                     <div>
                       <p className={`text-xs font-black uppercase ${selectedTrx.status_transaksi !== 'Paid' && activeTab === 'history' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{it.products_services?.nama_item}</p>
                       <p className="text-[10px] font-bold text-slate-400">{it.qty}x @ {formatIDR(it.harga_saat_ini)}</p>
                     </div>
                     <p className={`text-sm font-black ${selectedTrx.status_transaksi !== 'Paid' && activeTab === 'history' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{formatIDR(it.qty * it.harga_saat_ini)}</p>
                   </div>
                 ))}
               </div>

               {/* Summary Hitungan */}
               <div className="pt-6 border-t border-slate-200 space-y-2 text-sm font-bold text-slate-500">
                 <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(selectedTrx.total_tagihan)}</span></div>
                 <div className="flex justify-between text-emerald-500"><span>Diskon Promo</span><span>- {formatIDR(selectedTrx.diskon_promo || 0)}</span></div>
               </div>
            </div>

            {/* Footer Aksi */}
            <div className="p-8 bg-slate-900 text-white rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] shrink-0">
               <div className="flex justify-between items-end mb-6">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Tagihan</p>
                 <p className={`text-4xl font-black italic ${selectedTrx.status_transaksi !== 'Paid' && activeTab === 'history' ? 'text-slate-500 line-through' : 'text-white'}`}>
                   {formatIDR(selectedTrx.total_tagihan - (selectedTrx.diskon_promo || 0))}
                 </p>
               </div>
               
               <button 
                 disabled={selectedTrx.status_transaksi !== 'Paid' && activeTab === 'history'}
                 onClick={() => window.print()} 
                 className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-colors shadow-xl shadow-indigo-600/20 active:scale-95"
               >
                 <Printer size={20}/> {selectedTrx.status_transaksi !== 'Paid' && activeTab === 'history' ? 'Nota Dibatalkan' : 'Cetak Ulang Nota'}
               </button>
            </div>
          </div>
        )}
      </div>

      {/* AREA PRINT NOTA THERMAL (TERSEMBUNYI, CUMA MUNCUL PAS DIPRINT) */}
      {selectedTrx && selectedTrx.status_transaksi === 'Paid' && (
        <div className="hidden print:flex print:fixed print:inset-0 print:bg-white print:z-[99999] print:items-start print:justify-center w-full text-black font-mono p-4 text-[12px] uppercase">
          <div className="w-[58mm] pt-4"> 
             <div className="text-center border-b-2 border-dashed border-black pb-4 mb-4">
                 <h2 className="text-lg font-bold italic">{user?.outlet_name || "NAL'S BARBERSHOP"}</h2>
                 <p className="text-[10px]">{user?.outlet_address || "Tanda Terima Pembayaran"}</p>
             </div>
             
             <div className="mb-4 space-y-1 text-[10px]">
               <div className="flex justify-between"><span>Tgl</span><span>{new Date(selectedTrx.created_at).toLocaleDateString('id-ID')}</span></div>
               <div className="flex justify-between"><span>Jam</span><span>{new Date(selectedTrx.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span></div>
               <div className="flex justify-between"><span>Kasir</span><span>{user?.nama || 'FO'}</span></div>
               <div className="flex justify-between"><span>Capster</span><span>{selectedTrx.users?.nama || '-'}</span></div>
               <div className="flex justify-between"><span>Pelanggan</span><span>{selectedTrx.customers?.nama || 'UMUM'}</span></div>
             </div>

             <div className="border-t-2 border-dashed border-black py-2 mb-2">
               {selectedTrx.visit_items?.map((it, idx) => (
                 <div key={idx} className="mb-2">
                   <div className="text-left">{it.products_services?.nama_item}</div>
                   <div className="flex justify-between">
                     <span>{it.qty}x {it.harga_saat_ini.toLocaleString('id-ID')}</span>
                     <span>{(it.qty * it.harga_saat_ini).toLocaleString('id-ID')}</span>
                   </div>
                 </div>
               ))}
             </div>

             <div className="border-t-2 border-dashed border-black pt-2 pb-4 space-y-1 font-bold">
               <div className="flex justify-between"><span>Subtotal</span><span>{selectedTrx.total_tagihan.toLocaleString('id-ID')}</span></div>
               {selectedTrx.diskon_promo > 0 && (
                 <div className="flex justify-between"><span>Diskon</span><span>-{selectedTrx.diskon_promo.toLocaleString('id-ID')}</span></div>
               )}
               <div className="flex justify-between text-sm mt-2"><span>TOTAL</span><span>{(selectedTrx.total_tagihan - (selectedTrx.diskon_promo || 0)).toLocaleString('id-ID')}</span></div>
               <div className="flex justify-between mt-2 font-normal text-[10px]"><span>Metode</span><span>{selectedTrx.metode_bayar || '-'}</span></div>
             </div>
             
             <div className="text-center italic mt-4 text-[10px]">
               Terima Kasih atas kunjungan Anda! <br/>
               -- COPY RECEIPT --
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TransactionHistory;