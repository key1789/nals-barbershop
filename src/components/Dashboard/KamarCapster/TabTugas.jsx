import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Circle, Camera, Image as ImageIcon, 
  ChevronRight, X, ShieldCheck, AlertTriangle, 
  Check, Info, Loader2, Save, MapPin
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { compressImage } from './utils/imageCompressor';

// --- KAMUS LABEL FOTO ---
const PHOTO_LABELS = {
  'Capster': {
    'Pra Opening': ['Foto Full Badan (Cermin)', 'Foto Full Station Barber', 'Foto Tempat Alat'],
    'Closing': ['Foto Full Station Akhir', 'Foto Tempat Alat Akhir', null]
  },
  'FO': {
    'Pra Opening': ['Foto Full Badan (FO)', 'Foto Full Front Office', 'Foto Saldo Kas Kecil'],
    'Closing': ['Foto Full Front Office Akhir', 'Foto Saldo Kas Kecil Akhir', null]
  }
};

const DD_PHASES = ['Pra Opening', 'Opening', 'Standby (Zero Downtime Productivity)', 'Closing'];
const HK_PHASES = ['Pra Opening', 'Closing'];

export default function TabTugas({ user }) {
  const [activeMainTab, setActiveMainTab] = useState('daily_duty'); 
  const [activePhase, setActivePhase] = useState('Pra Opening');
  const [isLoading, setIsLoading] = useState(true);

  const [dailySops, setDailySops] = useState([]);
  const [hkSops, setHkSops] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [hkLogs, setHkLogs] = useState([]);

  // STATE DAILY DUTY
  const [isAgreed, setIsAgreed] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyPhotos, setDailyPhotos] = useState({ 1: null, 2: null, 3: null });
  const [dailyPreviews, setDailyPreviews] = useState({ 1: null, 2: null, 3: null });
  const [isSubmittingDaily, setIsSubmittingDaily] = useState(false);

  // STATE HOUSEKEEPING
  const [showHkModal, setShowHkModal] = useState(false);
  const [selectedHkTask, setSelectedHkTask] = useState(null);
  const [hkAction, setHkAction] = useState('Selesai');
  const [hkNote, setHkNote] = useState('');
  const [hkPhoto, setHkPhoto] = useState(null);
  const [hkPreview, setHkPreview] = useState(null);
  const [isSubmittingHk, setIsSubmittingHk] = useState(false);

  const currentPhases = activeMainTab === 'daily_duty' ? DD_PHASES : HK_PHASES;

  const handleMainTabChange = (tab) => {
    setActiveMainTab(tab);
    if (tab === 'housekeeping' && !HK_PHASES.includes(activePhase)) {
      setActivePhase('Pra Opening');
    }
    setIsAgreed(false);
  };

  const fetchAllTasks = async () => {
    setIsLoading(true);
    try {
      const todayDate = new Date().toLocaleDateString('en-CA'); 

      const { data: dSops } = await supabase.from('daily_duty_sops').select('*').eq('role', user.role).order('urutan');
      const { data: hSops } = await supabase.from('housekeeping_sops').select('*').ilike('area', user.hk_area_pic || 'TIDAK_ADA').order('no_urut');
      
      const { data: dLogs } = await supabase.from('daily_duty_logs').select('*').eq('user_id', user.id).eq('tanggal', todayDate);
      const { data: hLogs } = await supabase.from('housekeeping_logs').select('*').eq('user_id', user.id).eq('tanggal', todayDate);

      if (dSops) setDailySops(dSops);
      if (hSops) setHkSops(hSops);
      if (dLogs) setDailyLogs(dLogs);
      if (hLogs) setHkLogs(hLogs);
    } catch (err) {
      console.error("Gagal tarik data tugas:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, [user.id, user.role, user.hk_area_pic]);


  // ==========================================
  // DAILY DUTY LOGIC
  // ==========================================
  const filteredDailySops = dailySops.filter(s => s.phase === activePhase);
  const isDailyPhaseLocked = dailyLogs.some(log => log.phase === activePhase);
  const isViewOnlyPhase = activePhase === 'Opening' || activePhase === 'Standby (Zero Downtime Productivity)';
  
  const groupedDailySops = filteredDailySops.reduce((acc, sop) => {
    const cat = sop.fase_kategori || 'Tugas Umum';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(sop);
    return acc;
  }, {});

  const currentPhotoLabels = PHOTO_LABELS[user.role]?.[activePhase] || ['Foto Bukti 1', 'Foto Bukti 2', 'Foto Bukti 3'];
  
  // Wajib Semua Foto Terisi
  const requiredSlots = [1, 2, 3].filter(slot => currentPhotoLabels[slot - 1] !== null);
  const isAllPhotosFilled = requiredSlots.every(slot => dailyPhotos[slot] !== null);

  const handleDailyPhotoChange = async (e, slot) => {
    const file = e.target.files[0];
    if (!file) return;
    setDailyPreviews(prev => ({ ...prev, [slot]: URL.createObjectURL(file) }));
    const compressed = await compressImage(file);
    setDailyPhotos(prev => ({ ...prev, [slot]: compressed }));
  };

  const submitDailyDuty = async () => {
    if (!isAllPhotosFilled) return alert("Semua foto bukti wajib diisi penuh Bos!");

    setIsSubmittingDaily(true);
    try {
      const todayDate = new Date().toLocaleDateString('en-CA');
      let uploadedPaths = { 1: null, 2: null, 3: null };

      const uploadPromises = [1, 2, 3].map(async (slot) => {
        const file = dailyPhotos[slot];
        if (file) {
          const fileName = `${user.id}-daily-${activePhase}-${slot}-${Date.now()}.jpg`;
          const { data } = await supabase.storage.from('duty_photos').upload(fileName, file);
          if (data) uploadedPaths[slot] = data.path;
        }
      });
      await Promise.all(uploadPromises);

      const payload = {
        user_id: user.id,
        tanggal: todayDate,
        phase: activePhase,
        foto_bukti_1: uploadedPaths[1],
        foto_bukti_2: uploadedPaths[2],
        foto_bukti_3: uploadedPaths[3],
      };

      await supabase.from('daily_duty_logs').insert([payload]);

      alert(`✅ Laporan Fase ${activePhase} Berhasil Disubmit!`);
      setShowDailyModal(false);
      setIsAgreed(false);
      setDailyPhotos({ 1: null, 2: null, 3: null });
      setDailyPreviews({ 1: null, 2: null, 3: null });
      fetchAllTasks();

    } catch (err) {
      alert("Gagal submit. Cek internet ruko!");
    } finally {
      setIsSubmittingDaily(false);
    }
  };

  // ==========================================
  // HOUSEKEEPING LOGIC
  // ==========================================
  const filteredHkSops = hkSops.filter(s => s.phase === activePhase);
  const hkProgress = filteredHkSops.length === 0 ? 0 : Math.round((filteredHkSops.filter(s => hkLogs.some(l => l.sop_id === s.id)).length / filteredHkSops.length) * 100);

  // Grouping Housekeeping by Zona
  const groupedHkSops = filteredHkSops.reduce((acc, sop) => {
    const zona = sop.zona || 'Area Umum';
    if (!acc[zona]) acc[zona] = [];
    acc[zona].push(sop);
    return acc;
  }, {});

  const openHkModal = (task) => {
    if (hkLogs.some(l => l.sop_id === task.id)) return;
    setSelectedHkTask(task);
    setHkAction('Selesai');
    setHkNote('');
    setHkPhoto(null);
    setHkPreview(null);
    setShowHkModal(true);
  };

  const handleHkPhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setHkPreview(URL.createObjectURL(file));
    const compressed = await compressImage(file);
    setHkPhoto(compressed);
  };

  const submitHousekeeping = async () => {
    if (hkAction === 'Kendala' && !hkNote) return alert("Wajib isi alasan kendalanya Bos!");
    if (hkAction === 'Selesai' && selectedHkTask.wajib_foto && !hkPhoto) return alert("Tugas ini wajib foto bukti penyelesaian!");
    if (hkAction === 'Kendala' && !hkPhoto) return alert("Wajib sertakan foto bukti kendala!");

    setIsSubmittingHk(true);
    try {
      const todayDate = new Date().toLocaleDateString('en-CA');
      let photoPath = null;

      if (hkPhoto) {
        const fileName = `${user.id}-hk-${selectedHkTask.id}-${Date.now()}.jpg`;
        const { data } = await supabase.storage.from('duty_photos').upload(fileName, hkPhoto);
        if (data) photoPath = data.path;
      }

      const payload = {
        user_id: user.id,
        sop_id: selectedHkTask.id,
        tanggal: todayDate,
        status: hkAction,
        catatan_kendala: hkAction === 'Kendala' ? hkNote : null,
        foto_bukti: photoPath
      };

      await supabase.from('housekeeping_logs').insert([payload]);

      setShowHkModal(false);
      fetchAllTasks();

    } catch (err) {
      alert("Gagal simpan tugas. Cek internet!");
    } finally {
      setIsSubmittingHk(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>;
  }

  return (
    <div className="p-6 pb-28 min-h-screen bg-slate-950 text-slate-100 animate-in fade-in duration-300 relative">
      
      <div className="mb-6">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Standar Operasional</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sistem Pemantauan Kinerja</p>
      </div>

      <div className="flex bg-slate-900 p-1.5 rounded-2xl mb-6 border border-slate-800 shadow-sm">
        <button onClick={() => handleMainTabChange('daily_duty')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeMainTab === 'daily_duty' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
          <ShieldCheck size={14} className="inline mr-1 mb-0.5"/> Daily Duty
        </button>
        <button onClick={() => handleMainTabChange('housekeeping')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeMainTab === 'housekeeping' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
          <MapPin size={14} className="inline mr-1 mb-0.5"/> Housekeeping
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
        {currentPhases.map(phase => (
          <button 
            key={phase}
            onClick={() => { setActivePhase(phase); setIsAgreed(false); }}
            className={`px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
              activePhase === phase 
              ? 'bg-slate-800 border-indigo-500 text-indigo-400' 
              : 'bg-slate-950 border-slate-800 text-slate-600'
            }`}
          >
            {phase}
          </button>
        ))}
      </div>


      {/* ========================================================= */}
      {/* TAB 1: DAILY DUTY */}
      {/* ========================================================= */}
      {activeMainTab === 'daily_duty' && (
        <div className="space-y-6 animate-in slide-in-from-left-4 pb-10">
          <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-2xl flex items-center gap-3">
            <Info size={24} className="text-indigo-400 flex-shrink-0"/>
            <p className="text-[10px] text-indigo-200 font-medium leading-relaxed">
              {isViewOnlyPhase ? 'SOP di bawah ini bersifat operasional berjalan (View Only).' : 'Baca dan pastikan semua SOP telah dikerjakan sebelum Anda mensubmit foto bukti.'}
            </p>
          </div>

          {filteredDailySops.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Tidak ada SOP di fase ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedDailySops).map(kategori => (
                <div key={kategori} className="space-y-3">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-900 pb-2">{kategori}</h3>
                  {groupedDailySops[kategori].map((sop) => (
                    <div key={sop.id} className="flex gap-3 bg-slate-900/50 border border-slate-800/50 p-4 rounded-2xl">
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center text-[10px] font-black flex-shrink-0">{sop.urutan}</div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 leading-tight">{sop.aktivitas}</h4>
                        {sop.catatan && <p className="text-[10px] text-slate-500 mt-1">{sop.catatan}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ACTION SUBMIT (SEMBUNYIKAN UNTUK VIEW ONLY PHASE) */}
          {filteredDailySops.length > 0 && !isViewOnlyPhase && (
            <div className="pt-6 mt-6 border-t border-slate-800 space-y-4">
              {isDailyPhaseLocked ? (
                <div className="w-full py-4 bg-emerald-900/30 border border-emerald-500/50 rounded-2xl text-emerald-500 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-inner">
                  <CheckCircle2 size={16}/> Laporan {activePhase} Selesai
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-indigo-500" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} />
                    <span className="text-[10px] text-slate-300 font-medium leading-relaxed">
                      Dengan mencentang ini, saya menyatakan bahwa <b>seluruh SOP di atas telah saya lakukan</b> dengan standar ruko.
                    </span>
                  </label>
                  <button 
                    onClick={() => setShowDailyModal(true)}
                    disabled={!isAgreed}
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${isAgreed ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg active:scale-95' : 'bg-slate-800 text-slate-600'}`}
                  >
                    <Camera size={16}/> Input Bukti Foto
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}


      {/* ========================================================= */}
      {/* TAB 2: HOUSEKEEPING */}
      {/* ========================================================= */}
      {activeMainTab === 'housekeeping' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 pb-10">
          <div className="flex justify-between items-end bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-sm">
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Area Tanggung Jawab:</span>
              <span className="text-xl font-black text-indigo-400 uppercase">{user.hk_area_pic || 'Belum Di-Set'}</span>
            </div>
            <div className="text-right"><span className="text-2xl font-black text-white">{hkProgress}%</span></div>
          </div>
          
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${hkProgress}%` }}></div>
          </div>

          {filteredHkSops.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Tidak ada Tugas Area di fase ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedHkSops).map(zona => (
                <div key={zona} className="space-y-3">
                  <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest border-b border-orange-900 pb-2">{zona}</h3>
                  {groupedHkSops[zona].map(task => {
                    const log = hkLogs.find(l => l.sop_id === task.id);
                    const isDone = log?.status === 'Selesai';
                    const isKendala = log?.status === 'Kendala';
                    
                    let boxClass = 'bg-slate-900 border-slate-800 hover:border-indigo-500/50 cursor-pointer active:scale-95';
                    let icon = <Circle size={22} className="text-slate-600" />;
                    
                    if (isDone) { boxClass = 'bg-emerald-900/20 border-emerald-500/30 opacity-70 cursor-default'; icon = <CheckCircle2 size={22} className="text-emerald-500" />; } 
                    else if (isKendala) { boxClass = 'bg-rose-900/20 border-rose-500/30 opacity-70 cursor-default'; icon = <AlertTriangle size={22} className="text-rose-500" />; }

                    return (
                      <div key={task.id} onClick={() => openHkModal(task)} className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${boxClass}`}>
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-shrink-0">{icon}</div>
                          <div className="flex-1">
                            <p className={`text-xs font-bold leading-tight ${log ? 'text-slate-400' : 'text-slate-200'}`}>{task.rincian_jobdesk}</p>
                          </div>
                        </div>
                        {task.wajib_foto && !log && <div className="ml-3 w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400"><Camera size={14} /></div>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: SUBMIT DAILY DUTY */}
      {/* ========================================================= */}
      {showDailyModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col p-4 animate-in fade-in pb-24">
          <div className="flex-1 overflow-y-auto no-scrollbar pt-6 space-y-6 text-center">
            <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2"><ShieldCheck size={32}/></div>
            <h3 className="text-xl font-black uppercase italic">Validasi Laporan</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Sertakan foto bukti untuk {activePhase}</p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              {[1, 2, 3].map(slot => {
                const label = currentPhotoLabels[slot - 1];
                if (!label) return null; 

                return (
                  <label key={slot} className={`aspect-[3/4] bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center overflow-hidden relative cursor-pointer hover:border-indigo-500 transition-colors ${slot === 3 ? 'col-span-2 aspect-video' : ''}`}>
                    {dailyPreviews[slot] ? (
                      <img src={dailyPreviews[slot]} className="w-full h-full object-cover" alt={`Bukti ${slot}`} />
                    ) : (
                      <div className="p-4 flex flex-col items-center text-center">
                        <ImageIcon size={24} className="text-slate-600 mb-2"/>
                        <span className="text-[9px] font-black text-slate-400 uppercase leading-snug">{label}</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleDailyPhotoChange(e, slot)}/>
                  </label>
                )
              })}
            </div>
            <p className={`text-[9px] italic mt-4 ${isAllPhotosFilled ? 'text-emerald-500 font-bold' : 'text-slate-500'}`}>
              * Wajib upload SELURUH foto bukti untuk mengaktifkan tombol Submit.
            </p>
          </div>
          
          <div className="pt-4 grid grid-cols-2 gap-3 border-t border-slate-800">
             <button onClick={() => setShowDailyModal(false)} className="py-4 font-black text-xs text-slate-400 uppercase bg-slate-900 rounded-2xl active:scale-95">Batal</button>
             <button onClick={submitDailyDuty} disabled={isSubmittingDaily || !isAllPhotosFilled} className="py-4 bg-indigo-600 rounded-2xl font-black text-xs uppercase flex justify-center items-center gap-2 active:scale-95 shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none">
               {isSubmittingDaily ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} SUBMIT
             </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: SUBMIT HOUSEKEEPING */}
      {/* ========================================================= */}
      {showHkModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex items-end p-4 animate-in fade-in pb-24">
          <div className="bg-slate-900 w-full max-h-[85vh] overflow-y-auto no-scrollbar rounded-[2.5rem] border border-slate-800 p-6 shadow-2xl space-y-6">
            
            <div className="text-center pb-4 border-b border-slate-800">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">{selectedHkTask?.zona}</h4>
              <p className="text-sm font-bold text-white leading-snug">{selectedHkTask?.rincian_jobdesk}</p>
            </div>

            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button onClick={() => setHkAction('Selesai')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${hkAction === 'Selesai' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}><CheckCircle2 size={14} className="inline mr-1 mb-0.5"/> Selesai</button>
              <button onClick={() => setHkAction('Kendala')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${hkAction === 'Kendala' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}><AlertTriangle size={14} className="inline mr-1 mb-0.5"/> Kendala</button>
            </div>

            {hkAction === 'Kendala' && (
              <div className="space-y-2 animate-in slide-in-from-bottom-4">
                <label className="text-[9px] font-black text-rose-400 uppercase ml-1">Deskripsi Kendala (Wajib)</label>
                <textarea placeholder="Tulis alasan kendala..." className="w-full h-24 bg-slate-950 border border-rose-900/50 p-4 rounded-2xl text-xs font-bold text-white focus:border-rose-500 outline-none" value={hkNote} onChange={e => setHkNote(e.target.value)}></textarea>
              </div>
            )}

            <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-1">
                 Foto Bukti {hkAction === 'Kendala' || selectedHkTask?.wajib_foto ? <span className="text-rose-500">(Wajib)</span> : <span className="text-slate-600">(Opsional)</span>}
               </label>
               <label className="w-full h-40 bg-slate-950 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center overflow-hidden relative cursor-pointer hover:border-indigo-500 transition-colors">
                  {hkPreview ? (
                    <img src={hkPreview} className="w-full h-full object-cover" alt="Bukti HK" />
                  ) : (
                    <>
                      <Camera size={30} className="text-slate-700 mb-2"/>
                      <span className="text-[10px] font-black text-slate-500 uppercase">Tap Untuk Kamera</span>
                    </>
                  )}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleHkPhotoChange}/>
               </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowHkModal(false)} className="flex-1 py-4 font-black text-[10px] uppercase text-slate-400 bg-slate-800 rounded-2xl active:scale-95">Batal</button>
              <button onClick={submitHousekeeping} disabled={isSubmittingHk} className={`flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase flex justify-center items-center gap-2 active:scale-95 shadow-lg ${hkAction === 'Selesai' ? 'bg-emerald-600 text-white shadow-emerald-900/20' : 'bg-rose-600 text-white shadow-rose-900/20'}`}>
                {isSubmittingHk ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} SIMPAN TUGAS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}