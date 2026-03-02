import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, MapPin, Camera, User, 
  Search, AlertCircle, CheckCircle2, X, Map, ExternalLink, Loader2 
} from 'lucide-react';
import { supabase } from '../../../../supabaseClient'; 

export default function TabAbsensi({ outletId }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select(`*, users!inner(id, nama, role, photo_url)`)
        .eq('tanggal', selectedDate)
        .order('jam_masuk', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Gagal narik data absen:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, [selectedDate]);

  const totalMasuk = logs.length;
  const totalTelat = logs.filter(l => l.status_kehadiran === 'Telat' || l.menit_terlambat > 0).length;
  const totalTepatWaktu = totalMasuk - totalTelat;

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
            <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100/50">
              <Clock size={22} strokeWidth={1.5}/>
            </div>
            Radar Absensi
          </h2>
          <p className="text-[14px] text-slate-500 font-medium mt-1.5 md:ml-[54px]">Pantau kedisiplinan dan jam kerja tim</p>
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

      {/* STATISTIK HARI INI */}
      <div className="grid grid-cols-3 gap-4 md:gap-5">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 flex flex-col justify-center items-center text-center">
          <span className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">{totalMasuk}</span>
          <span className="text-xs font-semibold text-slate-500 mt-1">Total Hadir</span>
        </div>
        <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100/50 shadow-sm flex flex-col justify-center items-center text-center">
          <span className="text-3xl md:text-4xl font-extrabold text-emerald-600 tracking-tight">{totalTepatWaktu}</span>
          <span className="text-xs font-semibold text-emerald-600 mt-1">Tepat Waktu</span>
        </div>
        <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100/50 shadow-sm flex flex-col justify-center items-center text-center">
          <span className="text-3xl md:text-4xl font-extrabold text-rose-600 tracking-tight">{totalTelat}</span>
          <span className="text-xs font-semibold text-rose-600 mt-1">Terlambat</span>
        </div>
      </div>

      {/* LIST ABSENSI */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
             <Loader2 className="animate-spin text-slate-400 mb-3" size={32} strokeWidth={1.5}/>
             <span className="text-[14px] font-medium text-slate-500">Menyapu Radar...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <Search className="text-slate-300" size={28} strokeWidth={1.5}/>
            </div>
            <p className="text-[15px] font-medium text-slate-500">Belum ada data absen di tanggal ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80">
            {logs.map((log) => {
              const user = log.users;
              const isTelat = log.status_kehadiran === 'Telat' || log.menit_terlambat > 0;

              return (
                <div key={log.id} onClick={() => handleBukaDetail(log)} className="p-4 sm:p-6 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  
                  {/* Profil User */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                      {user?.photo_url ? (
                        <img src={user.photo_url} alt="" className="w-full h-full object-cover"/>
                      ) : (
                        <User size={20} strokeWidth={1.5} className="m-auto mt-3 text-slate-400"/>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-[16px] text-slate-900">{user?.nama || 'Unknown'}</h4>
                      <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full inline-block mt-1.5">{user?.role}</span>
                    </div>
                  </div>

                  {/* Jam Masuk & Pulang */}
                  <div className="flex items-center gap-6 text-[15px] font-bold bg-white px-5 py-2.5 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-50">
                    <div className="text-center">
                      <p className="text-[11px] text-slate-400 font-medium mb-0.5">Masuk</p>
                      <p className="text-slate-800 tracking-tight">{log.jam_masuk ? log.jam_masuk.substring(0,5) : '--:--'}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-200/80"></div>
                    <div className="text-center">
                      <p className="text-[11px] text-slate-400 font-medium mb-0.5">Pulang</p>
                      <p className="text-slate-800 tracking-tight">{log.jam_pulang ? log.jam_pulang.substring(0,5) : '--:--'}</p>
                    </div>
                  </div>

                  {/* Status Label */}
                  <div className="text-left sm:text-right sm:min-w-[120px]">
                    {isTelat ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-rose-50 text-rose-600 px-3 py-1.5 rounded-full border border-rose-100/50">
                           <AlertCircle size={14} strokeWidth={1.5}/> Telat
                        </span>
                        <p className="text-[12px] font-semibold text-rose-500 mt-1.5">{log.menit_terlambat} Menit</p>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100/50">
                         <CheckCircle2 size={14} strokeWidth={1.5}/> Tepat Waktu
                      </span>
                    )}
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL LIHAT DETAIL */}
      {isModalOpen && selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
                  {selectedLog.users?.photo_url ? <img src={selectedLog.users.photo_url} alt="" className="w-full h-full object-cover"/> : <User size={20} strokeWidth={1.5} className="m-auto mt-3 text-slate-400"/>}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">{selectedLog.users?.nama}</h3>
                  <p className="text-[13px] font-medium text-slate-500 mt-0.5">Bukti Kehadiran • {selectedLog.tanggal}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors bg-white rounded-full"><X size={20} strokeWidth={1.5}/></button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* BLOK CLOCK IN */}
                <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm shadow-slate-100">
                   <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
                      <span className="text-[13px] font-bold text-slate-700">1. Clock In (Masuk)</span>
                      <span className="text-[13px] font-extrabold bg-slate-100 px-3 py-1 rounded-full text-slate-800">{selectedLog.jam_masuk || '--:--'}</span>
                   </div>
                   <div className="p-5 flex flex-col items-center">
                     <div className="w-full aspect-square bg-slate-100 rounded-2xl mb-5 overflow-hidden relative border border-slate-200/60 flex items-center justify-center">
                        {selectedLog.foto_masuk ? (
                          <img src={selectedLog.foto_masuk} alt="Selfie Masuk" className="w-full h-full object-cover"/>
                        ) : (
                          <div className="text-center text-slate-400"><Camera size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-50"/><p className="text-xs font-semibold">Tidak ada foto</p></div>
                        )}
                     </div>
                     <div className="w-full bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl flex items-start gap-3">
                        <MapPin size={18} strokeWidth={1.5} className="text-indigo-500 shrink-0 mt-0.5"/>
                        <div className="flex-1">
                           <p className="text-[11px] font-semibold text-slate-500 mb-1">Koordinat GPS</p>
                           <p className="text-[13px] font-bold text-slate-800 break-all leading-tight">{selectedLog.lokasi_masuk || 'Lokasi tidak terekam'}</p>
                           {selectedLog.lokasi_masuk && (
                             <a href={`https://maps.google.com/?q=${selectedLog.lokasi_masuk}`} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-indigo-600 flex items-center gap-1 mt-2 hover:underline">
                               <ExternalLink size={12} strokeWidth={1.5}/> Buka di Gmaps
                             </a>
                           )}
                        </div>
                     </div>
                   </div>
                </div>

                {/* BLOK CLOCK OUT */}
                <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm shadow-slate-100">
                   <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
                      <span className="text-[13px] font-bold text-slate-700">2. Clock Out (Pulang)</span>
                      <span className="text-[13px] font-extrabold bg-slate-100 px-3 py-1 rounded-full text-slate-800">{selectedLog.jam_pulang || '--:--'}</span>
                   </div>
                   <div className="p-5 flex flex-col items-center">
                     <div className="w-full aspect-square bg-slate-100 rounded-2xl mb-5 overflow-hidden relative border border-slate-200/60 flex items-center justify-center">
                        {selectedLog.foto_pulang ? (
                          <img src={selectedLog.foto_pulang} alt="Selfie Pulang" className="w-full h-full object-cover"/>
                        ) : (
                          <div className="text-center text-slate-400"><Camera size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-50"/><p className="text-xs font-semibold">Tidak ada foto</p></div>
                        )}
                     </div>
                     <div className="w-full bg-rose-50/50 border border-rose-100/50 p-4 rounded-2xl flex items-start gap-3">
                        <MapPin size={18} strokeWidth={1.5} className="text-rose-500 shrink-0 mt-0.5"/>
                        <div className="flex-1">
                           <p className="text-[11px] font-semibold text-slate-500 mb-1">Koordinat GPS</p>
                           <p className="text-[13px] font-bold text-slate-800 break-all leading-tight">{selectedLog.lokasi_pulang || 'Lokasi tidak terekam / Belum Pulang'}</p>
                           {selectedLog.lokasi_pulang && (
                             <a href={`https://maps.google.com/?q=${selectedLog.lokasi_pulang}`} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-rose-600 flex items-center gap-1 mt-2 hover:underline">
                               <ExternalLink size={12} strokeWidth={1.5}/> Buka di Gmaps
                             </a>
                           )}
                        </div>
                     </div>
                   </div>
                </div>

              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white">
              <button onClick={() => setIsModalOpen(false)} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-[15px] transition-colors shadow-md shadow-slate-900/10 focus:outline-none">
                Tutup Jendela
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}