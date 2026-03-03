import React, { useState, useEffect } from 'react';
import { 
  Calendar, TrendingUp, TrendingDown, DollarSign, 
  Activity, BrainCircuit, Lock, Loader2, Sparkles, AlertCircle
} from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

// Helper function untuk normalize field dari database yang tidak konsisten
const normalizeValue = (obj, fieldNames, defaultValue = 0) => {
  if (!obj) return defaultValue;
  for (const field of fieldNames) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    }
  }
  return defaultValue;
};

// Helper untuk safe date calculation menggunakan local timezone
const getMonthDateRange = (yearMonth) => {
  const [year, month] = yearMonth.split('-').map(Number);
  
  // Create dates in local timezone
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  // Format to ISO string but keep in local timezone
  const startISO = startDate.toISOString();
  const endISO = new Date(endDate.getTime() + endDate.getTimezoneOffset() * 60000).toISOString();
  
  return { startISO, endISO };
};

export default function TabDashboardKeuangan({ user }) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [lockedData, setLockedData] = useState(null);
  const [error, setError] = useState(null);

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
    setError(null);
    try {
      // 1. Cek Data Tutup Buku
      const { data: closingData, error: closingError } = await supabase
        .from('financial_closings')
        .select('*')
        .eq('periode_bulan', selectedMonth)
        .maybeSingle(); 
      
      if (closingError && closingError.code !== 'PGRST116') {
        throw new Error(`Database error: ${closingError.message}`);
      }
      
      if (closingData) {
        setLockedData(closingData);
        setFinanceData({
          omzetLayanan: normalizeValue(closingData, ['omzet_layanan']),
          omzetProdukKotor: normalizeValue(closingData, ['omzet_produk_kotor']),
          hppProduk: normalizeValue(closingData, ['hpp_produk']),
          labaKotorProduk: normalizeValue(closingData, ['laba_kotor_produk']),
          totalPendapatan: normalizeValue(closingData, ['total_pendapatan_kotor']),
          totalKasKecil: normalizeValue(closingData, ['total_kas_kecil']),
          totalGaji: normalizeValue(closingData, ['total_gaji_komisi']),
          totalMgmt: normalizeValue(closingData, ['total_management_expense']),
          totalPengeluaran: normalizeValue(closingData, ['total_pengeluaran']),
          netProfit: normalizeValue(closingData, ['net_profit'])
        });
        setAiInsight(closingData.ai_summary || '');
        setIsLoading(false);
        return;
      }

      // 2. Kalau belum tutup buku, HITUNG LIVE!
      setLockedData(null);
      const { startISO, endISO } = getMonthDateRange(selectedMonth);

      // A. Tarik Omzet (Dengan error handling)
      const { data: visits, error: errorVisits } = await supabase
        .from('visits')
        .select('*, visit_items(*, products_services(*))')
        .eq('status_transaksi', 'Paid')
        .gte('created_at', startISO)
        .lte('created_at', endISO);
      
      if (errorVisits) {
        console.warn("Warning fetching visits:", errorVisits);
        // Don't throw, continue dengan data kosong
      }
      
      let oLayanan = 0, oProdukKotor = 0, hProduk = 0;
      
      visits?.forEach(v => {
        v.visit_items?.forEach(item => {
          // Normalize field access - coba multiple field names
          const qty = normalizeValue(item, ['qty', 'quantity', 'jumlah'], 1);
          const harga = normalizeValue(item, ['harga', 'price', 'harga_jual'], 0);
          
          const prod = item.products_services || {};
          const hpp = normalizeValue(prod, ['hpp', 'cost', 'harga_pokok'], 0);
          const kategori = (normalizeValue(prod, ['kategori', 'category', 'tipe'], '') || '').toLowerCase();
          
          // Validate numbers
          if (isNaN(qty) || isNaN(harga) || isNaN(hpp)) {
            console.warn('Invalid number values:', { qty, harga, hpp });
            return;
          }
          
          if (kategori.includes('grooming') || kategori.includes('produk') || 
              kategori.includes('minuman') || kategori.includes('retail')) {
            oProdukKotor += (qty * harga);
            hProduk += (qty * hpp);
          } else if (kategori) { // Only count if kategori exists
            oLayanan += (qty * harga);
          }
        });
      });
      const labaProduk = Math.max(0, oProdukKotor - hProduk); // Prevent negative
      const tPendapatan = oLayanan + labaProduk;

      // B. Tarik Pengeluaran Kas Kecil FO
      const { data: pettyCash, error: errorPetty } = await supabase
        .from('petty_cash_transactions')
        .select('*')
        .ilike('jenis', 'OUT')
        .gte('tanggal', startISO.split('T')[0])
        .lte('tanggal', endISO.split('T')[0]);
      
      if (errorPetty) {
        console.warn("Warning fetching petty cash:", errorPetty);
      }
      const tKasKecil = pettyCash?.reduce((sum, item) => {
        const nominal = normalizeValue(item, ['nominal', 'amount'], 0);
        return sum + nominal;
      }, 0) || 0;

      // C. Tarik Gaji SDM
      const { data: salaries, error: errorSalary } = await supabase
        .from('salary_logs')
        .select('*')
        .eq('periode_bulan', selectedMonth);
      
      if (errorSalary) {
        console.warn("Warning fetching salaries:", errorSalary);
      }
      const tGaji = salaries?.reduce((sum, item) => {
        const thp = normalizeValue(item, ['take_home_pay', 'thp', 'gaji_bersih'], 0);
        return sum + thp;
      }, 0) || 0;

      // D. Tarik Pengeluaran Buku Besar Manager
      const { data: mgmt, error: errorMgmt } = await supabase
        .from('management_expenses')
        .select('*')
        .gte('tanggal', startISO.split('T')[0])
        .lte('tanggal', endISO.split('T')[0]);
      
      if (errorMgmt) {
        console.warn("Warning fetching management expenses:", errorMgmt);
      }
      const tMgmt = mgmt?.reduce((sum, item) => {
        const nominal = normalizeValue(item, ['nominal', 'amount'], 0);
        return sum + nominal;
      }, 0) || 0;

      // E. Kalkulasi Final Net Profit
      const tPengeluaran = tKasKecil + tGaji + tMgmt;
      const nProfit = tPendapatan - tPengeluaran;

      setFinanceData({
        omzetLayanan: oLayanan, omzetProdukKotor: oProdukKotor, hppProduk: hProduk, labaKotorProduk: labaProduk,
        totalPendapatan: tPendapatan, totalKasKecil: tKasKecil, totalGaji: tGaji, totalMgmt: tMgmt,
        totalPengeluaran: tPengeluaran, netProfit: nProfit
      });

    } catch (err) { 
      console.error("Error Fetching Finance Data:", err);
      setError(err.message || 'Gagal memuat data keuangan. Coba refresh halaman.');
    } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchFinanceData(); }, [selectedMonth]);

  const handleGenerateAI = () => {
    setIsAiThinking(true);
    // Simulate faster AI response (reduced from 2500ms)
    const timeout = setTimeout(() => {
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
    }, 1200); // Reduced timeout for better UX
    
    return () => clearTimeout(timeout);
  };

  const handleLockBukuBesar = async () => {
    if (!window.confirm(`Kunci Laporan Laba Rugi ${selectedMonth}? Data akan dibekukan dan tidak bisa diubah lagi!`)) return;
    
    setIsLocking(true);
    setError(null);
    try {
      const payload = {
        periode_bulan: selectedMonth,
        omzet_layanan: financeData.omzetLayanan, omzet_produk_kotor: financeData.omzetProdukKotor,
        hpp_produk: financeData.hppProduk, laba_kotor_produk: financeData.labaKotorProduk,
        total_pendapatan_kotor: financeData.totalPendapatan, total_kas_kecil: financeData.totalKasKecil,
        total_gaji_komisi: financeData.totalGaji, total_management_expense: financeData.totalMgmt,
        total_pengeluaran: financeData.totalPengeluaran, net_profit: financeData.netProfit,
        ai_summary: aiInsight, is_locked: true, locked_by: user?.id
      };
      const { error } = await supabase.from('financial_closings').upsert([payload], { onConflict: 'periode_bulan' });
      if (error) throw error;
      
      // Success feedback
      alert('✅ Buku keuangan berhasil dikunci!');
      fetchFinanceData();
    } catch (err) {
      const errorMsg = err.message || 'Gagal mengunci buku keuangan';
      console.error("Lock error:", err);
      setError(errorMsg);
      alert(`❌ Error: ${errorMsg}`);
    } 
    finally { setIsLocking(false); }
  };

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 px-1 sm:px-4 md:px-6 lg:px-8 animate-in fade-in duration-300">
      
      {/* ERROR STATE */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex gap-3 items-start">
          <AlertCircle size={20} className="text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm sm:text-[15px] font-semibold text-rose-900">{error}</p>
            <button onClick={() => fetchFinanceData()} className="text-xs font-medium text-rose-700 hover:text-rose-900 mt-2 underline">
              Coba lagi
            </button>
          </div>
        </div>
      )}
      
      {/* FILTER BULAN & STATUS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mt-2">
        <div className="w-full sm:w-auto">
          <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100/50 shrink-0">
              <Activity size={20} strokeWidth={1.5}/>
            </div>
            <span>Laba & Rugi (P&L)</span>
          </h2>
          <div className="mt-2.5 sm:ml-[52px]">
            {lockedData ? (
               <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs bg-slate-100 text-slate-600 px-3 py-1.5 sm:py-1 rounded-full font-semibold border border-slate-200">
                 <Lock size={12} strokeWidth={1.5}/> Terkunci
               </span>
            ) : (
               <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs bg-emerald-50 text-emerald-600 px-3 py-1.5 sm:py-1 rounded-full font-semibold border border-emerald-100">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Live Data
               </span>
            )}
          </div>
        </div>

        <div className="bg-white hover:bg-slate-50 border border-slate-200/80 p-2.5 sm:p-3 rounded-2xl flex items-center gap-2 w-full sm:w-auto transition-colors shadow-sm shadow-slate-100">
          <Calendar size={16} strokeWidth={1.5} className="text-slate-400 ml-1 shrink-0"/>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)} 
            className="bg-transparent font-semibold text-sm sm:text-[15px] text-slate-700 outline-none cursor-pointer flex-1 focus:ring-0 min-w-0" 
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 sm:p-16 text-center">
          <Loader2 className="animate-spin text-slate-400 mx-auto mb-3" size={32} strokeWidth={1.5}/>
          <p className="text-sm text-slate-500">Memuat data keuangan...</p>
        </div>
      ) : (
        <>
          {/* TOP BIG NUMBERS - Responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
            <div className="bg-white p-4 sm:p-5 md:p-6 lg:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100">
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mb-2 sm:mb-3 flex items-center gap-2">
                <TrendingUp size={14} strokeWidth={1.5} className="text-emerald-500 shrink-0"/> Pendapatan Kotor
              </p>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight break-words">Rp {financeData.totalPendapatan.toLocaleString('id-ID')}</h3>
            </div>
            
            <div className="bg-white p-4 sm:p-5 md:p-6 lg:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100">
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mb-2 sm:mb-3 flex items-center gap-2">
                <TrendingDown size={14} strokeWidth={1.5} className="text-rose-500 shrink-0"/> Total Pengeluaran
              </p>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight break-words">Rp {financeData.totalPengeluaran.toLocaleString('id-ID')}</h3>
            </div>
            
            <div className={`${financeData.netProfit >= 0 ? 'bg-slate-900' : 'bg-rose-900'} p-4 sm:p-5 md:p-6 lg:p-7 rounded-2xl sm:rounded-3xl shadow-lg shadow-slate-900/20 text-white relative overflow-hidden group`}>
              <DollarSign className={`absolute -right-4 sm:-right-6 -bottom-6 sm:-bottom-8 opacity-20 group-hover:scale-110 transition-transform duration-500 ${financeData.netProfit >= 0 ? 'text-white' : 'text-rose-400'}`} size={100} strokeWidth={1}/>
              <p className="text-xs sm:text-sm font-medium text-slate-300 mb-2 sm:mb-3 relative z-10">Laba Bersih (Net Profit)</p>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight relative z-10 break-words">Rp {financeData.netProfit.toLocaleString('id-ID')}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
            {/* BREAKDOWN PENDAPATAN */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 p-4 sm:p-6 md:p-8">
               <h4 className="font-bold text-base sm:text-[17px] text-slate-900 tracking-tight border-b border-slate-100 pb-3 sm:pb-4 mb-4 sm:mb-5">Rincian Pendapatan</h4>
               <div className="space-y-4 sm:space-y-5">
                 <div className="flex justify-between items-center gap-2">
                   <p className="text-xs sm:text-[15px] font-medium text-slate-600">Omzet Layanan</p>
                   <p className="text-base sm:text-lg font-bold text-slate-900 text-right">Rp {financeData.omzetLayanan.toLocaleString('id-ID')}</p>
                 </div>
                 <div className="p-3 sm:p-5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100/80">
                   <p className="text-xs sm:text-[14px] font-semibold text-slate-700 mb-2 sm:mb-3">Penjualan Retail & Produk</p>
                   <div className="flex justify-between text-[12px] sm:text-[13px] font-medium mb-1.5">
                     <span className="text-slate-500">Pendapatan Kotor</span> 
                     <span className="text-slate-900 text-right">Rp {financeData.omzetProdukKotor.toLocaleString('id-ID')}</span>
                   </div>
                   <div className="flex justify-between text-[12px] sm:text-[13px] font-medium mb-3 sm:mb-4">
                     <span className="text-slate-500">Modal/HPP</span> 
                     <span className="text-rose-500 text-right">- Rp {financeData.hppProduk.toLocaleString('id-ID')}</span>
                   </div>
                   <div className="flex justify-between items-center border-t border-slate-200/80 pt-2 sm:pt-3">
                     <span className="text-[12px] sm:text-[13px] font-bold text-emerald-600">Laba Bersih Produk</span>
                     <span className="text-sm sm:text-[15px] font-extrabold text-emerald-600 text-right">Rp {financeData.labaKotorProduk.toLocaleString('id-ID')}</span>
                   </div>
                 </div>
               </div>
            </div>

            {/* BREAKDOWN PENGELUARAN */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 p-4 sm:p-6 md:p-8">
               <h4 className="font-bold text-base sm:text-[17px] text-slate-900 tracking-tight border-b border-slate-100 pb-3 sm:pb-4 mb-4 sm:mb-5">Rincian Pengeluaran</h4>
               <div className="space-y-1">
                 <div className="flex justify-between items-center p-2 sm:p-3 hover:bg-slate-50 rounded-xl transition-colors">
                   <span className="text-xs sm:text-[15px] font-medium text-slate-600">Gaji & Komisi SDM</span>
                   <span className="font-bold text-slate-900 text-sm sm:text-base text-right">Rp {financeData.totalGaji.toLocaleString('id-ID')}</span>
                 </div>
                 <div className="flex justify-between items-center p-2 sm:p-3 hover:bg-slate-50 rounded-xl transition-colors">
                   <span className="text-xs sm:text-[15px] font-medium text-slate-600">Petty Cash</span>
                   <span className="font-bold text-slate-900 text-sm sm:text-base text-right">Rp {financeData.totalKasKecil.toLocaleString('id-ID')}</span>
                 </div>
                 <div className="flex justify-between items-center p-2 sm:p-3 hover:bg-slate-50 rounded-xl transition-colors">
                   <span className="text-xs sm:text-[15px] font-medium text-slate-600">Management Expenses</span>
                   <span className="font-bold text-slate-900 text-sm sm:text-base text-right">Rp {financeData.totalMgmt.toLocaleString('id-ID')}</span>
                 </div>
               </div>
            </div>
          </div>

          {/* AI ANALYST WIDGET (Soft Indigo Theme) */}
          <div className="bg-indigo-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-indigo-100/50 shadow-sm relative overflow-hidden group">
            <Sparkles className="absolute -right-2 sm:-right-4 -top-2 sm:-top-4 text-indigo-200 opacity-50 group-hover:rotate-12 transition-transform duration-700" size={80}/>
            <div className="relative z-10 flex flex-col gap-4 sm:gap-6">
              <div className="flex gap-3 sm:gap-6 items-start">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200/50 text-indigo-600">
                  <BrainCircuit size={20} strokeWidth={1.5}/>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-[15px] font-bold text-indigo-900 mb-1 sm:mb-1.5">AI Financial Analyst</h4>
                  {isAiThinking ? (
                    <p className="text-[12px] sm:text-[14px] text-indigo-600 animate-pulse flex items-center gap-2">
                      <Loader2 size={12} strokeWidth={1.5} className="animate-spin shrink-0"/> AI sedang menganalisa...
                    </p>
                  ) : aiInsight ? (
                    <p className="text-[13px] sm:text-[14.5px] font-medium leading-relaxed text-indigo-800/80">{aiInsight}</p>
                  ) : (
                    <p className="text-[12px] sm:text-[14px] text-indigo-600/70">Klik tombol untuk minta AI menganalisa Laba/Rugi bulan ini.</p>
                  )}
                </div>
              </div>
              {!lockedData && (
                <button 
                  onClick={handleGenerateAI} 
                  disabled={isAiThinking} 
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs sm:text-[14px] font-semibold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all shadow-md shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {isAiThinking ? 'Berpikir...' : 'Analisa Sekarang'}
                </button>
              )}
            </div>
          </div>

          {/* TOMBOL TUTUP BUKU */}
          {!lockedData && (
            <div className="pt-2 sm:pt-4">
               <button 
                 onClick={handleLockBukuBesar} 
                 disabled={isLocking} 
                 className="w-full py-3 sm:py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-[15px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/10 focus:outline-none focus:ring-2 focus:ring-slate-600"
               >
                 {isLocking ? <Loader2 className="animate-spin" size={18} strokeWidth={1.5}/> : <Lock size={18} strokeWidth={1.5}/>} 
                 Kunci Buku Keuangan Bulan Ini
               </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}