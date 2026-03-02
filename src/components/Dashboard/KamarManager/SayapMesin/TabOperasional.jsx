import React, { useState, useEffect, useRef } from 'react';
// PERBAIKAN: Camera udah ditambahkan di baris import ini 👇
import { Clock, Plus, ClipboardList, ClipboardCheck, Users, Layers, Map, Trash2, X, Loader2, Camera } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

export default function TabOperasional({ user }) {
   const [isLoading, setIsLoading] = useState(false);
   const [outletList, setOutletList] = useState([]);
   
   const [shiftList, setShiftList] = useState([]);
   const [dailyDutyList, setDailyDutyList] = useState([]);
   const [housekeepingList, setHousekeepingList] = useState([]);
   
   const [isModalShiftOpen, setIsModalShiftOpen] = useState(false);
   const [shiftMode, setShiftMode] = useState('add');
   const [shiftForm, setShiftForm] = useState({ 
      id: null, outlet_id: '', nama_shift: 'Pagi', jam_mulai: '09:00', jam_selesai: '15:00', is_active: true 
   });
   const [isSavingShift, setIsSavingShift] = useState(false);
   const shiftModalRef = useRef(null);

   const [isModalDailyOpen, setIsModalDailyOpen] = useState(false);
   const [dailyMode, setDailyMode] = useState('add');
   const [dailyForm, setDailyForm] = useState({ 
      id: null, outlet_id: '', role: 'FO', phase: 'Opening', fase_kategori: '', urutan: '', aktivitas: '', tipe: 'Checklist', catatan: '', is_active: true 
   });
   const [isSavingDaily, setIsSavingDaily] = useState(false);
   const dailyModalRef = useRef(null);

   const [isModalHkOpen, setIsModalHkOpen] = useState(false);
   const [hkMode, setHkMode] = useState('add');
   const [hkForm, setHkForm] = useState({ 
      id: null, outlet_id: '', area: '', zona: '', phase: '', no_urut: '', rincian_jobdesk: '', wajib_foto: true, is_active: true 
   });
   const [isSavingHk, setIsSavingHk] = useState(false);
   const hkModalRef = useRef(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [outletRes, shiftRes, dailyRes, hkRes] = await Promise.all([
        supabase.from('outlets').select('id, nama_outlet').eq('is_active', true),
        supabase.from('shifts').select('*').order('jam_mulai', { ascending: true }),
        supabase.from('daily_duty_sops').select('*').order('urutan', { ascending: true }),
        supabase.from('housekeeping_sops').select('*').order('no_urut', { ascending: true })
      ]);

      setOutletList(outletRes.data || []);
      setShiftList(shiftRes.data || []);
      setDailyDutyList(dailyRes.data || []);
      setHousekeepingList(hkRes.data || []);
    } catch (error) {
      console.error("Gagal narik data operasional:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

   const handleSaveShift = async (e) => {
      e.preventDefault(); 
      if (!shiftForm.outlet_id) return alert("Pilih cabang dulu!");
      setIsSavingShift(true);
      try {
         const payload = { ...shiftForm }; 
         if (shiftMode === 'add') { 
            delete payload.id; await supabase.from('shifts').insert([payload]); 
         } else { 
            await supabase.from('shifts').update(payload).eq('id', shiftForm.id); 
         }
         setIsModalShiftOpen(false); fetchData();
      } catch (error) { alert("Gagal simpan shift: " + error.message); }
      finally { setIsSavingShift(false); }
   };

   const handleSaveDailyDuty = async (e) => {
      e.preventDefault(); 
      if (!dailyForm.outlet_id) return alert("Pilih cabang dulu!");
      setIsSavingDaily(true);
      try {
         const payload = { ...dailyForm }; 
         if (dailyMode === 'add') { 
            delete payload.id; await supabase.from('daily_duty_sops').insert([payload]); 
         } else { 
            await supabase.from('daily_duty_sops').update(payload).eq('id', dailyForm.id); 
         }
         setIsModalDailyOpen(false); fetchData();
      } catch (error) { alert("Gagal simpan Daily Duty: " + error.message); }
      finally { setIsSavingDaily(false); }
   };

   const handleSaveHousekeeping = async (e) => {
      e.preventDefault(); 
      if (!hkForm.outlet_id) return alert("Pilih cabang dulu!");
      setIsSavingHk(true);
      try {
         const payload = { ...hkForm }; 
         if (hkMode === 'add') { 
            delete payload.id; await supabase.from('housekeeping_sops').insert([payload]); 
         } else { 
            await supabase.from('housekeeping_sops').update(payload).eq('id', hkForm.id); 
         }
         setIsModalHkOpen(false); fetchData();
      } catch (error) { alert("Gagal simpan Housekeeping: " + error.message); }
      finally { setIsSavingHk(false); }
   };

   useEffect(() => {
      const handleKey = (e) => {
         if (e.key === 'Escape') {
            if (isModalShiftOpen) setIsModalShiftOpen(false);
            if (isModalDailyOpen) setIsModalDailyOpen(false);
            if (isModalHkOpen) setIsModalHkOpen(false);
         }
      };
      if (isModalShiftOpen || isModalDailyOpen || isModalHkOpen) {
         document.body.style.overflow = 'hidden';
         window.addEventListener('keydown', handleKey);
         setTimeout(() => {
            if (isModalShiftOpen && shiftModalRef.current) shiftModalRef.current.focus();
            if (isModalDailyOpen && dailyModalRef.current) dailyModalRef.current.focus();
            if (isModalHkOpen && hkModalRef.current) hkModalRef.current.focus();
         }, 10);
      } else {
         document.body.style.overflow = '';
         window.removeEventListener('keydown', handleKey);
      }
      return () => {
         document.body.style.overflow = '';
         window.removeEventListener('keydown', handleKey);
      };
   }, [isModalShiftOpen, isModalDailyOpen, isModalHkOpen]);

  const handleDeleteSOP = async (table, id) => {
    if(!window.confirm("Yakin hapus SOP ini permanen?")) return;
    try { 
      await supabase.from(table).delete().eq('id', id); 
      fetchData(); 
      setIsModalShiftOpen(false);
      setIsModalDailyOpen(false);
      setIsModalHkOpen(false);
    } catch (error) { alert("Gagal hapus data!"); }
  };

  const groupedDailyDuty = dailyDutyList.reduce((acc, duty) => {
    if (!acc[duty.role]) acc[duty.role] = {};
    if (!acc[duty.role][duty.phase]) acc[duty.role][duty.phase] = {};
    if (!acc[duty.role][duty.phase][duty.fase_kategori]) acc[duty.role][duty.phase][duty.fase_kategori] = [];
    acc[duty.role][duty.phase][duty.fase_kategori].push(duty);
    return acc;
  }, {});

  const groupedHousekeeping = housekeepingList.reduce((acc, hk) => {
    if (!acc[hk.area]) acc[hk.area] = {};
    if (!acc[hk.area][hk.phase]) acc[hk.area][hk.phase] = {};
    if (!acc[hk.area][hk.phase][hk.zona]) acc[hk.area][hk.phase][hk.zona] = [];
    acc[hk.area][hk.phase][hk.zona].push(hk);
    return acc;
  }, {});


  return (
   <div className="space-y-8 px-1 md:px-2 animate-in fade-in duration-300 min-h-[100dvh]">
      
      {/* ZONA 1: MASTER SHIFT */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/60 shadow-sm">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-5 mb-5 gap-4">
           <div>
              <h2 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-500 border border-indigo-100/50">
                  <Clock size={20} strokeWidth={1.5}/>
                </div>
                Master Jam Kerja (Shift)
              </h2>
              <p className="text-[13px] font-medium text-slate-500 mt-1 md:ml-[44px]">Pengaturan absen masuk & keluar</p>
           </div>
           <button 
              onClick={() => { 
                setShiftMode('add'); 
                setShiftForm({ id: null, outlet_id: '', nama_shift: 'Pagi', jam_mulai: '09:00', jam_selesai: '15:00', is_active: true }); 
                setIsModalShiftOpen(true); 
              }} 
              className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl font-semibold text-[14px] shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 active:scale-95 focus:outline-none"
           >
              <Plus size={18} strokeWidth={1.5}/> Tambah Shift
           </button>
         </div>

         {isLoading ? (
            <div className="text-center p-8 text-slate-400 font-medium flex flex-col items-center">
              <Loader2 size={24} strokeWidth={1.5} className="animate-spin mb-2 text-indigo-400"/>
              Memuat shift...
            </div>
         ) : shiftList.length === 0 ? (
           <div className="text-center p-8 border border-dashed border-slate-300 rounded-3xl text-slate-500 font-medium bg-slate-50/50">Belum ada data Shift.</div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {shiftList.map(s => (
               <div 
                  key={s.id} 
                  onClick={() => { setShiftMode('edit'); setShiftForm(s); setIsModalShiftOpen(true); }} 
                  className="p-5 bg-white border border-slate-200/80 rounded-3xl flex justify-between items-center cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group"
               >
                 <div className="min-w-0">
                   <h4 className="font-bold text-[15px] text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{s.nama_shift}</h4>
                   <p className="text-[13px] font-semibold text-slate-500 mt-0.5">{s.jam_mulai} - {s.jam_selesai}</p>
                   <span className="inline-block mt-2 text-[10px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md truncate max-w-full">
                     {outletList.find(o => o.id === s.outlet_id)?.nama_outlet || 'Semua Cabang'}
                   </span>
                 </div>
               </div>
             ))}
           </div>
         )}
      </div>

      {/* ZONA BAWAH: DAILY DUTY & HOUSEKEEPING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* ZONA 2: DAILY DUTY SOP */}
        <div className="bg-sky-50/50 rounded-3xl p-6 md:p-8 border border-sky-100/80 shadow-sm flex flex-col max-h-[800px]">
          <div className="flex justify-between items-center mb-5 border-b border-sky-200/50 pb-5 shrink-0">
            <div>
               <h2 className="text-lg font-extrabold text-sky-900 flex items-center gap-2">
                 <ClipboardList size={20} strokeWidth={1.5} className="text-sky-600"/> Daily Duty (Role)
               </h2>
               <p className="text-[12px] font-medium text-sky-700/80 mt-1 md:ml-[28px]">Tugas melekat pada Jabatan</p>
            </div>
            <button 
               onClick={() => { 
                 setDailyMode('add'); 
                 setDailyForm({ id: null, outlet_id: '', role: 'FO', phase: 'Opening', fase_kategori: 'Persiapan', urutan: 1, aktivitas: '', tipe: 'Checklist', catatan: '', is_active: true }); 
                 setIsModalDailyOpen(true); 
               }} 
               className="p-3 bg-sky-500 text-white rounded-2xl hover:bg-sky-600 shadow-md shadow-sky-200 active:scale-95 transition-all focus:outline-none"
            >
               <Plus size={18} strokeWidth={1.5}/>
            </button>
          </div>
          
          <div className="space-y-5 overflow-y-auto pr-2 flex-1 no-scrollbar pb-4">
            {isLoading ? (
               <div className="text-center p-8 text-sky-600/50 font-medium">Memuat tugas...</div>
            ) : Object.keys(groupedDailyDuty).length === 0 ? (
               <p className="text-center text-sm font-medium text-sky-600/70 py-10 border border-dashed border-sky-200 bg-white rounded-3xl">Belum ada tugas.</p>
            ) : (
               Object.keys(groupedDailyDuty).map(role => (
                  <div key={role} className="bg-white border border-sky-100 rounded-3xl overflow-hidden shadow-sm">
                     <div className="bg-sky-100/50 px-5 py-3 font-extrabold text-[13px] text-sky-900 flex items-center gap-2 tracking-wider">
                       <Users size={16} strokeWidth={1.5}/> ROLE: {role}
                     </div>
                     
                     <div className="p-4 md:p-5 space-y-4">
                        {Object.keys(groupedDailyDuty[role]).map(phase => (
                           <div key={phase} className="pl-4 border-l-2 border-sky-200">
                              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Layers size={14} strokeWidth={1.5}/> PHASE: {phase}
                              </div>
                              
                              <div className="space-y-3">
                                 {Object.keys(groupedDailyDuty[role][phase]).map(kategori => (
                                    <div key={kategori} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                                       <div className="text-[10px] font-extrabold text-indigo-600 uppercase mb-2.5 bg-indigo-50 inline-block px-2.5 py-1 rounded-md tracking-wider">[{kategori}]</div>
                                       <div className="space-y-2">
                                          {groupedDailyDuty[role][phase][kategori].map(duty => (
                                             <div 
                                                key={duty.id} 
                                                onClick={() => { setDailyMode('edit'); setDailyForm(duty); setIsModalDailyOpen(true); }} 
                                                className="flex justify-between items-center p-3 bg-white border border-slate-200/80 rounded-xl cursor-pointer hover:border-sky-400 hover:shadow-sm transition-all group gap-3"
                                             >
                                                <p className="text-[13px] font-semibold text-slate-800 flex-1 leading-snug">{duty.urutan}. {duty.aktivitas}</p>
                                                {duty.tipe !== 'Checklist' && <span className="text-[9px] font-extrabold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded shrink-0">{duty.tipe}</span>}
                                             </div>
                                          ))}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               ))
            )}
          </div>
        </div>

        {/* ZONA 3: HOUSEKEEPING SOP */}
        <div className="bg-emerald-50/50 rounded-3xl p-6 md:p-8 border border-emerald-100/80 shadow-sm flex flex-col max-h-[800px]">
          <div className="flex justify-between items-center mb-5 border-b border-emerald-200/50 pb-5 shrink-0">
            <div>
               <h2 className="text-lg font-extrabold text-emerald-900 flex items-center gap-2">
                 <ClipboardCheck size={20} strokeWidth={1.5} className="text-emerald-600"/> Housekeeping (Area)
               </h2>
               <p className="text-[12px] font-medium text-emerald-700/80 mt-1 md:ml-[28px]">Tugas kebersihan Zona Ruko</p>
            </div>
            <button 
               onClick={() => { 
                 setHkMode('add'); 
                 setHkForm({ id: null, outlet_id: '', area: 'Indoor', zona: 'Area Potong', phase: 'Closing', no_urut: 1, rincian_jobdesk: '', wajib_foto: true, is_active: true }); 
                 setIsModalHkOpen(true); 
               }} 
               className="p-3 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 shadow-md shadow-emerald-200 active:scale-95 transition-all focus:outline-none"
            >
               <Plus size={18} strokeWidth={1.5}/>
            </button>
          </div>
          
          <div className="space-y-5 overflow-y-auto pr-2 flex-1 no-scrollbar pb-4">
            {isLoading ? (
               <div className="text-center p-8 text-emerald-600/50 font-medium">Memuat jobdesk...</div>
            ) : Object.keys(groupedHousekeeping).length === 0 ? (
               <p className="text-center text-sm font-medium text-emerald-600/70 py-10 border border-dashed border-emerald-200 bg-white rounded-3xl">Belum ada jobdesk.</p>
            ) : (
               Object.keys(groupedHousekeeping).map(area => (
                  <div key={area} className="bg-white border border-emerald-100 rounded-3xl overflow-hidden shadow-sm">
                     <div className="bg-emerald-100/50 px-5 py-3 font-extrabold text-[13px] text-emerald-900 flex items-center gap-2 tracking-wider">
                       <Map size={16} strokeWidth={1.5}/> AREA: {area}
                     </div>
                     
                     <div className="p-4 md:p-5 space-y-4">
                        {Object.keys(groupedHousekeeping[area]).map(phase => (
                           <div key={phase} className="pl-4 border-l-2 border-emerald-200">
                              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Layers size={14} strokeWidth={1.5}/> PHASE: {phase}
                              </div>
                              
                              <div className="space-y-3">
                                 {Object.keys(groupedHousekeeping[area][phase]).map(zona => (
                                    <div key={zona} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                                       <div className="text-[10px] font-extrabold text-amber-700 uppercase mb-2.5 bg-amber-50 inline-block px-2.5 py-1 rounded-md tracking-wider">ZONA: {zona}</div>
                                       <div className="space-y-2">
                                          {groupedHousekeeping[area][phase][zona].map(hk => (
                                             <div 
                                                key={hk.id} 
                                                onClick={() => { setHkMode('edit'); setHkForm(hk); setIsModalHkOpen(true); }} 
                                                className="flex justify-between items-center p-3 bg-white border border-slate-200/80 rounded-xl cursor-pointer hover:border-emerald-400 hover:shadow-sm transition-all group"
                                             >
                                                <div className="flex-1">
                                                   <p className="text-[13px] font-semibold text-slate-800 leading-snug">{hk.no_urut}. {hk.rincian_jobdesk}</p>
                                                   {hk.wajib_foto && <p className="text-[10px] font-bold text-rose-500 mt-1 flex items-center gap-1"><Camera size={14} strokeWidth={1.5}/> Wajib Foto</p>}
                                                </div>
                                             </div>
                                          ))}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               ))
            )}
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* MODALS */}
      {/* ========================================================== */}

      {/* MODAL SHIFT */}
         {isModalShiftOpen && (
            <div
               className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"
               tabIndex={-1}
               aria-modal="true"
               role="dialog"
               onClick={e => { if (e.target === e.currentTarget) setIsModalShiftOpen(false); }}
            >
                <div
                   ref={shiftModalRef}
                   tabIndex={0}
                   className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 outline-none"
                >
                  <div className="px-6 py-5 border-b flex justify-between items-center bg-white">
                      <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2"><Clock size={20} className="text-indigo-500"/> Master Shift</h2>
                      <button onClick={() => setIsModalShiftOpen(false)} className="text-slate-400 hover:bg-slate-100 rounded-full p-2 focus:outline-none" aria-label="Tutup modal"><X size={20} strokeWidth={1.5}/></button>
                  </div>
                  <form onSubmit={handleSaveShift} className="p-6 space-y-5 bg-slate-50/50">
               <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Berlaku di Cabang</label>
                  <select required value={shiftForm.outlet_id || ''} onChange={e => setShiftForm({...shiftForm, outlet_id: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all appearance-none">
                     <option value="" disabled>-- Pilih Cabang --</option>
                     {outletList.map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nama Shift</label>
                  <input required value={shiftForm.nama_shift || ''} onChange={e => setShiftForm({...shiftForm, nama_shift: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="Pagi / Malam"/>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Jam Mulai</label>
                     <input type="time" required value={shiftForm.jam_mulai || ''} onChange={e => setShiftForm({...shiftForm, jam_mulai: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"/>
                  </div>
                  <div>
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Jam Selesai</label>
                     <input type="time" required value={shiftForm.jam_selesai || ''} onChange={e => setShiftForm({...shiftForm, jam_selesai: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"/>
                  </div>
               </div>
               <div className="flex gap-3 pt-2">
                 {shiftMode === 'edit' && <button type="button" onClick={() => handleDeleteSOP('shifts', shiftForm.id)} className="p-3.5 bg-white border border-rose-200 text-rose-600 rounded-2xl hover:bg-rose-50 transition-colors focus:outline-none" aria-label="Hapus Shift"><Trash2 size={20} strokeWidth={1.5}/></button>}
                 <button type="submit" disabled={isSavingShift} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl font-bold shadow-md active:scale-[0.98] transition-all focus:outline-none flex items-center justify-center gap-2" aria-label="Simpan Shift">{isSavingShift ? <Loader2 size={18} className="animate-spin"/> : null}Simpan Shift</button>
               </div>
            </form>
           </div>
        </div>
      )}

      {/* MODAL DAILY DUTY */}
         {isModalDailyOpen && (
            <div
               className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"
               tabIndex={-1}
               aria-modal="true"
               role="dialog"
               onClick={e => { if (e.target === e.currentTarget) setIsModalDailyOpen(false); }}
            >
                <div
                   ref={dailyModalRef}
                   tabIndex={0}
                   className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 outline-none"
                >
                  <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
                      <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2"><ClipboardList size={20} className="text-sky-500"/> Form Daily Duty</h2>
                      <button onClick={() => setIsModalDailyOpen(false)} className="text-slate-400 hover:bg-slate-100 rounded-full p-2 focus:outline-none" aria-label="Tutup modal"><X size={20} strokeWidth={1.5}/></button>
                  </div>
                  <form onSubmit={handleSaveDailyDuty} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto bg-slate-50/50">
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cabang</label>
                     <select required value={dailyForm.outlet_id || ''} onChange={e => setDailyForm({...dailyForm, outlet_id: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 appearance-none transition-all">
                        <option value="" disabled>-- Pilih Cabang --</option>
                        {outletList.map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Target Role</label>
                     <select required value={dailyForm.role || 'FO'} onChange={e => setDailyForm({...dailyForm, role: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 appearance-none transition-all">
                        <option value="FO">Front Office</option>
                        <option value="Capster">Capster</option>
                        <option value="Manager">Manager</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Phase Waktu</label>
                     <select required value={dailyForm.phase || 'Opening'} onChange={e => setDailyForm({...dailyForm, phase: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 appearance-none transition-all">
                        <option value="PraOpening">PraOpening</option>
                        <option value="Opening">Opening</option>
                        <option value="Closing">Closing</option>
                        <option value="Standby">Standby / Selama Shift</option>
                     </select>
                  </div>
               </div>
               <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3">
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Fase Kategori</label>
                     <input required value={dailyForm.fase_kategori || ''} onChange={e => setDailyForm({...dailyForm, fase_kategori: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 transition-all" placeholder="Misal: Persiapan Alat"/>
                  </div>
                  <div>
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Urutan</label>
                     <input type="number" required value={dailyForm.urutan || ''} onChange={e => setDailyForm({...dailyForm, urutan: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-bold text-center outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 transition-all"/>
                  </div>
               </div>
               <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Aktivitas / Jobdesk</label>
                  <textarea required rows="2" value={dailyForm.aktivitas || ''} onChange={e => setDailyForm({...dailyForm, aktivitas: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 transition-all resize-none" placeholder="Misal: Hitung modal laci..."></textarea>
               </div>
               <div className="flex gap-3 pt-2">
                 {dailyMode === 'edit' && <button type="button" onClick={() => handleDeleteSOP('daily_duty_sops', dailyForm.id)} className="p-3.5 bg-white border border-rose-200 text-rose-600 rounded-2xl hover:bg-rose-50 transition-colors focus:outline-none" aria-label="Hapus Daily Duty"><Trash2 size={20} strokeWidth={1.5}/></button>}
                 <button type="submit" disabled={isSavingDaily} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl font-bold shadow-md active:scale-[0.98] transition-all focus:outline-none flex items-center justify-center gap-2" aria-label="Simpan Daily Duty">{isSavingDaily ? <Loader2 size={18} className="animate-spin"/> : null}Simpan Daily Duty</button>
               </div>
            </form>
           </div>
        </div>
      )}

      {/* MODAL HOUSEKEEPING */}
         {isModalHkOpen && (
            <div
               className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"
               tabIndex={-1}
               aria-modal="true"
               role="dialog"
               onClick={e => { if (e.target === e.currentTarget) setIsModalHkOpen(false); }}
            >
                <div
                   ref={hkModalRef}
                   tabIndex={0}
                   className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 outline-none"
                >
                  <div className="px-6 py-5 border-b flex justify-between items-center bg-white">
                      <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2"><ClipboardCheck size={20} className="text-emerald-500"/> Form Housekeeping</h2>
                      <button onClick={() => setIsModalHkOpen(false)} className="text-slate-400 hover:bg-slate-100 rounded-full p-2 focus:outline-none" aria-label="Tutup modal"><X size={20} strokeWidth={1.5}/></button>
                  </div>
                  <form onSubmit={handleSaveHousekeeping} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto bg-slate-50/50">
               <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cabang</label>
                  <select required value={hkForm.outlet_id || ''} onChange={e => setHkForm({...hkForm, outlet_id: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all appearance-none">
                     <option value="" disabled>-- Pilih Cabang --</option>
                     {outletList.map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Area</label>
                     <select required value={hkForm.area || 'Area 1'} onChange={e => setHkForm({...hkForm, area: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all appearance-none">
                        <option value="Area 1">Area 1</option>
                        <option value="Area 2">Area 2</option>
                        <option value="Area 3">Area 3</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Phase Waktu</label>
                     <select required value={hkForm.phase || 'Opening'} onChange={e => setHkForm({...hkForm, phase: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all appearance-none">
                        <option value="Opening">PraOpening</option>
                        <option value="Closing">Closing</option>
                     </select>
                  </div>
               </div>
               <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3">
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Zona Spesifik</label>
                     <input required value={hkForm.zona || ''} onChange={e => setHkForm({...hkForm, zona: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" placeholder="Misal: Toilet / Area Potong"/>
                  </div>
                  <div>
                     <label className="text-xs font-semibold text-slate-600 mb-1.5 block">No. Urut</label>
                     <input type="number" required value={hkForm.no_urut || ''} onChange={e => setHkForm({...hkForm, no_urut: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-bold text-center outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all"/>
                  </div>
               </div>
               <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Rincian Kebersihan</label>
                  <textarea required rows="2" value={hkForm.rincian_jobdesk || ''} onChange={e => setHkForm({...hkForm, rincian_jobdesk: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all resize-none" placeholder="Misal: Sapu & pel lantai..."></textarea>
               </div>
               
               <label className="flex items-center gap-4 p-4 bg-white border border-rose-200/60 rounded-2xl cursor-pointer hover:bg-rose-50/50 transition-colors">
                 <input type="checkbox" checked={hkForm.wajib_foto || false} onChange={e => setHkForm({...hkForm, wajib_foto: e.target.checked})} className="w-5 h-5 accent-rose-500 rounded"/>
                 <div>
                    <p className="font-bold text-slate-800 text-[14px]">Wajib Upload Foto Bukti?</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Sistem akan menagih foto saat karyawan tutup shift.</p>
                 </div>
               </label>

               <div className="flex gap-3 pt-2">
                 {hkMode === 'edit' && <button type="button" onClick={() => handleDeleteSOP('housekeeping_sops', hkForm.id)} className="p-3.5 bg-white border border-rose-200 text-rose-600 rounded-2xl hover:bg-rose-50 transition-colors focus:outline-none" aria-label="Hapus Housekeeping"><Trash2 size={20} strokeWidth={1.5}/></button>}
                 <button type="submit" disabled={isSavingHk} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl font-bold shadow-md active:scale-[0.98] transition-all focus:outline-none flex items-center justify-center gap-2" aria-label="Simpan Housekeeping">{isSavingHk ? <Loader2 size={18} className="animate-spin"/> : null}Simpan Housekeeping</button>
               </div>
            </form>
           </div>
        </div>
      )}

    </div>
  );
}