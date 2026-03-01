import React, { useState, useEffect } from 'react';
import { Clock, Plus, ClipboardList, ClipboardCheck, Users, Layers, Map, Trash2, X } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

export default function TabOperasional({ user }) {
  const [isLoading, setIsLoading] = useState(false);
  const [outletList, setOutletList] = useState([]);
  
  // Lists
  const [shiftList, setShiftList] = useState([]);
  const [dailyDutyList, setDailyDutyList] = useState([]);
  const [housekeepingList, setHousekeepingList] = useState([]);

  // Modals & Forms
  const [isModalShiftOpen, setIsModalShiftOpen] = useState(false);
  const [shiftMode, setShiftMode] = useState('add');
  const [shiftForm, setShiftForm] = useState({ 
    id: null, outlet_id: '', nama_shift: 'Pagi', jam_mulai: '09:00', jam_selesai: '15:00', is_active: true 
  });

  const [isModalDailyOpen, setIsModalDailyOpen] = useState(false);
  const [dailyMode, setDailyMode] = useState('add');
  const [dailyForm, setDailyForm] = useState({ 
    id: null, outlet_id: '', role: 'FO', phase: 'Opening', fase_kategori: '', urutan: '', aktivitas: '', tipe: 'Checklist', catatan: '', is_active: true 
  });

  const [isModalHkOpen, setIsModalHkOpen] = useState(false);
  const [hkMode, setHkMode] = useState('add');
  const [hkForm, setHkForm] = useState({ 
    id: null, outlet_id: '', area: '', zona: '', phase: '', no_urut: '', rincian_jobdesk: '', wajib_foto: true, is_active: true 
  });

  // ==========================================
  // FUNGSI TARIK DATA
  // ==========================================
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

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleSaveShift = async (e) => {
    e.preventDefault(); 
    if (!shiftForm.outlet_id) return alert("Pilih cabang dulu!");
    try {
      const payload = { ...shiftForm }; 
      if (shiftMode === 'add') { 
        delete payload.id; await supabase.from('shifts').insert([payload]); 
      } else { 
        await supabase.from('shifts').update(payload).eq('id', shiftForm.id); 
      }
      setIsModalShiftOpen(false); fetchData();
    } catch (error) { alert("Gagal simpan shift: " + error.message); }
  };

  const handleSaveDailyDuty = async (e) => {
    e.preventDefault(); 
    if (!dailyForm.outlet_id) return alert("Pilih cabang dulu!");
    try {
      const payload = { ...dailyForm }; 
      if (dailyMode === 'add') { 
        delete payload.id; await supabase.from('daily_duty_sops').insert([payload]); 
      } else { 
        await supabase.from('daily_duty_sops').update(payload).eq('id', dailyForm.id); 
      }
      setIsModalDailyOpen(false); fetchData();
    } catch (error) { alert("Gagal simpan Daily Duty: " + error.message); }
  };

  const handleSaveHousekeeping = async (e) => {
    e.preventDefault(); 
    if (!hkForm.outlet_id) return alert("Pilih cabang dulu!");
    try {
      const payload = { ...hkForm }; 
      if (hkMode === 'add') { 
        delete payload.id; await supabase.from('housekeeping_sops').insert([payload]); 
      } else { 
        await supabase.from('housekeeping_sops').update(payload).eq('id', hkForm.id); 
      }
      setIsModalHkOpen(false); fetchData();
    } catch (error) { alert("Gagal simpan Housekeeping: " + error.message); }
  };

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

  // ==========================================
  // GROUPING LOGIC
  // ==========================================
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
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* ZONA 1: MASTER SHIFT */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
           <div>
              <h2 className="font-black text-slate-800 text-lg flex items-center gap-2"><Clock className="text-indigo-500"/> Master Jam Kerja (Shift)</h2>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Pengaturan absen masuk & keluar</p>
           </div>
           <button 
              onClick={() => { 
                setShiftMode('add'); 
                setShiftForm({ id: null, outlet_id: '', nama_shift: 'Pagi', jam_mulai: '09:00', jam_selesai: '15:00', is_active: true }); 
                setIsModalShiftOpen(true); 
              }} 
              className="bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-200 transition-all active:scale-95"
           >
              <Plus size={16}/> Tambah Shift
           </button>
         </div>

         {isLoading ? (
            <div className="text-center p-4 text-slate-400 font-bold text-sm">Memuat shift...</div>
         ) : shiftList.length === 0 ? (
           <div className="text-center p-6 border border-dashed rounded-xl text-slate-400 font-bold text-sm">Belum ada data Shift.</div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             {shiftList.map(s => (
               <div 
                  key={s.id} 
                  onClick={() => { setShiftMode('edit'); setShiftForm(s); setIsModalShiftOpen(true); }} 
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all"
               >
                 <div>
                   <h4 className="font-black text-slate-800">{s.nama_shift}</h4>
                   <p className="text-xs font-bold text-slate-500">{s.jam_mulai} - {s.jam_selesai}</p>
                   <p className="text-[9px] font-black uppercase text-indigo-400 mt-1">{outletList.find(o => o.id === s.outlet_id)?.nama_outlet || 'Semua Cabang'}</p>
                 </div>
               </div>
             ))}
           </div>
         )}
      </div>

      {/* ZONA BAWAH: DAILY DUTY & HOUSEKEEPING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* ZONA 2: DAILY DUTY SOP */}
        <div className="bg-sky-50 rounded-3xl p-6 border border-sky-200 shadow-sm flex flex-col max-h-[800px]">
          <div className="flex justify-between items-center mb-4 border-b border-sky-200/50 pb-4 shrink-0">
            <div>
               <h2 className="font-black text-sky-800 text-lg flex items-center gap-2"><ClipboardList className="text-sky-500"/> Daily Duty (Role)</h2>
               <p className="text-[10px] font-bold text-sky-700/70 mt-1 uppercase tracking-widest">Tugas melekat pada Jabatan</p>
            </div>
            <button 
               onClick={() => { 
                 setDailyMode('add'); 
                 setDailyForm({ id: null, outlet_id: '', role: 'FO', phase: 'Opening', fase_kategori: 'Persiapan', urutan: 1, aktivitas: '', tipe: 'Checklist', catatan: '', is_active: true }); 
                 setIsModalDailyOpen(true); 
               }} 
               className="p-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 shadow-md active:scale-95 transition-all"
            >
               <Plus size={18}/>
            </button>
          </div>
          
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 no-scrollbar pb-4">
            {isLoading ? (
               <div className="text-center p-4 text-sky-600/50 font-bold text-sm">Memuat tugas...</div>
            ) : Object.keys(groupedDailyDuty).length === 0 ? (
               <p className="text-center text-sm font-bold text-sky-500 py-4 border-2 border-dashed border-sky-200 rounded-xl">Belum ada tugas.</p>
            ) : (
               Object.keys(groupedDailyDuty).map(role => (
                  <div key={role} className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
                     <div className="bg-sky-100 px-4 py-2 font-black text-sky-900 flex items-center gap-2"><Users size={16}/> ROLE: {role}</div>
                     
                     <div className="p-3 space-y-3">
                        {Object.keys(groupedDailyDuty[role]).map(phase => (
                           <div key={phase} className="pl-3 border-l-2 border-sky-200">
                              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Layers size={12}/> PHASE: {phase}</div>
                              
                              <div className="space-y-2">
                                 {Object.keys(groupedDailyDuty[role][phase]).map(kategori => (
                                    <div key={kategori} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                       <div className="text-[10px] font-bold text-indigo-500 uppercase mb-2 bg-indigo-50 inline-block px-2 py-0.5 rounded">[{kategori}]</div>
                                       <div className="space-y-1.5">
                                          {groupedDailyDuty[role][phase][kategori].map(duty => (
                                             <div 
                                                key={duty.id} 
                                                onClick={() => { setDailyMode('edit'); setDailyForm(duty); setIsModalDailyOpen(true); }} 
                                                className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-sky-400 hover:shadow-sm transition-all group"
                                             >
                                                <p className="text-sm font-bold text-slate-800 flex-1">{duty.urutan}. {duty.aktivitas}</p>
                                                {duty.tipe !== 'Checklist' && <span className="text-[9px] font-black uppercase text-amber-500 ml-2">{duty.tipe}</span>}
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
        <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-200 shadow-sm flex flex-col max-h-[800px]">
          <div className="flex justify-between items-center mb-4 border-b border-emerald-200/50 pb-4 shrink-0">
            <div>
               <h2 className="font-black text-emerald-800 text-lg flex items-center gap-2"><ClipboardCheck className="text-emerald-500"/> Housekeeping (Area)</h2>
               <p className="text-[10px] font-bold text-emerald-700/70 mt-1 uppercase tracking-widest">Tugas kebersihan Zona Ruko</p>
            </div>
            <button 
               onClick={() => { 
                 setHkMode('add'); 
                 setHkForm({ id: null, outlet_id: '', area: 'Indoor', zona: 'Area Potong', phase: 'Closing', no_urut: 1, rincian_jobdesk: '', wajib_foto: true, is_active: true }); 
                 setIsModalHkOpen(true); 
               }} 
               className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md active:scale-95 transition-all"
            >
               <Plus size={18}/>
            </button>
          </div>
          
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 no-scrollbar pb-4">
            {isLoading ? (
               <div className="text-center p-4 text-emerald-600/50 font-bold text-sm">Memuat jobdesk...</div>
            ) : Object.keys(groupedHousekeeping).length === 0 ? (
               <p className="text-center text-sm font-bold text-emerald-500 py-4 border-2 border-dashed border-emerald-200 rounded-xl">Belum ada jobdesk.</p>
            ) : (
               Object.keys(groupedHousekeeping).map(area => (
                  <div key={area} className="bg-white border border-emerald-100 rounded-2xl overflow-hidden shadow-sm">
                     <div className="bg-emerald-100 px-4 py-2 font-black text-emerald-900 flex items-center gap-2"><Map size={16}/> AREA: {area}</div>
                     
                     <div className="p-3 space-y-3">
                        {Object.keys(groupedHousekeeping[area]).map(phase => (
                           <div key={phase} className="pl-3 border-l-2 border-emerald-200">
                              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Layers size={12}/> PHASE: {phase}</div>
                              
                              <div className="space-y-2">
                                 {Object.keys(groupedHousekeeping[area][phase]).map(zona => (
                                    <div key={zona} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                       <div className="text-[10px] font-bold text-amber-600 uppercase mb-2 bg-amber-50 inline-block px-2 py-0.5 rounded">ZONA: {zona}</div>
                                       <div className="space-y-1.5">
                                          {groupedHousekeeping[area][phase][zona].map(hk => (
                                             <div 
                                                key={hk.id} 
                                                onClick={() => { setHkMode('edit'); setHkForm(hk); setIsModalHkOpen(true); }} 
                                                className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-400 hover:shadow-sm transition-all group"
                                             >
                                                <div className="flex-1">
                                                   <p className="text-sm font-bold text-slate-800">{hk.no_urut}. {hk.rincian_jobdesk}</p>
                                                   {hk.wajib_foto && <p className="text-[9px] font-black text-rose-500 uppercase mt-0.5">📸 Wajib Upload Foto</p>}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b flex justify-between items-center bg-indigo-50 border-indigo-100">
               <h2 className="font-black text-indigo-900">Master Shift</h2>
               <button onClick={() => setIsModalShiftOpen(false)} className="text-indigo-500 hover:bg-white rounded-full p-1"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveShift} className="p-5 space-y-4">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Berlaku di Cabang</label>
                  <select required value={shiftForm.outlet_id || ''} onChange={e => setShiftForm({...shiftForm, outlet_id: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500">
                     <option value="" disabled>-- Pilih Cabang --</option>
                     {outletList.map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nama Shift</label>
                  <input required value={shiftForm.nama_shift} onChange={e => setShiftForm({...shiftForm, nama_shift: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500" placeholder="Pagi / Malam"/>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase">Jam Mulai</label>
                     <input type="time" required value={shiftForm.jam_mulai} onChange={e => setShiftForm({...shiftForm, jam_mulai: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500"/>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase">Jam Selesai</label>
                     <input type="time" required value={shiftForm.jam_selesai} onChange={e => setShiftForm({...shiftForm, jam_selesai: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500"/>
                  </div>
               </div>
               <div className="flex gap-2 mt-4">
                 {shiftMode === 'edit' && <button type="button" onClick={() => handleDeleteSOP('shifts', shiftForm.id)} className="p-3 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-200 transition-colors"><Trash2 size={20}/></button>}
                 <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black shadow-lg shadow-indigo-200 active:scale-95 transition-all">Simpan Shift</button>
               </div>
            </form>
           </div>
        </div>
      )}

      {/* MODAL DAILY DUTY */}
      {isModalDailyOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b flex justify-between items-center bg-sky-50 border-sky-100">
               <h2 className="font-black text-sky-900">Form Daily Duty</h2>
               <button onClick={() => setIsModalDailyOpen(false)} className="text-sky-500 hover:bg-white rounded-full p-1"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveDailyDuty} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Cabang</label>
                     <select required value={dailyForm.outlet_id || ''} onChange={e => setDailyForm({...dailyForm, outlet_id: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-500">
                        <option value="" disabled>-- Pilih Cabang --</option>
                        {outletList.map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase">Target Role</label>
                     <select required value={dailyForm.role} onChange={e => setDailyForm({...dailyForm, role: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-500">
                        <option value="FO">Front Office</option>
                        <option value="Capster">Capster</option>
                        <option value="Manager">Manager</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase">Phase (Fase Waktu)</label>
                     <select required value={dailyForm.phase} onChange={e => setDailyForm({...dailyForm, phase: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-500">
                        <option value="PraOpening">PraOpening</option>
                        <option value="Opening">Opening</option>
                        <option value="Closing">Closing</option>
                        <option value="Standby">Standby / Selama Shift</option>
                     </select>
                  </div>
               </div>
               <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Fase Kategori</label>
                     <input required value={dailyForm.fase_kategori} onChange={e => setDailyForm({...dailyForm, fase_kategori: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-sky-500" placeholder="Misal: Persiapan Alat"/>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase">Urutan</label>
                     <input type="number" required value={dailyForm.urutan} onChange={e => setDailyForm({...dailyForm, urutan: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-center outline-none focus:border-sky-500"/>
                  </div>
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Aktivitas / Jobdesk</label>
                  <textarea required rows="2" value={dailyForm.aktivitas} onChange={e => setDailyForm({...dailyForm, aktivitas: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-sky-500" placeholder="Misal: Hitung modal laci..."></textarea>
               </div>
               <div className="flex gap-2 mt-4">
                 {dailyMode === 'edit' && <button type="button" onClick={() => handleDeleteSOP('daily_duty_sops', dailyForm.id)} className="p-3 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-200 transition-colors"><Trash2 size={20}/></button>}
                 <button type="submit" className="flex-1 bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl font-black shadow-lg shadow-sky-200 active:scale-95 transition-all">Simpan Daily Duty</button>
               </div>
            </form>
           </div>
        </div>
      )}

      {/* MODAL HOUSEKEEPING */}
      {isModalHkOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b flex justify-between items-center bg-emerald-50 border-emerald-100">
               <h2 className="font-black text-emerald-900">Form Housekeeping</h2>
               <button onClick={() => setIsModalHkOpen(false)} className="text-emerald-500 hover:bg-white rounded-full p-1"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveHousekeeping} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Cabang</label>
                  <select required value={hkForm.outlet_id || ''} onChange={e => setHkForm({...hkForm, outlet_id: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500">
                     <option value="" disabled>-- Pilih Cabang --</option>
                     {outletList.map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase">Area</label>
                     <select required value={hkForm.area} onChange={e => setHkForm({...hkForm, area: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500">
                        <option value="Area 1">Area 1</option>
                        <option value="Area 2">Area 2</option>
                        <option value="Area 3">Area 3</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase">Phase (Waktu)</label>
                     <select required value={hkForm.phase} onChange={e => setHkForm({...hkForm, phase: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500">
                        <option value="Opening">PraOpening</option>
                        <option value="Closing">Closing</option>
                     </select>
                  </div>
               </div>
               <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase">Zona Spesifik</label>
                     <input required value={hkForm.zona} onChange={e => setHkForm({...hkForm, zona: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500" placeholder="Misal: Toilet / Area Potong"/>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase">No. Urut</label>
                     <input type="number" required value={hkForm.no_urut} onChange={e => setHkForm({...hkForm, no_urut: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-center outline-none focus:border-emerald-500"/>
                  </div>
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Rincian Kebersihan / Jobdesk</label>
                  <textarea required rows="2" value={hkForm.rincian_jobdesk} onChange={e => setHkForm({...hkForm, rincian_jobdesk: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500" placeholder="Misal: Sapu & pel lantai..."></textarea>
               </div>
               
               <label className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl cursor-pointer">
                 <input type="checkbox" checked={hkForm.wajib_foto} onChange={e => setHkForm({...hkForm, wajib_foto: e.target.checked})} className="w-5 h-5 accent-rose-600"/>
                 <div>
                    <p className="font-bold text-rose-800 text-sm">Wajib Upload Foto Bukti?</p>
                    <p className="text-[10px] text-rose-600">Sistem akan menagih foto saat karyawan tutup shift.</p>
                 </div>
               </label>

               <div className="flex gap-2 mt-4">
                 {hkMode === 'edit' && <button type="button" onClick={() => handleDeleteSOP('housekeeping_sops', hkForm.id)} className="p-3 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-200 transition-colors"><Trash2 size={20}/></button>}
                 <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black shadow-lg shadow-emerald-200 active:scale-95 transition-all">Simpan Housekeeping</button>
               </div>
            </form>
           </div>
        </div>
      )}

    </div>
  );
}