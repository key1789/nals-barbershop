import React, { useState, useEffect } from 'react';
import { 
  Search, ChevronRight, ChevronLeft, User, Zap, Trash2,
  CheckCircle2, Loader2, Scissors, CalendarClock, X, Gift, 
  Package, ShoppingCart, Sparkles, Printer, Check, Phone, ArrowRight, Plus
} from 'lucide-react'; 
import { supabase } from '../../../supabaseClient';
import PaymentModal from "./PaymentModal";

const COMMON_INITIALS = ['Mas', 'Mba', 'Pak', 'Bu', 'Kak', 'Om', 'Tante', 'Dek', 'Bang', 'Sis', 'Bro'];

const TransactionWizard = ({ user, services = [], capsters = [], onComplete }) => {
  const [trxStep, setTrxStep] = useState(1);
  const [trxType, setTrxType] = useState('regular'); 
  const [bookingDateTime, setBookingDateTime] = useState('');
  const [depositBooking, setDepositBooking] = useState(''); 
  const [estWaitTime, setEstWaitTime] = useState(0);

  const [trxData, setTrxData] = useState({ customer: null, items: [], capster: null, queueNumber: null, visitObj: null });
  const [custStats, setCustStats] = useState({ total_visit: 0, total_spending: 0, last_visit: '-', last_item: '-' });

  const [isRegistering, setIsRegistering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const [searchCust, setSearchCust] = useState('');
  const [searchItem, setSearchItem] = useState('');
  const [filterType, setFilterType] = useState('all'); 
  const [members, setMembers] = useState([]);
  const [newMemberForm, setNewMemberForm] = useState({ 
    inisial_panggilan: '', nama: '', no_wa: '', tier: 'Exclusive', 
    alamat: '', tanggal_lahir: '', estimasi_repeat: '4' 
  });

  const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  const getCleanType = (tipe) => (tipe || 'service').toLowerCase().trim();
  const grandTotal = trxData.items.reduce((acc, curr) => acc + ((curr.harga_jual || 0) * (curr.qty || 1)), 0);

  const cartServices = trxData.items.filter(i => getCleanType(i.tipe) === 'service');
  const cartProducts = trxData.items.filter(i => getCleanType(i.tipe) === 'product');

  const addItem = (item) => {
    setTrxData(prev => {
      const existing = prev.items.find(i => i.id === item.id);
      if (existing) return { ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, qty: (i.qty || 1) + 1 } : i) };
      return { ...prev, items: [...prev.items, { ...item, qty: 1 }] };
    });
  };

  const removeItem = (id) => { setTrxData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) })); };

  const updateQty = (id, delta) => {
    setTrxData(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? { ...i, qty: Math.max(1, (i.qty || 1) + delta) } : i) }));
  };

  const handleBack = () => {
    if (trxStep === 2) { setTrxData(prev => ({ ...prev, items: [], capster: null })); setTrxStep(1); }
    else if (trxStep === 3) { setTrxData(prev => ({ ...prev, capster: null })); setTrxStep(2); }
    else if (trxStep === 4) { setTrxStep(trxType === 'retail' ? 2 : 3); }
  };

  const calculateEstWait = async (capsterId) => {
    try {
      const { data } = await supabase.from('visits').select(`visit_items(products_services(durasi_menit))`).eq('capster_id', capsterId).eq('status_layanan', 'Waiting').eq('outlet_id', user.outlet_id);
      let totalMins = 0;
      data?.forEach(v => v.visit_items?.forEach(vi => totalMins += vi.products_services?.durasi_menit || 30));
      setEstWaitTime(totalMins);
    } catch (err) { console.error(err); }
  };

  const handleAutoAssignCapster = async () => {
    setIsAutoSelecting(true);
    try {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const { data: activeLoad } = await supabase.from('visits').select('capster_id').eq('outlet_id', user.outlet_id).gte('created_at', startOfDay.toISOString()).neq('status_layanan', 'Done').neq('status_layanan', 'Cancel');
      
      const capsterLoad = {}; capsters.forEach(c => { capsterLoad[c.id] = 0; }); 
      if (activeLoad) activeLoad.forEach(v => { if (v.capster_id && capsterLoad[v.capster_id] !== undefined) capsterLoad[v.capster_id]++; });
      
      let selectedCapster = null; let minLoad = Infinity;
      const shuffledCapsters = [...capsters].sort(() => 0.5 - Math.random());
      
      for (const c of shuffledCapsters) { 
        if (capsterLoad[c.id] < minLoad) { minLoad = capsterLoad[c.id]; selectedCapster = c; } 
      }
      
      if (selectedCapster) { 
        setTrxData(prev => ({ ...prev, capster: selectedCapster })); 
        calculateEstWait(selectedCapster.id);
        setTimeout(() => setTrxStep(4), 500); 
      } else { 
        alert("Tidak ada capster yang tersedia saat ini."); 
      }
    } catch (err) { alert("Gagal memilih otomatis."); } finally { setIsAutoSelecting(false); }
  };

  const handleSearch = async () => {
    let query = supabase.from('customers').select('*').limit(5);
    if (searchCust.length >= 2) query = query.or(`nama.ilike.%${searchCust}%,no_wa.ilike.%${searchCust}%`);
    else query = query.order('tanggal_daftar', { ascending: false }); 
    const { data } = await query;
    if (data) setMembers(data);
  };

  useEffect(() => {
    const delay = setTimeout(() => { handleSearch(); }, 300);
    return () => clearTimeout(delay);
  }, [searchCust]);

  // FIX: Hapus setIsLoadingStats yang bikin error putih
  const handleSelectCustomer = async (customer) => {
    setTrxData({ ...trxData, customer });
    try {
      const { data: visits } = await supabase.from('visits')
        .select(`created_at, total_tagihan, visit_items(products_services(nama_item))`)
        .eq('customer_id', customer.id).eq('status_transaksi', 'Paid')
        .order('created_at', { ascending: false });
        
      if (visits && visits.length > 0) {
        const totalSpending = visits.reduce((acc, v) => acc + (v.total_tagihan || 0), 0);
        const lastDate = new Date(visits[0].created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' });
        let lastItemName = visits[0].visit_items?.[0]?.products_services?.nama_item || '-';
        if (visits[0].visit_items?.length > 1) lastItemName += ' + lainnya';
        setCustStats({ total_visit: visits.length, total_spending: totalSpending, last_visit: lastDate, last_item: lastItemName });
      } else { 
        setCustStats({ total_visit: 0, total_spending: 0, last_visit: '-', last_item: 'Belum ada' }); 
      }
    } catch (err) { console.error(err); }
  };

  const handleSaveMember = async () => {
    if (!newMemberForm.nama || !newMemberForm.inisial_panggilan || !newMemberForm.tier) {
      return alert("Panggilan, Nama, dan Tier Wajib Diisi!");
    }
    try {
        const payload = {
            ...newMemberForm,
            estimasi_repeat: `${newMemberForm.estimasi_repeat || 4} Minggu`,
            no_wa: newMemberForm.no_wa || null,
            alamat: newMemberForm.alamat || null,
            tanggal_lahir: newMemberForm.tanggal_lahir || null
        };
        const { data, error } = await supabase.from('customers').insert([payload]).select().single();
        if (error) throw error;
        handleSelectCustomer(data);
        setIsRegistering(false);
    } catch (err) { alert(err.message); }
  };

  const handleSubmit = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      let nextQueueNumber = null;
      if (trxType === 'regular') {
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const { count } = await supabase.from('visits').select('*', { count: 'exact', head: true })
          .eq('outlet_id', user.outlet_id).gte('created_at', startOfDay.toISOString());
        nextQueueNumber = (count || 0) + 1;
      }

      const { data: vData, error: vErr } = await supabase.from('visits').insert([{
        outlet_id: user.outlet_id, 
        customer_id: trxData.customer.id, 
        capster_id: trxData.capster?.id || null, 
        fo_id: user.id, 
        status_layanan: trxType === 'retail' ? null : (trxType === 'booking' ? 'Booking Order' : 'Waiting'), 
        status_transaksi: 'Unpaid', 
        total_tagihan: grandTotal, 
        total_bayar: trxType === 'booking' ? (parseInt(depositBooking) || 0) : 0, 
        sumber_transaksi: trxType === 'booking' ? 'Booking' : 'Walk-in', 
        no_antrean: nextQueueNumber, 
        transaction_date: trxType === 'booking' ? new Date(bookingDateTime).toISOString() : new Date().toISOString(),
        created_at: new Date().toISOString()
      }]).select().single();
      
      if (vErr) throw vErr;

      for (const item of trxData.items) {
        await supabase.from('visit_items').insert({ 
          visit_id: vData.id, item_id: item.id, qty: item.qty, 
          harga_asli: item.harga_jual, harga_saat_ini: item.harga_jual 
        });

        if (getCleanType(item.tipe) === 'product') {
          await supabase.from('products_services').update({ stok: item.stok - item.qty }).eq('id', item.id);
          await supabase.from('stock_logs').insert({
            user_id: user.id,
            product_id: item.id,
            qty: -item.qty,
            jenis_mutasi: 'Keluar',
            keterangan: `Penjualan Retail - Visit ID: ${vData.id}`
          });
        }
      }
      
      let finalVisitData = vData;
      if (trxType === 'retail') {
        const { data: fullVisit } = await supabase.from('visits').select(`
          *,
          customers(nama, inisial_panggilan, no_wa, tier, poin),
          visit_items(id, item_id, qty, harga_saat_ini, products_services(id, nama_item, tipe))
        `).eq('id', vData.id).single();
        if (fullVisit) finalVisitData = fullVisit;
      }

      setTrxData(prev => ({ ...prev, queueNumber: nextQueueNumber, visitObj: finalVisitData })); 
      setTrxStep(5); 

    } catch (err) { 
      console.error("ERROR SUBMIT:", err);
      alert("Gagal Simpan: " + err.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleShareWA = () => {
    const text = `Halo ${trxData.customer.nama}, Berikut Bill Booking Anda di ${user.outlet_name || "Nal's Barbershop"}.\n\nTotal: ${formatIDR(grandTotal)}\nHarap datang tepat waktu.\nTerima kasih!`;
    window.open(`https://wa.me/${trxData.customer.no_wa}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const filteredServices = services.filter(s => {
    const match = s.nama_item.toLowerCase().includes(searchItem.toLowerCase());
    if (trxType === 'retail') return match && getCleanType(s.tipe) === 'product';
    return match && (filterType === 'all' ? true : getCleanType(s.tipe) === filterType);
  });

  return (
    <>
      <div className="flex flex-col h-full bg-[#f8fafc] font-sans text-slate-900 overflow-hidden">
        {trxStep !== 5 && (
          <div className="print:hidden bg-white/90 backdrop-blur-md border-b border-slate-200 px-8 py-6 flex justify-between items-center z-20 shadow-sm">
            <div className="flex items-center gap-5">
              {trxStep > 1 && (
                <button onClick={handleBack} className="p-3 bg-slate-50 hover:bg-white hover:shadow-md rounded-2xl transition-all border border-slate-100 active:scale-90"><ChevronLeft size={24}/></button>
              )}
              <h2 className="text-2xl font-black text-slate-800 tracking-tight italic uppercase flex items-center gap-3">
                 <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">
                    {trxStep === 1 ? <User size={20}/> : trxStep === 2 ? <ShoppingCart size={20}/> : trxStep === 3 ? <Scissors size={20}/> : <CheckCircle2 size={20}/>}
                 </span>
                 {trxStep === 1 ? 'Identitas' : trxStep === 2 ? 'Pilih Item' : trxStep === 3 ? 'Capster' : 'Review'}
              </h2>
            </div>
            <div className="hidden md:flex items-center gap-3 bg-slate-100/50 p-2.5 rounded-2xl border border-slate-200/50">
              {[1, 2, 3, 4].map(s => ( <div key={s} className={`h-3 rounded-full transition-all duration-700 ${trxStep === s ? 'w-14 bg-indigo-600 shadow-lg shadow-indigo-200' : trxStep > s ? 'w-4 bg-slate-800' : 'w-4 bg-slate-200'}`} /> ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 md:p-10 no-scrollbar">
          {trxStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-6 duration-700 h-full">
              <div className="lg:col-span-7 flex flex-col h-full bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden min-h-[550px]">
                 <div className="p-10 bg-gradient-to-br from-white to-slate-50/50 border-b border-slate-100">
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[1.5rem] blur opacity-15 group-focus-within:opacity-30 transition duration-500"></div>
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={28}/>
                      <input type="text" placeholder="Cari Nama / WhatsApp Member..." className="relative w-full py-6 pl-16 pr-14 bg-white border-2 border-slate-100 rounded-[1.25rem] text-xl font-bold outline-none focus:border-indigo-600 transition-all shadow-inner" value={searchCust} onChange={e => setSearchCust(e.target.value)} />
                    </div>
                 </div>
                 <div className="p-8 flex-1 overflow-y-auto no-scrollbar space-y-4">
                    {members.map(m => (
                      <div key={m.id} onClick={() => handleSelectCustomer(m)} className={`group p-6 rounded-[2rem] flex justify-between items-center cursor-pointer transition-all border-2 ${trxData.customer?.id === m.id ? 'bg-indigo-50 border-indigo-600 shadow-lg translate-x-2' : 'bg-white border-slate-50 hover:border-indigo-200'}`}>
                        <div className="flex items-center gap-6">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner ${trxData.customer?.id === m.id ? 'bg-indigo-600 text-white rotate-6' : 'bg-slate-100 text-slate-400'}`}>{m.nama[0]}</div>
                          <div><h4 className="font-black text-xl text-slate-800">{m.inisial_panggilan}. {m.nama}</h4><p className="text-sm font-bold text-slate-400 italic">📱 {m.no_wa || 'GUEST'}</p></div>
                        </div>
                        <ChevronRight size={24} className={trxData.customer?.id === m.id ? 'text-indigo-600' : 'text-slate-200'}/>
                      </div>
                    ))}
                    <button onClick={() => setIsRegistering(true)} className="w-full py-8 border-4 border-dashed border-slate-100 rounded-[2.5rem] text-slate-400 font-black text-lg hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 mt-4">
                        <Plus size={32}/> REGISTRASI MEMBER BARU
                    </button>
                 </div>
              </div>

              <div className="lg:col-span-5 h-full">
                {trxData.customer ? (
                  <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl flex flex-col h-full overflow-hidden sticky top-5 animate-in zoom-in-95 duration-500">
                     <div className={`p-10 relative overflow-hidden ${trxData.customer.tier === 'Platinum' ? 'bg-slate-900 text-white' : 'bg-orange-500 text-white'}`}>
                        <div className="flex justify-between items-start relative z-10 mb-8">
                           <span className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white">{trxData.customer.tier} Member</span>
                           <div className="bg-white/20 px-4 py-2 rounded-xl flex items-center gap-2"><p className="text-[9px] font-black uppercase tracking-widest opacity-80">Loyalty Poin</p><p className="text-2xl font-black text-amber-300">{trxData.customer.poin || 0}</p></div>
                        </div>
                        <h2 className="text-4xl font-black italic uppercase tracking-tight relative z-10">{trxData.customer.nama}</h2>
                        <p className="text-sm font-bold opacity-80 mb-8">{trxData.customer.no_wa}</p>
                        
                        <div className="grid grid-cols-2 gap-y-6 pt-10 border-t border-white/20 text-[10px] font-bold uppercase tracking-widest opacity-90">
                           <div><p>Alamat</p><p className="text-white text-xs mt-1 leading-tight">{trxData.customer.alamat || '--'}</p></div>
                           <div><p className="text-right">Tgl Lahir</p><p className="text-white text-xs mt-1 text-right">{trxData.customer.tanggal_lahir || '--'}</p></div>
                           <div><p>Est. Repeat</p><p className="text-white text-xs mt-1">{trxData.customer.estimasi_repeat || '4 Minggu'}</p></div>
                           <div className="text-right"><p>Last Visit</p><p className="text-white text-xs mt-1">{custStats.last_visit}</p></div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/20 grid grid-cols-2 gap-4">
                           <div className="bg-black/10 p-4 rounded-2xl text-center"><p className="text-[8px] opacity-80 uppercase">Total Visit</p><p className="text-xl font-black">{custStats.total_visit}</p></div>
                           <div className="bg-black/10 p-4 rounded-2xl text-center"><p className="text-[8px] opacity-80 uppercase">Total Spending</p><p className="text-xl font-black">{formatIDR(custStats.total_spending)}</p></div>
                        </div>
                     </div>
                     <div className="p-10 bg-slate-50 space-y-4">
                        <button onClick={() => {setTrxType('regular'); setTrxStep(2);}} className="w-full h-20 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-xl shadow-indigo-200 active:scale-95 transition-all">WALK-IN (CUKUR)</button>
                        <div className="grid grid-cols-2 gap-4">
                           <button onClick={() => {setTrxType('booking'); setTrxStep(2);}} className="h-16 bg-white border-2 border-orange-200 text-orange-600 rounded-2xl font-black active:scale-95 transition-all">BOOKING</button>
                           <button onClick={() => {setTrxType('retail'); setTrxStep(2);}} className="h-16 bg-white border-2 border-emerald-200 text-emerald-600 rounded-2xl font-black active:scale-95 transition-all">PRODUCT</button>
                        </div>
                     </div>
                  </div>
                ) : (
                  <div className="h-full bg-white/50 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-300 p-10 text-center animate-pulse"><User size={64} className="mb-6 opacity-20"/><p className="font-black text-xl uppercase italic tracking-widest opacity-20">Pilih Member</p></div>
                )}
              </div>
            </div>
          )}

          {trxStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full animate-in slide-in-from-right-10 duration-700">
              <div className="lg:col-span-8 flex flex-col bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
                 {trxType === 'booking' && (
                    <div className="mb-8 p-6 bg-orange-50 border-2 border-orange-200 rounded-[2rem] flex items-center gap-6 animate-in slide-in-from-top-4">
                       <div className="bg-orange-500 text-white p-4 rounded-2xl shadow-lg shadow-orange-200"><CalendarClock size={32}/></div>
                       <div className="flex-1">
                          <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest mb-1">Pilih Jadwal Kedatangan *</p>
                          <input type="datetime-local" className="w-full bg-white border-2 border-orange-100 rounded-xl p-3 font-bold text-slate-800 focus:border-orange-500 outline-none" onChange={(e) => setBookingDateTime(e.target.value)}/>
                       </div>
                    </div>
                 )}
                 <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto no-scrollbar pb-10">
                    {filteredServices.map(s => {
                      const outOfStock = getCleanType(s.tipe) === 'product' && (s.stok || 0) <= 0;
                      const inCart = trxData.items.find(i => i.id === s.id);
                      return (
                        <div key={s.id} onClick={() => !outOfStock && addItem(s)} className={`group relative p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer ${outOfStock ? 'opacity-40 grayscale bg-slate-100 cursor-not-allowed' : inCart ? 'bg-indigo-50 border-indigo-500 shadow-lg' : 'bg-slate-50 border-transparent hover:bg-white hover:border-indigo-500 hover:shadow-2xl'}`}>
                          <div className={`mb-4 w-12 h-12 flex items-center justify-center rounded-2xl shadow-sm transition-colors ${inCart ? 'bg-indigo-600 text-white' : 'bg-white group-hover:bg-indigo-600 group-hover:text-white'}`}>
                              {getCleanType(s.tipe) === 'service' ? <Scissors size={20}/> : <Package size={20}/>}
                          </div>
                          <h4 className="font-black text-xs uppercase tracking-tight mb-2 pr-4">{s.nama_item}</h4>
                          <p className="font-black text-indigo-600 text-xl">{formatIDR(s.harga_jual)}</p>
                          {getCleanType(s.tipe) === 'product' && <p className={`mt-3 text-[10px] font-black px-3 py-1 rounded-full inline-block ${outOfStock ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>{outOfStock ? 'STOK HABIS' : `STOK: ${s.stok}`}</p>}
                          {inCart && ( <div className="absolute top-4 right-4 bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-md animate-in zoom-in">{inCart.qty}</div> )}
                        </div>
                      )
                    })}
                 </div>
              </div>

              <div className="lg:col-span-4 bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col shadow-2xl relative overflow-hidden h-full">
                 <h3 className="text-xl font-black italic uppercase tracking-widest mb-8 flex items-center gap-3 relative z-10"><ShoppingCart size={24}/> Keranjang</h3>
                 <div className="flex-1 overflow-y-auto space-y-8 no-scrollbar relative z-10">
                    {cartServices.length > 0 && (
                      <div><p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">-- Jasa Layanan --</p>{cartServices.map(it => <CartItem it={it} removeItem={removeItem} updateQty={updateQty} key={it.id}/>)}</div>
                    )}
                    {cartProducts.length > 0 && (
                      <div><p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4">-- Produk Retail --</p>{cartProducts.map(it => <CartItem it={it} removeItem={removeItem} updateQty={updateQty} key={it.id}/>)}</div>
                    )}
                 </div>
                 <div className="mt-8 pt-8 border-t border-white/5 relative z-10">
                    <div className="flex justify-between items-end mb-8"><p className="text-[10px] font-black uppercase opacity-40">Total</p><p className="text-4xl font-black italic text-indigo-400">{formatIDR(grandTotal)}</p></div>
                    <button onClick={() => setTrxStep(trxType === 'retail' ? 4 : 3)} disabled={trxData.items.length === 0 || (trxType === 'booking' && !bookingDateTime)} className="w-full h-20 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-[1.5rem] font-black italic tracking-[0.2em] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3">NEXT STEP <ArrowRight size={20}/></button>
                 </div>
              </div>
            </div>
          )}

          {trxStep === 3 && (
            <div className="bg-white rounded-[3rem] p-12 h-full border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col">
               <div className="flex justify-between items-center mb-12 border-b border-slate-100 pb-10">
                  <div>
                     <h2 className="text-4xl font-black italic uppercase tracking-tighter">Pilih Capster</h2>
                     <p className="font-bold text-slate-400 text-xs tracking-widest uppercase mt-1">Siapa yang bertugas hari ini?</p>
                  </div>
                  <button onClick={handleAutoAssignCapster} disabled={isAutoSelecting} className="px-8 py-4 bg-amber-100 text-amber-700 rounded-2xl font-black uppercase italic tracking-widest hover:bg-amber-200 transition-all flex items-center gap-3 shadow-sm group">
                     {isAutoSelecting ? <Loader2 className="animate-spin"/> : <Sparkles className="group-hover:rotate-12 transition-transform"/>} SMART ASSIGN
                  </button>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 overflow-y-auto no-scrollbar pb-10">
                  {capsters.map(c => (
                    <div key={c.id} onClick={() => { setTrxData({...trxData, capster: c}); calculateEstWait(c.id); setTrxStep(4); }} className="bg-slate-50 p-8 rounded-[3rem] border-2 border-transparent cursor-pointer hover:border-indigo-600 hover:bg-white hover:-translate-y-2 transition-all flex flex-col items-center group shadow-sm hover:shadow-2xl">
                       <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center font-black text-4xl text-slate-400 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner border border-slate-100">{c.nama[0]}</div>
                       <h4 className="font-black text-xl text-slate-800 mb-1">{c.nama}</h4>
                       <div className="bg-emerald-100 px-4 py-1.5 rounded-full"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 text-center">Available</p></div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {trxStep === 4 && (
            <div className="h-full flex items-center justify-center animate-in zoom-in-90 duration-500">
               <div className="bg-white rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] border border-slate-200 flex flex-col md:flex-row overflow-hidden max-w-4xl w-full">
                  <div className="flex-1 p-14 bg-white">
                     <h3 className="text-2xl font-black uppercase italic border-b-2 border-slate-100 pb-8 mb-10 tracking-tight">Review Order</h3>
                     <div className="flex justify-between bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner mb-10 flex justify-between items-end">
                        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</p><p className="font-black text-2xl text-slate-900">{trxData.customer.nama}</p></div>
                        <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Service by</p><p className="font-black text-2xl text-slate-900 italic text-indigo-600">{trxData.capster?.nama || 'N/A'}</p></div>
                     </div>
                     {trxData.items.map((item, idx) => ( <div key={idx} className="flex justify-between font-black text-slate-700 py-3 border-b border-slate-50 uppercase text-xs"><span>{item.qty}x {item.nama_item}</span><span>{formatIDR(item.harga_jual * item.qty)}</span></div> ))}
                  </div>
                  <div className="md:w-96 bg-slate-900 p-14 text-white flex flex-col justify-center border-l border-white/5 relative">
                     <p className="text-[10px] font-black uppercase opacity-50 tracking-[0.3em] mb-4 text-indigo-300 italic">Total Tagihan</p>
                     <p className="text-6xl font-black italic mb-14 tracking-tighter leading-none text-white">{formatIDR(grandTotal)}</p>
                     <button onClick={handleSubmit} disabled={isSaving} className="w-full h-24 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-[2rem] font-black text-2xl italic tracking-widest shadow-[0_20px_50px_rgba(79,70,229,0.3)] active:scale-95 transition-all flex items-center justify-center gap-4">
                        {isSaving ? <Loader2 className="animate-spin"/> : <CheckCircle2 size={32}/>} KUNCI ORDER
                     </button>
                  </div>
               </div>
            </div>
          )}

          {trxStep === 5 && (
             <div className="flex flex-col items-center justify-center h-full animate-in zoom-in-95 duration-700">
                <div className="print:hidden bg-white p-16 rounded-[4.5rem] border border-slate-200 text-center max-w-lg w-full shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] relative overflow-hidden">
                   <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner border-4 border-white"><Check size={56} strokeWidth={4}/></div>
                   <h2 className="text-4xl font-black text-slate-900 mb-4 italic uppercase tracking-tighter leading-none">BERHASIL!</h2>
                   
                   {trxType === 'regular' && (
                      <div className="bg-slate-50 p-10 rounded-[3rem] mb-12 border-2 border-slate-100 shadow-inner">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nomor Antrean Anda</p>
                         <p className="text-9xl font-black italic tracking-tighter text-indigo-600 leading-none">{trxData.queueNumber || '-'}</p>
                         <p className="text-[10px] font-black text-slate-400 mt-8 uppercase tracking-[0.2em]">Estimasi Tunggu: ±{estWaitTime} Menit</p>
                         <button onClick={() => window.print()} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase italic mt-8 flex items-center justify-center gap-3 hover:bg-slate-800 transition-all"><Printer size={20}/> CETAK TIKET</button>
                      </div>
                   )}

                   {trxType === 'booking' && (
                      <div className="bg-orange-50 p-10 rounded-[3rem] mb-12 border-2 border-orange-100 shadow-inner text-center">
                         <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest mb-3">Booking Order</p>
                         <h3 className="text-2xl font-black text-slate-800 italic uppercase mb-8">BELUM BAYAR</h3>
                         <button onClick={handleShareWA} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 transition-all"><Phone size={20}/> KIRIM BILL WA</button>
                      </div>
                   )}

                   {trxType === 'retail' && (
                      <div className="bg-emerald-50 p-10 rounded-[3rem] mb-12 border-2 border-emerald-100 shadow-inner">
                         <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-3">Retail Sale</p>
                         <h3 className="text-3xl font-black text-slate-800 italic mb-8">{formatIDR(grandTotal)}</h3>
                         <button onClick={() => setShowPayment(true)} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all">INPUT PEMBAYARAN</button>
                      </div>
                   )}
                   
                   <button onClick={onComplete} className="py-4 text-slate-400 font-black uppercase text-[10px] tracking-[0.4em] hover:text-slate-900 transition-all">Tutup & Kembali</button>
                </div>

                {trxType === 'regular' && (
                   <div className="hidden print:flex print:fixed print:inset-0 print:bg-white print:z-[99999] print:items-start print:justify-center w-full text-black font-mono p-4 text-[12px] uppercase">
                      <div className="w-full max-w-sm pt-4"> 
                         <div className="text-center border-b-2 border-dashed border-black pb-4 mb-4">
                             <h2 className="text-lg font-bold italic">{user.outlet_name || "NAL'S BARBERSHOP"}</h2>
                             <p className="text-[10px]">{user.outlet_address || "Jl. Alamat Belum Diatur"}</p>
                         </div>
                         <div className="text-center py-6">
                             <p className="text-[10px] font-bold tracking-widest mb-1">NO. ANTRIAN</p>
                             <h1 className="text-[100px] font-bold leading-none my-4">{trxData.queueNumber || '-'}</h1>
                             <p className="text-[10px] mt-4 font-bold border-2 border-black inline-block px-3 py-1">ESTIMASI TUNGGU: {estWaitTime} MENIT</p>
                         </div>
                         <div className="border-t border-b border-black py-4 my-4 space-y-2 font-bold">
                             <div className="flex justify-between"><span>Customer</span><span>{trxData.customer?.nama}</span></div>
                             <div className="flex justify-between"><span>Capster</span><span>{trxData.capster?.nama}</span></div>
                             <div className="flex justify-between"><span>Waktu</span><span>{new Date().toLocaleString('id-ID')}</span></div>
                         </div>
                         <div className="text-center italic font-bold mt-6">Harap tunggu giliran panggilan.</div>
                      </div>
                   </div>
                )}
             </div>
          )}
        </div>
      </div>

      {showPayment && trxData.visitObj && (
         <PaymentModal 
            visit={trxData.visitObj} 
            onClose={() => {
               setShowPayment(false);
               onComplete(); 
            }} 
            onSuccess={() => {
               setShowPayment(false);
               onComplete(); 
            }} 
         />
      )}
    </>
  );
};

const CartItem = ({ it, removeItem, updateQty }) => (
  <div className="bg-slate-800/40 p-5 rounded-[2rem] border border-white/5 flex justify-between items-center group mb-4">
     <div className="flex-1 pr-4">
        <p className="font-bold text-[11px] leading-tight text-white/90 mb-1 uppercase italic">{it.nama_item}</p>
        <button onClick={() => removeItem(it.id)} className="text-[9px] font-black uppercase text-red-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10}/> Hapus</button>
     </div>
     <div className="flex items-center bg-slate-900 rounded-2xl p-1.5 gap-4 border border-white/5 shadow-inner">
        <button onClick={() => updateQty(it.id, -1)} className="w-8 h-8 flex items-center justify-center hover:text-red-400 font-black transition-colors">-</button>
        <span className="font-black text-sm w-4 text-center">{it.qty}</span>
        <button onClick={() => updateQty(it.id, 1)} className="w-8 h-8 flex items-center justify-center hover:text-indigo-400 font-black transition-colors">+</button>
     </div>
  </div>
);

export default TransactionWizard;