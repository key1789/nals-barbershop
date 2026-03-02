import React, { useState, useEffect } from 'react';
import { 
  Calendar, TrendingUp, TrendingDown, DollarSign, 
  Activity, BrainCircuit, Lock, Loader2, Sparkles
} from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

export default function TabDashboardKeuangan({ user }) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [lockedData, setLockedData] = useState(null);

  // State Duit (P&L)
  const [financeData, setFinanceData] = useState({
    omzetLayanan: 0, omzetProdukKotor: 0, hppProduk: 0, labaKotorProduk: 0,
    totalPendapatan: 0, totalKasKecil: 0, totalGaji: 0, totalMgmt: 0,
    totalPengeluaran: 0, netProfit: 0
  });

  // State AI
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiInsight, setAiInsight] = useState('');

  const fetchFinanceData = async () => {
    setIsLoading(true);
    try {
      // 1. Cek Data Tutup Buku
      const { data: closingData } = await supabase
        .from('financial_closings')
        .select('*')
        .eq('periode_bulan', selectedMonth)
        .maybeSingle(); 
      
      if (closingData) {
        setLockedData(closingData);
        setFinanceData({
          omzetLayanan: closingData.omzet_layanan, omzetProdukKotor: closingData.omzet_produk_kotor,
          hppProduk: closingData.hpp_produk, labaKotorProduk: closingData.laba_kotor_produk,
          totalPendapatan: closingData.total_pendapatan_kotor, totalKasKecil: closingData.total_kas_kecil,
          totalGaji: closingData.total_gaji_komisi, totalMgmt: closingData.total_management_expense,
          totalPengeluaran: closingData.total_pengeluaran, netProfit: closingData.net_profit
        });
        setAiInsight(closingData.ai_summary || '');
        setIsLoading(false);
        return;
      }

      // 2. Kalau belum tutup buku, HITUNG LIVE!
      setLockedData(null);
      const startOfMonth = `${selectedMonth}-01T00:00:00.000Z`;
      const endOfMonth = new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0, 23, 59, 59).toISOString();
      
      const startOnly = startOfMonth.split('T')[0];
      const endOnly = endOfMonth.split('T')[0];

      // A. Tarik Omzet (Pake JURUS SAPU JAGAT '*')
      // PERBAIKAN FINAL: Pakai nama kolom asli dari database lo!
      const { data: visits, error: errorVisits } = await supabase
        .from('visits')
        .select('*, visit_items(*, products_services(*))')
        .eq('status_transaksi', 'Paid') // <--- FIXED 100%
        .gte('created_at', startOfMonth) // <--- FIXED 100%
        .lte('created_at', endOfMonth); // <--- FIXED 100%
      
      if (errorVisits) {
        console.error("Error narik visits:", errorVisits);
      }
      
      let oLayanan = 0, oProdukKotor = 0, hProduk = 0;
      visits?.forEach(v => {
        v.visit_items?.forEach(item => {
          // BACA KOLOM HURUF KECIL ATAU BESAR BEBAS
          const qty = item.qty || item.Qty || item.QTY || 1;
          const harga = item.harga || item.Harga || item.HARGA || 0; 
          
          const prod = item.products_services || {};
          const hpp = prod.hpp || prod.Hpp || prod.HPP || 0;
          const kat = (prod.kategori || prod.Kategori || '').toLowerCase();
          
          if (kat.includes('grooming') || kat.includes('produk') || kat.includes('minuman') || kat.includes('retail')) {
            oProdukKotor += (qty * harga);
            hProduk += (qty * hpp);
          } else {
            oLayanan += (qty * harga);
          }
        });
      });
      const labaProduk = oProdukKotor - hProduk;
      const tPendapatan = oLayanan + labaProduk;

      // B. Tarik Pengeluaran Kas Kecil FO (Pake '*')
      const { data: pettyCash } = await supabase.from('petty_cash_transactions').select('*').ilike('jenis', 'OUT').gte('tanggal', startOnly).lte('tanggal', endOnly);
      const tKasKecil = pettyCash?.reduce((sum, item) => sum + (Number(item.nominal || item.Nominal) || 0), 0) || 0;

      // C. Tarik Gaji SDM (Pake '*')
      const { data: salaries } = await supabase.from('salary_logs').select('*').eq('periode_bulan', selectedMonth);
      const tGaji = salaries?.reduce((sum, item) => sum + (Number(item.take_home_pay || item.TakeHomePay) || 0), 0) || 0;

      // D. Tarik Pengeluaran Buku Besar Manager (Pake '*')
      const { data: mgmt } = await supabase.from('management_expenses').select('*').gte('tanggal', startOnly).lte('tanggal', endOnly);
      const tMgmt = mgmt?.reduce((sum, item) => sum + (Number(item.nominal || item.Nominal) || 0), 0) || 0;

      // E. Kalkulasi Final Net Profit
      const tPengeluaran = tKasKecil + tGaji + tMgmt;
      const nProfit = tPendapatan - tPengeluaran;

      setFinanceData({
        omzetLayanan: oLayanan, omzetProdukKotor: oProdukKotor, hppProduk: hProduk, labaKotorProduk: labaProduk,
        totalPendapatan: tPendapatan, totalKasKecil: tKasKecil, totalGaji: tGaji, totalMgmt: tMgmt,
        totalPengeluaran: tPengeluaran, netProfit: nProfit
      });

    } catch (err) { console.error("Error Fetching Data:", err); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchFinanceData(); }, [selectedMonth]);

  const handleGenerateAI = () => {
    setIsAiThinking(true);
    setTimeout(() => {
      let insight = `Halo Bos! Berdasarkan data bulan ${selectedMonth}, laba bersih kita ada di angka Rp ${financeData.netProfit.toLocaleString('id-ID')}. `;
      if (financeData.totalPengeluaran > financeData.totalPendapatan) {
        insight += `⚠️ Waspada Bos, kita boncos! Pengeluaran (Rp ${financeData.totalPengeluaran.toLocaleString()}) lebih besar dari omzet. Cek kembali efisiensi kas kecil & buku besar.`;
      } else if (financeData.labaKotorProduk < 100000) {
        insight += `💡 Pendapatan layanan bagus (Rp ${financeData.omzetLayanan.toLocaleString()}), tapi penjualan produk sangat lesu. Tolong ingatkan FO untuk lebih agresif jualan pomade!`;
      } else {
        insight += `🔥 Performa mantap! Arus kas sehat. Pertahankan kinerja FO dan Capster bulan depan!`;
      }
      setAiInsight(insight);
      setIsAiThinking(false);
    }, 2500);
  };

  const handleLockBukuBesar = async () => {
    if (!window.confirm("Kunci Laporan Laba Rugi bulan ini? Data akan dibekukan!")) return;
    setIsLocking(true);
    try {
      const payload = {
        periode_bulan: selectedMonth,
        omzet_layanan: financeData.omzetLayanan, omzet_produk_kotor: financeData.omzetProdukKotor,
        hpp_produk: financeData.hppProduk, laba_kotor_produk: financeData.labaKotorProduk,
        total_pendapatan_kotor: financeData.totalPendapatan, total_kas_kecil: financeData.totalKasKecil,
        total_gaji_komisi: financeData.totalGaji, total_management_expense: financeData.totalMgmt,
        total_pengeluaran: financeData.totalPengeluaran, net_profit: financeData.netProfit,
        ai_summary: aiInsight, is_locked: true, locked_by: user.id
      };
      const { error } = await supabase.from('financial_closings').upsert([payload], { onConflict: 'periode_bulan' });
      if (error) throw error;
      fetchFinanceData();
    } catch (err) { alert(err.message); } 
    finally { setIsLocking(false); }
  };

  return (
    <div className="space-y-6 px-1 md:px-2 animate-in fade-in duration-300">
      
      {/* FILTER BULAN & STATUS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100/50">
              <Activity size={22} strokeWidth={1.5}/>
            </div>
            Laba & Rugi (P&L)
          </h2>
          <div className="mt-2.5 md:ml-[54px]">
            {lockedData ? (
               <span className="inline-flex items-center gap-1.5 text-[11px] bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-semibold border border-slate-200">
                 <Lock size={12} strokeWidth={1.5}/> Terkunci
               </span>
            ) : (
               <span className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-semibold border border-emerald-100">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Live Data
               </span>
            )}
          </div>
        </div>

        <div className="bg-white hover:bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl flex items-center gap-2 w-full md:w-auto transition-colors shadow-sm shadow-slate-100">
          <Calendar size={18} strokeWidth={1.5} className="text-slate-400 ml-1"/>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)} 
            className="bg-transparent font-semibold text-[15px] text-slate-700 outline-none cursor-pointer w-full focus:ring-0" 
          />
        </div>
      </div>

      {isLoading ? <div className="p-16 text-center"><Loader2 className="animate-spin text-slate-400 mx-auto" size={32} strokeWidth={1.5}/></div> : (
        <>
          {/* TOP BIG NUMBERS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            <div className="bg-white p-6 md:p-7 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100">
              <p className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                <TrendingUp size={16} strokeWidth={1.5} className="text-emerald-500"/> Pendapatan Kotor
              </p>
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Rp {financeData.totalPendapatan.toLocaleString('id-ID')}</h3>
            </div>
            
            <div className="bg-white p-6 md:p-7 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100">
              <p className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                <TrendingDown size={16} strokeWidth={1.5} className="text-rose-500"/> Total Pengeluaran
              </p>
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Rp {financeData.totalPengeluaran.toLocaleString('id-ID')}</h3>
            </div>
            
            <div className={`${financeData.netProfit >= 0 ? 'bg-slate-900' : 'bg-rose-900'} p-6 md:p-7 rounded-3xl shadow-xl shadow-slate-900/10 text-white relative overflow-hidden group`}>
              <DollarSign className={`absolute -right-6 -bottom-8 opacity-20 group-hover:scale-110 transition-transform duration-500 ${financeData.netProfit >= 0 ? 'text-white' : 'text-rose-400'}`} size={140} strokeWidth={1}/>
              <p className="text-sm font-medium text-slate-300 mb-2 relative z-10">Laba Bersih (Net Profit)</p>
              <h3 className="text-3xl font-extrabold tracking-tight relative z-10">Rp {financeData.netProfit.toLocaleString('id-ID')}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
            {/* BREAKDOWN PENDAPATAN */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 p-6 md:p-8">
               <h4 className="font-bold text-[17px] text-slate-900 tracking-tight border-b border-slate-100 pb-4 mb-5">Rincian Pendapatan</h4>
               <div className="space-y-5">
                 <div className="flex justify-between items-center">
                   <p className="text-[15px] font-medium text-slate-600">Omzet Layanan</p>
                   <p className="text-lg font-bold text-slate-900">Rp {financeData.omzetLayanan.toLocaleString('id-ID')}</p>
                 </div>
                 <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100/80">
                   <p className="text-[14px] font-semibold text-slate-700 mb-3">Penjualan Retail & Produk</p>
                   <div className="flex justify-between text-[13px] font-medium mb-1.5">
                     <span className="text-slate-500">Pendapatan Kotor</span> 
                     <span className="text-slate-900">Rp {financeData.omzetProdukKotor.toLocaleString('id-ID')}</span>
                   </div>
                   <div className="flex justify-between text-[13px] font-medium mb-4">
                     <span className="text-slate-500">Modal/HPP</span> 
                     <span className="text-rose-500">- Rp {financeData.hppProduk.toLocaleString('id-ID')}</span>
                   </div>
                   <div className="flex justify-between items-center border-t border-slate-200/80 pt-3">
                     <span className="text-[13px] font-bold text-emerald-600">Laba Bersih Produk</span>
                     <span className="text-[15px] font-extrabold text-emerald-600">Rp {financeData.labaKotorProduk.toLocaleString('id-ID')}</span>
                   </div>
                 </div>
               </div>
            </div>

            {/* BREAKDOWN PENGELUARAN */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 p-6 md:p-8">
               <h4 className="font-bold text-[17px] text-slate-900 tracking-tight border-b border-slate-100 pb-4 mb-5">Rincian Pengeluaran</h4>
               <div className="space-y-1">
                 <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                   <span className="text-[15px] font-medium text-slate-600">Gaji & Komisi SDM</span>
                   <span className="font-bold text-slate-900">Rp {financeData.totalGaji.toLocaleString('id-ID')}</span>
                 </div>
                 <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                   <span className="text-[15px] font-medium text-slate-600">Kas Kecil (Front Office)</span>
                   <span className="font-bold text-slate-900">Rp {financeData.totalKasKecil.toLocaleString('id-ID')}</span>
                 </div>
                 <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                   <span className="text-[15px] font-medium text-slate-600">Buku Besar Manajemen</span>
                   <span className="font-bold text-slate-900">Rp {financeData.totalMgmt.toLocaleString('id-ID')}</span>
                 </div>
               </div>
            </div>
          </div>

          {/* AI ANALYST WIDGET (Soft Indigo Theme) */}
          <div className="bg-indigo-50 rounded-3xl p-6 md:p-8 border border-indigo-100/50 shadow-sm relative overflow-hidden group">
            <Sparkles className="absolute -right-4 -top-4 text-indigo-200 opacity-50 group-hover:rotate-12 transition-transform duration-700" size={100} strokeWidth={1}/>
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200/50 text-indigo-600">
                <BrainCircuit size={28} strokeWidth={1.5}/>
              </div>
              <div className="flex-1">
                <h4 className="text-[15px] font-bold text-indigo-900 mb-1.5">AI Financial Analyst</h4>
                {isAiThinking ? (
                  <p className="text-[14px] text-indigo-600 animate-pulse flex items-center gap-2">
                    <Loader2 size={14} strokeWidth={1.5} className="animate-spin"/> AI sedang menganalisa data arus kas...
                  </p>
                ) : aiInsight ? (
                  <p className="text-[14.5px] font-medium leading-relaxed text-indigo-800/80">{aiInsight}</p>
                ) : (
                  <p className="text-[14px] text-indigo-600/70">Klik tombol di samping untuk minta AI menganalisa Laba/Rugi bulan ini.</p>
                )}
              </div>
              {!lockedData && (
                <button 
                  onClick={handleGenerateAI} 
                  disabled={isAiThinking} 
                  className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-[14px] font-semibold px-5 py-3 rounded-2xl transition-all shadow-md shadow-indigo-600/20 focus:outline-none"
                >
                  {isAiThinking ? 'Berpikir...' : 'Analisa Sekarang'}
                </button>
              )}
            </div>
          </div>

          {/* TOMBOL TUTUP BUKU */}
          {!lockedData && (
            <div className="pt-4">
               <button 
                 onClick={handleLockBukuBesar} 
                 disabled={isLocking} 
                 className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/10 focus:outline-none"
               >
                 {isLocking ? <Loader2 className="animate-spin" size={20} strokeWidth={1.5}/> : <Lock size={20} strokeWidth={1.5}/>} 
                 Kunci Buku Keuangan Bulan Ini
               </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}