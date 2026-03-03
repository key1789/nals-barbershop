import React, { useState, useEffect } from 'react';
import { 
  Wallet, Lock, LogOut, CheckCircle2, FileText, 
  AlertCircle, Printer, Loader2, Banknote, Plus, Trash2, 
  Receipt, CalendarDays, CheckSquare, ClipboardList
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const ClosingShift = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('petty_cash'); // 'petty_cash', 'shift', 'harian'
  
  // Data State
  const [shifts, setShifts] = useState([]);
  const [pettyCashList, setPettyCashList] = useState([]);
  const [dailyStats, setDailyStats] = useState({ cash: 0, qris: 0, total_pengeluaran: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Form Petty Cash
  const [pcDesc, setPcDesc] = useState('');
  const [pcNominal, setPcNominal] = useState('');
  const [isSavingPC, setIsSavingPC] = useState(false);

  // Form Closing Shift
  const [selectedShift, setSelectedShift] = useState('');
  const [cashFisik, setCashFisik] = useState('');
  const [catatanShift, setCatatanShift] = useState('');
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const startOfDay = today.toISOString();
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
      const endOfToday = endOfDay.toISOString();
      const tanggalHariIni = today.toISOString().split('T')[0];

      // 1. Tarik Shifts
      const { data: shiftData } = await supabase.from('shifts').select('*').eq('outlet_id', user.outlet_id).eq('is_active', true).order('jam_mulai', { ascending: true });
      if (shiftData) {
        setShifts(shiftData);
        if (!selectedShift) setSelectedShift(shiftData[0]?.nama_shift);
      }

      // 2. Tarik Petty Cash Hari Ini
      const { data: pcData } = await supabase.from('petty_cash_transactions')
        .select('*').eq('outlet_id', user.outlet_id).eq('tanggal', tanggalHariIni).order('created_at', { ascending: false });
      
      let tPengeluaran = 0;
      if (pcData) {
        setPettyCashList(pcData);
        tPengeluaran = pcData.reduce((sum, item) => sum + Number(item.nominal), 0);
      }

      // 3. Tarik Transaksi Harian (Omset)
      const { data: trxData } = await supabase.from('visits')
        .select('total_tagihan, metode_bayar').eq('outlet_id', user.outlet_id).eq('status_transaksi', 'Paid')
        .gte('created_at', startOfDay).lte('created_at', endOfToday);

      let tCash = 0; let tQris = 0;
      if (trxData) {
        trxData.forEach(trx => {
          if (trx.metode_bayar === 'Cash') tCash += (trx.total_tagihan || 0);
          else tQris += (trx.total_tagihan || 0);
        });
      }

      setDailyStats({ cash: tCash, qris: tQris, total_pengeluaran: tPengeluaran });
    } catch (err) { console.error("Error fetchData:", err); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (user?.outlet_id) fetchData();
  }, [user]);

  // --- FUNGSI SUBMIT PETTY CASH ---
  const handleSavePettyCash = async () => {
    if (!pcDesc.trim()) return alert("Deskripsi wajib diisi!");
    const num = parseInt(pcNominal.replace(/[^0-9]/g, ''), 10) || 0;
    if (num <= 0) return alert("Nominal tidak valid!");
    
    setIsSavingPC(true);
    try {
      const payload = {
        outlet_id: user.outlet_id,
        deskripsi: pcDesc,
        nominal: num,
        created_by: user.id,
        tanggal: new Date().toISOString().split('T')[0],
        jenis: 'Keluar',
        kategori: 'Operasional Kasir'
      };
      await supabase.from('petty_cash_transactions').insert([payload]);
      setPcDesc(''); setPcNominal('');
      await fetchData(); // Refresh data biar totalnya update
    } catch (err) { alert("Gagal simpan petty cash"); } 
    finally { setIsSavingPC(false); }
  };

  const handleDeletePettyCash = async (id) => {
    if(!window.confirm("Yakin hapus log pengeluaran ini?")) return;
    try {
      await supabase.from('petty_cash_transactions').delete().eq('id', id);
      fetchData();
    } catch (err) { alert("Gagal hapus!"); }
  };

  // --- FUNGSI SUBMIT CLOSING SHIFT ---
  const handleClosingShift = async () => {
    if (!selectedShift) return alert("Pilih Shift terlebih dahulu!");
    if (!cashFisik || cashFisik === '') return alert("Uang fisik di laci wajib diisi!");

    const numericCashFisik = parseInt(cashFisik.replace(/[^0-9]/g, ''), 10) || 0;
    const expectedCash = dailyStats.cash - dailyStats.total_pengeluaran;
    const selisih = numericCashFisik - expectedCash;
    const tanggalHariIni = new Date().toISOString().split('T')[0];

    if(!window.confirm(`Yakin tutup shift ${selectedShift} sekarang? Pastikan uang fisik sudah dihitung dengan benar.`)) return;

    setIsSubmittingShift(true);
    try {
      const payloadShift = {
        outlet_id: user.outlet_id,
        fo_id: user.id, 
        shift: selectedShift,
        cash_system: expectedCash, 
        cash_fisik: numericCashFisik,
        selisih: selisih,
        qris_total_system: dailyStats.qris,
        qris_total_verified: 0, 
        status_setoran: 'Pending',
        catatan_closing: catatanShift || '-',
        tanggal: tanggalHariIni
      };

      await supabase.from('shift_closings').insert([payloadShift]);
      setIsDone(true);
      
      // Auto Print & Logout
      setTimeout(() => {
        window.print();
        setTimeout(() => { onLogout(); }, 1500);
      }, 500);
    } catch (err) {
      alert("Gagal menutup shift: " + err.message);
      setIsSubmittingShift(false);
    }
  };

  // --- RENDER AREA PRINT THERMAL (TERSEMBUNYI) ---
  const PrintThermal = () => (
    <div className="hidden print:flex print:fixed print:inset-0 print:bg-white print:z-[99999] print:items-start print:justify-center w-full text-black font-mono p-4 text-[12px] uppercase">
      <div className="w-[58mm] pt-4">
          <div className="text-center border-b-2 border-dashed border-black pb-4 mb-4">
              <h2 className="text-lg font-bold italic">{user?.outlet_name || "NAL'S BARBERSHOP"}</h2>
              <p className="text-[10px]">
                {activeTab === 'shift' ? 'Laporan Tutup Shift' : 'Rekap Harian Toko'}
              </p>
          </div>
          
          <div className="mb-4 space-y-1 text-[10px]">
            <div className="flex justify-between"><span>Tanggal</span><span>{new Date().toLocaleDateString('id-ID')}</span></div>
            <div className="flex justify-between"><span>Jam</span><span>{new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span></div>
            <div className="flex justify-between"><span>Kasir</span><span>{user?.nama || 'N/A'}</span></div>
            {activeTab === 'shift' && <div className="flex justify-between"><span>Shift</span><span>{selectedShift || '-'}</span></div>}
          </div>

          {activeTab === 'shift' ? (
            <>
              {/* PRINT BLIND CLOSING SHIFT */}
              <div className="border-t-2 border-dashed border-black py-4 mb-2 space-y-2">
                  <p className="font-bold text-center border border-black inline-block px-2 py-1 mx-auto mb-2">UANG FISIK DILAPORKAN</p>
                  <div className="flex justify-between font-black text-sm">
                    <span>CASH LACI</span>
                    <span>{formatIDR(parseInt(cashFisik.replace(/[^0-9]/g, ''), 10) || 0)}</span>
                  </div>
              </div>
              <div className="border-t border-black py-2 mb-4">
                <p className="text-[10px] font-bold mb-1">Catatan Shift:</p>
                <p className="text-[10px] whitespace-pre-wrap">{catatanShift || '-'}</p>
              </div>
            </>
          ) : (
            <>
              {/* PRINT REKAP HARIAN (TRANSPARAN) */}
              <div className="border-t-2 border-dashed border-black py-2 mb-2 space-y-1">
                 <div className="flex justify-between font-bold"><span>Total Cash Murni</span><span>{dailyStats.cash.toLocaleString('id-ID')}</span></div>
                 <div className="flex justify-between font-bold"><span>Total QRIS/TF</span><span>{dailyStats.qris.toLocaleString('id-ID')}</span></div>
              </div>
              <div className="border-t border-black py-2 mb-2">
                 <p className="text-[10px] font-bold mb-1">Total Pengeluaran Laci:</p>
                 {pettyCashList.map((pc, i) => (
                   <div key={i} className="flex justify-between text-[9px] mb-1">
                     <span className="truncate pr-2">{pc.deskripsi}</span>
                     <span>{Number(pc.nominal).toLocaleString('id-ID')}</span>
                   </div>
                 ))}
                 <div className="flex justify-between font-bold text-[10px] mt-2 pt-1 border-t border-dashed border-black text-rose-600">
                   <span>Total Keluar</span>
                   <span>- {dailyStats.total_pengeluaran.toLocaleString('id-ID')}</span>
                 </div>
              </div>
              <div className="border-t-2 border-dashed border-black pt-2 pb-4 space-y-1">
                 <p className="font-bold text-center border border-black inline-block px-2 py-1 mx-auto mb-2 w-full">ESTIMASI CASH LACI</p>
                 <div className="flex justify-between font-black text-sm">
                   <span>CASH SYSTEM</span>
                   <span>{(dailyStats.cash - dailyStats.total_pengeluaran).toLocaleString('id-ID')}</span>
                 </div>
              </div>
            </>
          )}
          
          <div className="mt-8 space-y-6 text-center text-[10px]">
            <div className="flex justify-between px-2">
              <div className="flex flex-col items-center">
                <span className="mb-8">Menyerahkan,</span>
                <span className="border-t border-black w-20">Kasir FO</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="mb-8">Menerima,</span>
                <span className="border-t border-black w-20">Manager</span>
              </div>
            </div>
          </div>
          <div className="text-center italic mt-8 text-[9px]">
            {activeTab === 'shift' ? '*Sistem Blind Closing Aktif.' : '*Laporan Transparan Z-Report.'}
          </div>
      </div>
    </div>
  );

  if (isDone) {
    return (
      <div className="flex h-full bg-slate-900 items-center justify-center relative p-6">
        <PrintThermal />
        <div className="w-full max-w-md bg-slate-800 border border-slate-700 p-10 rounded-[2.5rem] shadow-2xl text-center text-white relative z-10 print:hidden">
          <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={50} /></div>
          <h2 className="text-3xl font-black uppercase tracking-widest mb-2">Shift Terkunci</h2>
          <p className="text-slate-400 font-bold mb-8">Mencetak struk & keluar aplikasi otomatis...</p>
          <Loader2 size={30} className="animate-spin text-indigo-400 mx-auto"/>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#f8fafc] font-sans overflow-hidden text-slate-900 relative">
      <PrintThermal />

      <div className="flex-1 flex flex-col p-6 md:p-8 overflow-hidden max-w-4xl mx-auto w-full">
        
        {/* HEADER & TAB NAVIGATION */}
        <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex justify-between items-center mb-6 shrink-0">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full">
            <button onClick={() => setActiveTab('petty_cash')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'petty_cash' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Receipt size={16}/> 1. Petty Cash
            </button>
            <button onClick={() => setActiveTab('shift')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'shift' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Lock size={16}/> 2. Tutup Shift
            </button>
            <button onClick={() => setActiveTab('harian')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'harian' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <ClipboardList size={16}/> 3. Rekap Harian
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
          {isLoading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>
          ) : (
            <>
              {/* =========================================
                  TAB 1: PETTY CASH (PENGELUARAN REALTIME) 
              ============================================= */}
              {activeTab === 'petty_cash' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-black text-slate-800 uppercase italic mb-1 flex items-center gap-2"><FileText className="text-indigo-500"/> Input Pengeluaran Laci</h2>
                    <p className="text-xs font-bold text-slate-400 mb-6">Catat pengeluaran operasional (galon, parkir, dll) agar cash laci balance.</p>
                    
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Untuk Kebutuhan / Beli Apa?</label>
                        <input type="text" placeholder="Cth: Beli Galon Aqua..." className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" value={pcDesc} onChange={e => setPcDesc(e.target.value)} />
                      </div>
                      <div className="w-full md:w-1/3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nominal (Rp)</label>
                        <input type="number" placeholder="20000" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" value={pcNominal} onChange={e => setPcNominal(e.target.value)} />
                      </div>
                      <div className="w-full md:w-auto flex items-end">
                        <button onClick={handleSavePettyCash} disabled={isSavingPC} className="w-full md:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2">
                          {isSavingPC ? <Loader2 size={16} className="animate-spin"/> : <><Plus size={16}/> Simpan</>}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b-2 border-slate-100 pb-4 mb-4">Riwayat Pengeluaran Hari Ini</h3>
                    {pettyCashList.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm font-bold py-6 italic">Belum ada pengeluaran hari ini.</p>
                    ) : (
                      <div className="space-y-3">
                        {pettyCashList.map(pc => (
                          <div key={pc.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-rose-200 transition-colors group">
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase">{pc.deskripsi}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-1">{new Date(pc.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} • Kasir</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-base font-black text-rose-500">- {formatIDR(pc.nominal)}</span>
                              <button onClick={() => handleDeletePettyCash(pc.id)} className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-300 transition-colors shadow-sm"><Trash2 size={14}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================
                  TAB 2: CLOSING SHIFT (KASIR PULANG)
              ============================================= */}
              {activeTab === 'shift' && (
                <div className="max-w-2xl mx-auto bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white animate-in zoom-in-95">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4"><Lock size={32} /></div>
                    <h2 className="text-3xl font-black uppercase tracking-tight italic">Tutup Laci Shift</h2>
                    <p className="text-sm text-slate-400 mt-2">Sistem Blind Closing Aktif</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Pilih Shift Kamu</label>
                      <div className="grid grid-cols-2 gap-3">
                        {shifts.map(s => (
                          <button key={s.id} onClick={() => setSelectedShift(s.nama_shift)} className={`py-4 rounded-2xl border-2 font-black uppercase text-sm transition-all ${selectedShift === s.nama_shift ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>{s.nama_shift}</button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-3xl border-2 border-slate-700">
                      <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-3"><Banknote size={14}/> Hitung Uang Fisik Laci</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-500">Rp</span>
                        <input type="number" placeholder="0" className="w-full pl-16 pr-6 py-5 bg-slate-900 border-2 border-slate-600 rounded-2xl text-3xl font-black text-white outline-none focus:border-emerald-500 transition-colors" value={cashFisik} onChange={e => setCashFisik(e.target.value)} />
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-3 italic text-center">*(Pastikan nominal yang dihitung sudah benar)</p>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Catatan Shift (Opsional)</label>
                      <textarea rows="2" placeholder="Tulis kejadian penting hari ini..." className="w-full p-4 bg-slate-800 border-2 border-slate-700 rounded-2xl font-bold text-sm text-white outline-none focus:border-indigo-500 transition-colors" value={catatanShift} onChange={e => setCatatanShift(e.target.value)}></textarea>
                    </div>

                    <button onClick={handleClosingShift} disabled={isSubmittingShift} className="w-full py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-rose-600/30 active:scale-95 transition-all flex items-center justify-center gap-3">
                      {isSubmittingShift ? <Loader2 size={24} className="animate-spin"/> : <><LogOut size={20}/> Kunci Shift & Logout</>}
                    </button>
                  </div>
                </div>
              )}

              {/* =========================================
                  TAB 3: REKAP HARIAN (Z-REPORT) 
              ============================================= */}
              {activeTab === 'harian' && (
                <div className="max-w-2xl mx-auto bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200 animate-in fade-in slide-in-from-right-4">
                  <div className="text-center mb-8 border-b-2 border-slate-100 pb-8">
                    <CalendarDays size={40} className="text-rose-500 mx-auto mb-4"/>
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Z-Report Harian</h2>
                    <p className="text-sm font-bold text-slate-400 mt-2">Ringkasan Sistem Hari Ini (Transparan)</p>
                  </div>

                  <div className="space-y-4 mb-10">
                    <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Pemasukan Tunai (Cash)</span>
                      <span className="text-xl font-black text-emerald-600">{formatIDR(dailyStats.cash)}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">Pemasukan QRIS/TF</span>
                      <span className="text-xl font-black text-indigo-600">{formatIDR(dailyStats.qris)}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-rose-50 rounded-2xl border border-rose-100">
                      <span className="text-xs font-black text-rose-700 uppercase tracking-widest">Pengeluaran Petty Cash</span>
                      <span className="text-xl font-black text-rose-600">- {formatIDR(dailyStats.total_pengeluaran)}</span>
                    </div>
                    
                    <div className="mt-4 pt-6 border-t-2 border-dashed border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Estimasi Uang Fisik Seharusnya (Cash System)</p>
                      <p className="text-5xl font-black text-slate-800 text-center italic">{formatIDR(dailyStats.cash - dailyStats.total_pengeluaran)}</p>
                    </div>
                  </div>

                  <button onClick={() => window.print()} className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <Printer size={20}/> Cetak Rekap Harian (Z-Report)
                  </button>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClosingShift;