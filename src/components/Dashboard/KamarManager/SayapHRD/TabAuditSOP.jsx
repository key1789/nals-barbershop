import React, { useState, useEffect } from 'react';
import { 
  Calendar, Camera, CheckCircle2, AlertCircle, 
  Search, X, User, Clock, FileText, Loader2, Image as ImageIcon, MapPin
} from 'lucide-react';
import { supabase } from '../../../../supabaseClient'; 

export default function TabAuditSOP({ outletId }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ==========================================
  // 1. FETCH GABUNGAN DAILY DUTY & HOUSEKEEPING
  // ==========================================
  const fetchSOPLogs = async () => {
    setIsLoading(true);
    try {
      const { data: dailyData, error: dailyErr } = await supabase
        .from('daily_duty_logs')
        .select(`*, users(nama, role, photo_url)`)
        .eq('tanggal', selectedDate);

      if (dailyErr) console.error("Error DB Daily Duty:", dailyErr.message);

      // PERBAIKAN: housekeeping_sops(*) 
      // Kita pakai bintang biar dia ngambil apapun nama kolom yang ada di DB lu (gak maksa nyari kolom 'tugas' lagi)
      const { data: hkData, error: hkErr } = await supabase
        .from('housekeeping_logs')
        .select(`*, users(nama, role, photo_url), housekeeping_sops(*)`)
        .eq('tanggal', selectedDate);

      if (hkErr) console.error("Error DB Housekeeping:", hkErr.message);

      let combinedLogs = [];
      
      if (dailyData) {
        const formattedDaily = dailyData.map(d => ({
          id: `daily-${d.id}`, 
          kategori: 'Daily Duty', 
          area: 'Operasional',
          tugas: `Laporan ${d.fase || 'N/A'}`, 
          status: d.status, 
          foto_bukti: d.foto_bukti,
          catatan: d.catatan, 
          created_at: d.created_at, 
          user: d.users
        }));
        combinedLogs = [...combinedLogs, ...formattedDaily];
      }

      if (hkData) {
        const formattedHk = hkData.map(h => {
          // Fallback: Kalau nggak ada kolom 'tugas', dia coba cari 'nama_tugas', atau 'deskripsi'
          const namaTugas = h.housekeeping_sops?.tugas || h.housekeeping_sops?.nama_tugas || h.housekeeping_sops?.deskripsi || h.housekeeping_sops?.pekerjaan || 'Tugas Kebersihan';
          const namaArea = h.housekeeping_sops?.area || h.housekeeping_sops?.nama_area || 'Area';

          return {
            id: `hk-${h.id}`, 
            kategori: 'Housekeeping', 
            area: namaArea,
            tugas: namaTugas, 
            status: h.status,
            foto_bukti: h.foto_bukti, 
            catatan: h.catatan, 
            created_at: h.created_at, 
            user: h.users
          }
        });
        combinedLogs = [...combinedLogs, ...formattedHk];
      }

      combinedLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setLogs(combinedLogs);
    } catch (error) { 
      console.error("Terjadi crash saat format data:", error); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { fetchSOPLogs(); }, [selectedDate]);

  const totalLaporan = logs.length;
  const totalSelesai = logs.filter(l => l.status === 'Selesai').length;
  const totalKendala = logs.filter(l => l.status === 'Kendala').length;

  const handleBukaDetail = (log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 px-1 md:px-2 animate-in fade-in duration-300">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-500 border border-amber-100/50">
              <Camera size={22} strokeWidth={1.5}/>
            </div>
            Audit LogBook & SOP
          </h2>
          <p className="text-[14px] text-slate-500 font-medium mt-1.5 md:ml-[54px]">Pantau bukti kerja dan kebersihan area</p>
        </div>
        
        <div className="bg-white hover:bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl flex items-center gap-2 w-full md:w-auto transition-colors shadow-sm shadow-slate-100">
          <Calendar size={18} strokeWidth={1.5} className="text-slate-400 ml-1"/>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="bg-transparent font-semibold text-[15px] text-slate-700 outline-none cursor-pointer w-full focus:ring-0" 
          />
        </div>
      </div>

      {/* KARTU STATISTIK */}
      <div className="grid grid-cols-3 gap-4 md:gap-5">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 text-center">
          <span className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">{totalLaporan}</span>
          <span className="text-xs font-semibold text-slate-500 mt-1 block">Foto Masuk</span>
        </div>
        <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100/50 shadow-sm text-center">
          <span className="text-3xl md:text-4xl font-extrabold text-emerald-600 tracking-tight">{totalSelesai}</span>
          <span className="text-xs font-semibold text-emerald-600 mt-1 block">Status Selesai</span>
        </div>
        <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100/50 shadow-sm text-center">
          <span className="text-3xl md:text-4xl font-extrabold text-rose-600 tracking-tight">{totalKendala}</span>
          <span className="text-xs font-semibold text-rose-600 mt-1 block">Status Kendala</span>
        </div>
      </div>

      {/* KUMPULAN FOTO LOGBOOK */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 p-6 md:p-8 min-h-[400px]">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center py-24">
             <Loader2 className="animate-spin text-amber-400 mb-3" size={32} strokeWidth={1.5}/>
             <span className="text-[14px] font-medium text-slate-500">Memuat CCTV Radar...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <Search className="text-slate-300" size={28} strokeWidth={1.5}/>
            </div>
            <p className="text-[15px] font-medium text-slate-500">Belum ada laporan SOP di tanggal ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {logs.map((log) => {
              const jamKirim = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
              const isKendala = log.status === 'Kendala';

              return (
                <div key={log.id} onClick={() => handleBukaDetail(log)} className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-md hover:border-amber-300 cursor-pointer transition-all active:scale-[0.98] group flex flex-col">
                  
                  <div className="w-full aspect-[4/3] bg-slate-100 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                    {log.foto_bukti ? (
                      <img src={log.foto_bukti} alt="Bukti" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                    ) : (
                      <ImageIcon size={30} strokeWidth={1.5} className="text-slate-300"/>
                    )}
                    
                    <div className="absolute top-3 right-3">
                      {isKendala ? (
                        <span className="bg-white/90 backdrop-blur-md text-rose-600 text-[11px] font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-rose-100/50"><AlertCircle size={12} strokeWidth={2}/> Kendala</span>
                      ) : (
                        <span className="bg-white/90 backdrop-blur-md text-emerald-600 text-[11px] font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-emerald-100/50"><CheckCircle2 size={12} strokeWidth={2}/> Selesai</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-[11px] font-semibold text-amber-500 mb-1">{log.kategori}</p>
                    <h4 className="font-bold text-[14px] text-slate-900 line-clamp-2 mb-3 leading-snug">{log.tugas}</h4>
                    
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/80">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200/50">
                          {log.user?.photo_url ? <img src={log.user.photo_url} className="w-full h-full object-cover" alt=""/> : <User size={14} strokeWidth={1.5} className="m-auto mt-1 text-slate-400"/>}
                        </div>
                        <span className="text-[12px] font-semibold text-slate-600 truncate max-w-[80px]">{log.user?.nama?.split(' ')[0]}</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5"><Clock size={12} strokeWidth={1.5}/> {jamKirim}</span>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL LIHAT DETAIL FOTO */}
      {isModalOpen && selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white relative z-10">
              <div className="flex items-center gap-3">
                 <span className={`w-2.5 h-2.5 rounded-full ${selectedLog.status === 'Kendala' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                 <h3 className="font-extrabold text-slate-900 text-[16px] tracking-tight">Detail Laporan</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 bg-white hover:bg-slate-100 p-2 rounded-full transition-colors focus:outline-none"><X size={20} strokeWidth={1.5}/></button>
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="w-full bg-slate-100 flex items-center justify-center min-h-[300px]">
                {selectedLog.foto_bukti ? (
                  <img src={selectedLog.foto_bukti} alt="Full Bukti" className="w-full h-auto max-h-[450px] object-contain"/>
                ) : (
                  <div className="text-center text-slate-400 py-20"><ImageIcon size={40} strokeWidth={1.5} className="mx-auto mb-2 opacity-30"/><p className="text-xs font-semibold">Gambar Tidak Tersedia</p></div>
                )}
              </div>

              <div className="p-6 md:p-8 space-y-6 bg-white">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                     <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{selectedLog.kategori}</span>
                     <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full flex items-center gap-1.5"><MapPin size={12} strokeWidth={1.5}/> {selectedLog.area}</span>
                  </div>
                  <h4 className="font-extrabold text-xl text-slate-900 leading-tight">{selectedLog.tugas}</h4>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-300/50">
                    {selectedLog.user?.photo_url ? <img src={selectedLog.user.photo_url} alt="" className="w-full h-full object-cover"/> : <User size={20} strokeWidth={1.5} className="m-auto mt-3 text-slate-400"/>}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 mb-0.5">Dilaporkan Oleh</p>
                    <p className="text-[15px] font-bold text-slate-900">{selectedLog.user?.nama}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[11px] font-medium text-slate-500 mb-0.5">Jam Kirim</p>
                    <p className="text-[15px] font-bold text-slate-900">{new Date(selectedLog.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border ${selectedLog.status === 'Kendala' ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <h5 className={`text-[12px] font-bold flex items-center gap-2 mb-2 ${selectedLog.status === 'Kendala' ? 'text-rose-600' : 'text-slate-600'}`}>
                    <FileText size={14} strokeWidth={1.5}/> Catatan / Keterangan
                  </h5>
                  <p className={`text-[14px] font-medium leading-relaxed ${!selectedLog.catatan ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                    {selectedLog.catatan || "Tidak ada catatan tambahan yang dilampirkan oleh karyawan."}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}