import React, { useState, useEffect } from 'react';
import { 
  X, CreditCard, Banknote, QrCode, CheckCircle, Ticket, Wallet, UploadCloud, Image as ImageIcon, Printer, AlertTriangle, Gift, Loader2
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const PaymentModal = ({ visit, onClose, onSuccess }) => {
  const [promos, setPromos] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState('');
  const [sukaSukaPrice, setSukaSukaPrice] = useState('');
  
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cashReceived, setCashReceived] = useState('');
  const [buktiBayar, setBuktiBayar] = useState(null); 
  const [isProcessing, setIsProcessing] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);
  const [finalKembalian, setFinalKembalian] = useState(0);

  const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

  // 1. Ambil Data Promo Aktif
  useEffect(() => {
    const fetchPromos = async () => {
      const { data } = await supabase.from('promo_campaigns').select('*').eq('is_active', true);
      if (data) setPromos(data);
    };
    fetchPromos();
  }, []);

  // 2. Hitung Total Kotor
  const totalKotor = visit?.visit_items?.reduce((sum, it) => sum + (it.qty * it.harga_saat_ini), 0) || 0;

  // =========================================================================
  // 3. LOGIKA MESIN DISKON & PROMO
  // =========================================================================
  const activePromoData = promos.find(p => p.id === selectedPromo);
  let diskonNominal = 0;
  let isItemTargetMissing = false; 

  if (activePromoData) {
    if (activePromoData.tipe_sasaran === 'Suka_Suka') {
      const bayarSukaSuka = parseInt(sukaSukaPrice) || 0;
      diskonNominal = totalKotor - bayarSukaSuka;
      if (diskonNominal < 0) diskonNominal = 0; 

    } else if (activePromoData.tipe_sasaran === 'Item') {
      let targetSubtotal = 0;
      const itemsInCart = visit?.visit_items || [];
      const matchingItems = itemsInCart.filter(it => activePromoData.target_item_ids?.includes(it.item_id));

      if (matchingItems.length > 0) {
        matchingItems.forEach(it => { targetSubtotal += (it.qty * it.harga_saat_ini); });
        if (activePromoData.jenis_potongan === 'Gratis') { diskonNominal = targetSubtotal; } 
        else if (activePromoData.jenis_potongan === 'Nominal') { diskonNominal = Number(activePromoData.nilai_potongan); if (diskonNominal > targetSubtotal) diskonNominal = targetSubtotal; } 
        else if (activePromoData.jenis_potongan === 'Persen') { diskonNominal = targetSubtotal * (Number(activePromoData.nilai_potongan) / 100); }
      } else {
        isItemTargetMissing = true; 
      }
    } else {
      if (activePromoData.jenis_potongan === 'Gratis') { diskonNominal = totalKotor; } 
      else if (activePromoData.jenis_potongan === 'Nominal') { diskonNominal = Number(activePromoData.nilai_potongan); if (diskonNominal > totalKotor) diskonNominal = totalKotor; } 
      else if (activePromoData.jenis_potongan === 'Persen') { diskonNominal = totalKotor * (Number(activePromoData.nilai_potongan) / 100); }
    }
  }

  // 4. Hitung Grand Total & Sisa Tagihan 
  const grandTotal = totalKotor - diskonNominal;
  const telahDibayar = visit?.total_bayar || 0; 
  const sisaTagihan = grandTotal - telahDibayar > 0 ? grandTotal - telahDibayar : 0; 
  
  const kembalian = paymentMethod === 'Cash' && sisaTagihan > 0 ? (parseInt(cashReceived) || 0) - sisaTagihan : 0;

  // 5. LOGIKA POIN PELANGGAN
  const poinPelangganSaatIni = visit?.customers?.poin || 0;
  const isPoinKurang = activePromoData && activePromoData.syarat_poin > poinPelangganSaatIni;
  const poinDidapatHariIni = Math.floor(sisaTagihan / 10000);

  // 6. EKSEKUSI TRANSAKSI FINISH
  const handleSelesaikanPembayaran = async () => {
    if (isPoinKurang) return alert("Poin pelanggan tidak cukup untuk promo ini!");
    if (isItemTargetMissing) return alert("Item yang ditargetkan promo tidak ada di nota pelanggan!");
    
    if (paymentMethod === 'Cash' && sisaTagihan > 0 && (parseInt(cashReceived) || 0) < sisaTagihan) {
      return alert("Uang tunai yang diterima kurang dari Sisa Tagihan!");
    }
    if ((paymentMethod === 'QRIS' || paymentMethod === 'Transfer') && !buktiBayar && sisaTagihan > 0) {
      return alert("Wajib melampirkan bukti bayar/struk untuk metode QRIS/Transfer!");
    }

    setIsProcessing(true);
    try {
      let buktiUrl = null;
      if (buktiBayar) { buktiUrl = "https://link-struk-dummy.com/struk.jpg"; } 

      await supabase.from('visits').update({
        status_layanan: 'Done',
        status_transaksi: 'Paid',
        total_kotor: totalKotor,
        diskon_nominal: diskonNominal,
        total_tagihan: grandTotal,
        total_bayar: grandTotal > telahDibayar ? grandTotal : telahDibayar, 
        metode_bayar: paymentMethod,
        bukti_bayar_url: buktiUrl,
        promo_id: selectedPromo || null,
        poin_didapat: poinDidapatHariIni
      }).eq('id', visit.id);

      if (visit.customer_id) {
        let poinAkhir = poinPelangganSaatIni;
        if (activePromoData && activePromoData.syarat_poin > 0) {
          poinAkhir -= activePromoData.syarat_poin;
        }
        poinAkhir += poinDidapatHariIni;
        await supabase.from('customers').update({ poin: poinAkhir }).eq('id', visit.customer_id);
      }

      setFinalKembalian(kembalian);
      setIsSuccess(true);
      
    } catch (err) {
      alert("Gagal memproses: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!visit) return null;

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
        <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl text-center print:hidden relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-32 bg-emerald-500/10 rounded-b-[100%] -translate-y-10"></div>
           <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-lg shadow-emerald-500/30">
             <CheckCircle size={40} strokeWidth={3}/>
           </div>
           <h2 className="text-2xl font-black text-slate-800 mb-2">Pembayaran Lunas!</h2>
           <p className="text-sm font-medium text-slate-500 mb-8">Transaksi atas nama <span className="font-bold text-slate-700">{visit.customers?.nama || 'Umum'}</span> selesai.</p>

           <div className="bg-slate-50 rounded-2xl p-5 mb-8 border border-slate-100 space-y-3 text-left">
             <div className="flex justify-between items-center">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Tagihan</span>
               <span className="text-lg font-black text-slate-800">{formatIDR(grandTotal)}</span>
             </div>
             <div className="flex justify-between items-center pt-3 border-t border-slate-200/60">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Metode</span>
               <span className="text-sm font-bold text-slate-700">{paymentMethod}</span>
             </div>
             {paymentMethod === 'Cash' && (
               <div className="flex justify-between items-center pt-3 border-t border-slate-200/60">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kembalian</span>
                 <span className="text-sm font-black text-emerald-500">{formatIDR(finalKembalian)}</span>
               </div>
             )}
             {visit.customer_id && poinDidapatHariIni > 0 && (
               <div className="flex justify-between items-center pt-3 border-t border-slate-200/60">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Gift size={12}/> Poin Didapat</span>
                 <span className="text-sm font-black text-amber-500">+{poinDidapatHariIni} Pts</span>
               </div>
             )}
           </div>

           <div className="flex gap-4">
             <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-colors shadow-lg shadow-slate-900/20 active:scale-95">
               <Printer size={20}/> Cetak Nota
             </button>
             <button onClick={onSuccess} className="flex-1 py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl font-black transition-colors active:scale-95">
               Tutup & Selesai
             </button>
           </div>
        </div>

        <div className="hidden print:flex print:fixed print:inset-0 print:bg-white print:z-[99999] print:items-start print:justify-center w-full text-black font-mono p-4 text-[12px] uppercase">
          <div className="w-[58mm] pt-4"> 
             <div className="text-center pb-4 border-b-2 border-dashed border-black mb-4">
               <h2 className="text-xl font-bold italic mb-1">NAL'S BARBERSHOP</h2>
               <p className="text-[10px] lowercase">{new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
             </div>
             
             <div className="mb-4 text-[10px] space-y-1 font-bold">
               <div className="flex justify-between"><span>Pelanggan</span><span>{visit.customers?.nama || 'Umum'}</span></div>
               {visit.no_antrean && <div className="flex justify-between"><span>No. Antrean</span><span>#{visit.no_antrean}</span></div>}
               {visit.users?.nama && <div className="flex justify-between"><span>Capster</span><span>{visit.users?.nama}</span></div>}
             </div>
             
             <div className="border-t-2 border-dashed border-black pt-4 mb-4 space-y-3">
               {visit.visit_items?.map((it, idx) => (
                 <div key={idx} className="flex justify-between items-start text-[11px] font-bold">
                   <div className="w-[65%] pr-2">
                     <p>{it.products_services?.nama_item}</p>
                     <p className="text-[9px] lowercase opacity-80">{it.qty} x {formatIDR(it.harga_saat_ini)}</p>
                   </div>
                   <div className="w-[35%] text-right">{formatIDR(it.qty * it.harga_saat_ini)}</div>
                 </div>
               ))}
             </div>
             
             <div className="border-t-2 border-dashed border-black pt-3 space-y-1 text-[11px] font-bold">
               <div className="flex justify-between"><p>Total Kotor</p><p>{formatIDR(totalKotor)}</p></div>
               {diskonNominal > 0 && <div className="flex justify-between"><p>Diskon</p><p>-{formatIDR(diskonNominal)}</p></div>}
               <div className="flex justify-between text-[14px] mt-2 pt-2 border-t border-black"><p>GRAND TOTAL</p><p>{formatIDR(grandTotal)}</p></div>
             </div>
             
             <div className="border-t-2 border-dashed border-black mt-4 pt-3 space-y-1 text-[10px] font-bold">
               <div className="flex justify-between"><p>Metode</p><p>{paymentMethod}</p></div>
               {telahDibayar > 0 && <div className="flex justify-between"><p>Telah Deposit</p><p>{formatIDR(telahDibayar)}</p></div>}
               {paymentMethod === 'Cash' && (
                 <>
                   <div className="flex justify-between"><p>Tunai</p><p>{formatIDR(cashReceived || grandTotal)}</p></div>
                   <div className="flex justify-between mt-1 pt-1 border-t border-black"><p>Kembali</p><p>{formatIDR(finalKembalian)}</p></div>
                 </>
               )}
               {visit.customer_id && (
                 <div className="flex justify-between mt-2 pt-2 border-t border-black border-dashed"><p>Poin Didapat</p><p>+{poinDidapatHariIni}</p></div>
               )}
             </div>
             
             <div className="text-center border-t-2 border-dashed border-black mt-6 pt-4">
               <p className="font-bold text-[12px]">Terima Kasih!</p>
               <p className="text-[9px] mt-1 lowercase">Follow IG: @nalsbarbershop</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
      <div className="bg-slate-50 w-full max-w-5xl h-[85vh] rounded-[2rem] shadow-2xl flex overflow-hidden border border-slate-200 relative">
        
        {/* SISI KIRI: STRUK & RINGKASAN TAGIHAN */}
        <div className="w-1/2 bg-white p-8 border-r border-slate-200 flex flex-col h-full">
          <div className="mb-6 pb-6 border-b border-slate-100 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-2">
                {visit.customers?.nama || 'UMUM'}
              </h2>
              {visit.customer_id && (
                 <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-1 w-max">
                   Sisa Poin: {poinPelangganSaatIni}
                 </span>
              )}
            </div>
            {visit.no_antrean && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">No. Antrean</p>
                <p className="text-3xl font-black text-slate-800 leading-none">#{String(visit.no_antrean).padStart(3, '0')}</p>
              </div>
            )}
          </div>

          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Rincian Item (Fix)</p>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 no-scrollbar">
            {visit.visit_items?.map((it, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-black text-slate-800">{it.products_services?.nama_item}</p>
                  <p className="text-xs font-bold text-slate-500">{it.qty} x {formatIDR(it.harga_saat_ini)}</p>
                </div>
                <p className="text-sm font-black text-slate-800">{formatIDR(it.qty * it.harga_saat_ini)}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 space-y-2">
            <div className="flex justify-between text-slate-500 font-bold text-sm">
              <span>Total Kotor</span>
              <span>{formatIDR(totalKotor)}</span>
            </div>
            <div className="flex justify-between text-rose-500 font-black text-sm">
              <span>Diskon Promo</span>
              <span>- {formatIDR(diskonNominal)}</span>
            </div>
            <div className="flex justify-between text-slate-800 font-black text-lg pt-2 border-t border-slate-100">
              <span>Grand Total</span>
              <span>{formatIDR(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* SISI KANAN: MESIN EKSEKUSI PEMBAYARAN */}
        <div className="w-1/2 bg-slate-900 text-white p-8 flex flex-col h-full overflow-y-auto no-scrollbar relative">
          <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white rounded-full flex items-center justify-center transition-colors">
            <X size={20} strokeWidth={3}/>
          </button>

          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2 mb-6 mt-2">
            <Wallet size={24} className="text-indigo-400"/> Eksekusi Kasir
          </h3>

          <div className="mb-6">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Terapkan Promo / Tukar Poin</label>
            <div className="relative">
              <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
              <select 
                className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white outline-none appearance-none focus:border-indigo-500 cursor-pointer"
                value={selectedPromo}
                onChange={(e) => setSelectedPromo(e.target.value)}
              >
                <option value="">-- Tanpa Promo --</option>
                {promos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.syarat_poin > 0 ? `[Tukar ${p.syarat_poin} Poin] ` : ''}{p.nama_promo}
                  </option>
                ))}
              </select>
            </div>

            {isPoinKurang && (
              <p className="text-xs font-bold text-rose-400 mt-2 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-center gap-1">
                <AlertTriangle size={14}/> Poin tidak cukup! Butuh {activePromoData?.syarat_poin} poin.
              </p>
            )}

            {isItemTargetMissing && !isPoinKurang && (
              <p className="text-xs font-bold text-rose-400 mt-2 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-center gap-1">
                <AlertTriangle size={14}/> Syarat Promo: Item target tidak ada di keranjang!
              </p>
            )}

            {activePromoData?.tipe_sasaran === 'Suka_Suka' && !isPoinKurang && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-2">Pelanggan Bayar Berapa?</label>
                <input 
                  type="number" 
                  placeholder="Ketik nominal bayar suka-suka..." 
                  className="w-full p-4 bg-slate-800 border-2 border-amber-500/50 rounded-2xl text-lg font-black text-amber-400 outline-none focus:border-amber-400"
                  value={sukaSukaPrice}
                  onChange={(e) => setSukaSukaPrice(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="mb-6 p-6 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-600/20 border border-indigo-500 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-center mb-2 relative z-10">
              <span className="text-xs font-bold text-indigo-200">Tagihan Final</span>
              <span className="text-sm font-bold text-white">{formatIDR(grandTotal)}</span>
            </div>
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-indigo-500/50 relative z-10">
              <span className="text-xs font-bold text-indigo-200">Telah Dibayar (Deposit)</span>
              <span className="text-sm font-bold text-emerald-300">- {formatIDR(telahDibayar)}</span>
            </div>
            <p className="text-xs font-black text-indigo-200 uppercase tracking-widest mb-1 relative z-10">Sisa Harus Dibayar</p>
            <p className="text-5xl font-black text-white leading-none tracking-tighter relative z-10">{formatIDR(sisaTagihan)}</p>
            
            {visit.customer_id && sisaTagihan > 0 && (
              <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest mt-4 relative z-10 flex items-center gap-1">
                <Gift size={12}/> +{poinDidapatHariIni} Poin dari transaksi ini
              </p>
            )}
          </div>

          {sisaTagihan > 0 ? (
            <>
              <div className="mb-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Metode Pembayaran</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Cash', 'QRIS', 'Transfer'].map(method => (
                    <button 
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === method ? 'bg-white border-white text-slate-900 shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {method === 'Cash' && <Banknote size={24} strokeWidth={2.5}/>}
                      {method === 'QRIS' && <QrCode size={24} strokeWidth={2.5}/>}
                      {method === 'Transfer' && <CreditCard size={24} strokeWidth={2.5}/>}
                      <span className="text-[10px] font-black uppercase tracking-widest">{method}</span>
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'Cash' && (
                <div className="mb-6 animate-in fade-in">
                  <input 
                    type="number" 
                    placeholder="Uang Diterima (Rp)" 
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-xl font-black text-white outline-none focus:border-indigo-500 mb-2"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                  <div className="flex justify-between items-center p-4 bg-slate-950 rounded-2xl border border-slate-800">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Kembalian</span>
                    <span className={`text-xl font-black ${kembalian < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                      {kembalian < 0 ? 'Uang Kurang!' : formatIDR(kembalian)}
                    </span>
                  </div>
                </div>
              )}

              {(paymentMethod === 'QRIS' || paymentMethod === 'Transfer') && (
                <div className="mb-6 animate-in fade-in">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-600 rounded-2xl hover:bg-slate-800 hover:border-indigo-500 cursor-pointer transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {buktiBayar ? (
                        <p className="text-sm font-bold text-emerald-400 flex items-center gap-2"><ImageIcon size={16}/> Bukti Siap Upload</p>
                      ) : (
                        <>
                          <UploadCloud className="w-6 h-6 text-slate-400 mb-2" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload Struk / Bukti Transfer</p>
                        </>
                      )}
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => setBuktiBayar(e.target.files[0])} />
                  </label>
                </div>
              )}
            </>
          ) : (
            <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-2xl text-center">
              <p className="text-emerald-400 font-bold text-sm">Pelanggan tidak perlu membayar lagi.</p>
            </div>
          )}

          <div className="mt-auto">
            <button 
              onClick={handleSelesaikanPembayaran}
              disabled={isProcessing || isPoinKurang || isItemTargetMissing || (paymentMethod === 'Cash' && kembalian < 0 && sisaTagihan > 0) || ((paymentMethod === 'QRIS' || paymentMethod === 'Transfer') && !buktiBayar && sisaTagihan > 0)}
              className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={24}/> : (
                <><CheckCircle size={24}/> Lunas & Selesaikan Nota</>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PaymentModal;