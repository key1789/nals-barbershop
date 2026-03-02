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
      alert("Gagal submit. Cek koneksi internet!");
    } finally {
      setIsSubmittingDaily(false);
    }
  };

  // ==========================================
  // HOUSEKEEPING LOGIC
  // ==========================================
  const filteredHkSops = hkSops.filter(s => s.phase === activePhase);
  const hkProgress = filteredHkSops.length === 0 ? 0 : Math.round((filteredHkSops.filter(s => hkLogs.some(l => l.sop_id === s.id)).length / filteredHkSops.length) * 100);

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
    return <div className="min-h-screen bg-gray-50 flex justify-center items-center"><Loader2 className="animate-spin text-gray-900" size={40}/></div>;
  }

  return (
    <div className="p-6 pb-28 min-h-screen bg-gray-50 text-gray-900 animate-in fade-in duration-300 relative font-sans">
      
      <div className="mb-6">
        <h2 className="text-3xl font-black tracking-tight uppercase text-gray-900">SOP</h2>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Pemantauan Kinerja Harian</p>
      </div>

      <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6 border border-gray-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
        <button onClick={() => handleMainTabChange('daily_duty')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeMainTab === 'daily_duty' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <ShieldCheck size={14} className="inline mr-1 mb-0.5"/> Daily Duty
        </button>
        <button onClick={() => handleMainTabChange('housekeeping')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeMainTab === 'housekeeping' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <MapPin size={14} className="inline mr-1 mb-0.5"/> Housekeeping
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 pb-2">
        {currentPhases.map(phase => (
          <button 
            key={phase}
            onClick={() => { setActivePhase(phase); setIsAgreed(false); }}
            className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm ${
              activePhase === phase 
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
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
          <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
            <Info size={24} className="text-blue-500 flex-shrink-0 mt-0.5"/>
            <p className="text-[11px] text-blue-900 font-medium leading-relaxed">
              {isViewOnlyPhase ? 'SOP di bawah ini bersifat operasional berjalan (View Only).' : 'Baca dan pastikan semua SOP telah dikerjakan sebelum Anda menyetor foto bukti di bawah.'}
            </p>
          </div>

          {filteredDailySops.length === 0 ? (
            <div className="p-10 text-center bg-white border border-gray-200 rounded-[2rem] shadow-sm">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Tidak ada SOP di fase ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedDailySops).map(kategori => (
                <div key={kategori} className="space-y-4 bg-white border border-gray-100 p-6 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                  <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-gray-100 pb-3">{kategori}</h3>
                  <div className="space-y-3 pt-2">
                    {groupedDailySops[kategori].map((sop) => (
                      <div key={sop.id} className="flex gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                        <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black flex-shrink-0 border border-indigo-100">{sop.urutan}</div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 leading-tight">{sop.aktivitas}</h4>
                          {sop.catatan && <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{sop.catatan}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACTION SUBMIT */}
          {filteredDailySops.length > 0 && !isViewOnlyPhase && (
            <div className="pt-8 mt-4 border-t border-gray-200 space-y-4">
              {isDailyPhaseLocked ? (
                <div className="w-full py-5 bg-green-50 border border-green-200 rounded-[1.5rem] text-green-700 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest shadow-sm">
                  <CheckCircle2 size={18}/> Laporan {activePhase} Selesai
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-[1.5rem] cursor-pointer shadow-sm hover:border-indigo-200 transition-colors">
                    <input type="checkbox" className="mt-1 w-5 h-5 accent-indigo-600 rounded cursor-pointer" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} />
                    <span className="text-[11px] text-gray-600 font-medium leading-relaxed">
                      Dengan mencentang ini, saya menyatakan bahwa <b>seluruh SOP di atas telah saya lakukan</b> dengan standar ruko.
                    </span>
                  </label>
                  <button 
                    onClick={() => setShowDailyModal(true)}
                    disabled={!isAgreed}
                    className={`w-full py-5 rounded-[1.5rem] flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-widest transition-all ${isAgreed ? 'bg-gray-900 hover:bg-black text-white shadow-lg active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    <Camera size={18}/> Input Bukti Foto
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
          <div className="flex justify-between items-end bg-white border border-gray-100 p-6 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Area Tanggung Jawab:</span>
              <span className="text-xl font-black text-indigo-600 uppercase tracking-tight">{user.hk_area_pic || 'Belum Di-Set'}</span>
            </div>
            <div className="text-right"><span className="text-3xl font-black text-gray-900 tracking-tighter">{hkProgress}%</span></div>
          </div>
          
          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden border border-gray-200 shadow-inner">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${hkProgress}%` }}></div>
          </div>

          {filteredHkSops.length === 0 ? (
            <div className="p-10 text-center bg-white border border-gray-200 rounded-[2rem] shadow-sm">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Tidak ada Tugas Area di fase ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedHkSops).map(zona => (
                <div key={zona} className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4">
                  <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-gray-100 pb-3">{zona}</h3>
                  <div className="space-y-3 pt-2">
                    {groupedHkSops[zona].map(task => {
                      const log = hkLogs.find(l => l.sop_id === task.id);
                      const isDone = log?.status === 'Selesai';
                      const isKendala = log?.status === 'Kendala';
                      
                      let boxClass = 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md cursor-pointer active:scale-95';
                      let icon = <Circle size={24} className="text-gray-300" strokeWidth={1.5} />;
                      
                      if (isDone) { boxClass = 'bg-green-50 border-green-100 opacity-80 cursor-default'; icon = <CheckCircle2 size={24} className="text-green-500" />; } 
                      else if (isKendala) { boxClass = 'bg-red-50 border-red-100 opacity-80 cursor-default'; icon = <AlertTriangle size={24} className="text-red-500" />; }

                      return (
                        <div key={task.id} onClick={() => openHkModal(task)} className={`p-5 rounded-[1.5rem] border-2 flex items-center justify-between transition-all ${boxClass}`}>
                          <div className="flex items-center gap-4 flex-1">
                            <div className="flex-shrink-0">{icon}</div>
                            <div className="flex-1">
                              <p className={`text-sm font-bold leading-snug ${log ? 'text-gray-500' : 'text-gray-900'}`}>{task.rincian_jobdesk}</p>
                            </div>
                          </div>
                          {task.wajib_foto && !log && <div className="ml-4 w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400"><Camera size={16} strokeWidth={2}/></div>}
                        </div>
                      )
                    })}
                  </div>
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
        <div className="fixed inset-0 z-[60] bg-gray-900/60 backdrop-blur-sm flex flex-col p-4 sm:p-6 animate-in fade-in">
          <div className="flex-1 overflow-y-auto no-scrollbar pt-8 pb-6 text-center bg-white rounded-[2rem] shadow-2xl">
            <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldCheck size={32}/></div>
            <h3 className="text-xl font-black uppercase text-gray-900">Validasi Laporan</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Sertakan foto bukti {activePhase}</p>

            <div className="grid grid-cols-2 gap-4 mt-8 px-6">
              {[1, 2, 3].map(slot => {
                const label = currentPhotoLabels[slot - 1];
                if (!label) return null; 

                return (
                  <label key={slot} className={`aspect-[3/4] bg-gray-50 border-2 border-dashed border-gray-200 rounded-[1.5rem] flex flex-col items-center justify-center overflow-hidden relative cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors ${slot === 3 ? 'col-span-2 aspect-video' : ''}`}>
                    {dailyPreviews[slot] ? (
                      <img src={dailyPreviews[slot]} className="w-full h-full object-cover shadow-inner" alt={`Bukti ${slot}`} />
                    ) : (
                      <div className="p-4 flex flex-col items-center text-center">
                        <ImageIcon size={28} strokeWidth={1.5} className="text-gray-300 mb-3"/>
                        <span className="text-[10px] font-black text-gray-400 uppercase leading-snug">{label}</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleDailyPhotoChange(e, slot)}/>
                  </label>
                )
              })}
            </div>
            <p className={`text-[10px] italic mt-6 px-6 ${isAllPhotosFilled ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
              * Wajib upload SEMUA foto bukti untuk mengaktifkan tombol Submit.
            </p>
          </div>
          
          <div className="pt-4 grid grid-cols-2 gap-3 mt-4">
             <button onClick={() => setShowDailyModal(false)} className="py-4 font-black text-xs text-gray-500 uppercase bg-white border border-gray-200 rounded-2xl shadow-sm active:scale-95 transition-transform">Batal</button>
             <button onClick={submitDailyDuty} disabled={isSubmittingDaily || !isAllPhotosFilled} className="py-4 bg-gray-900 rounded-2xl font-black text-xs uppercase flex justify-center items-center gap-2 active:scale-95 transition-all text-white shadow-lg disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none">
               {isSubmittingDaily ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} SUBMIT
             </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: SUBMIT HOUSEKEEPING */}
      {/* ========================================================= */}
      {showHkModal && (
        <div className="fixed inset-0 z-[60] bg-gray-900/60 backdrop-blur-sm flex items-end p-0 sm:p-4 animate-in fade-in pb-10">
          <div className="bg-white w-full max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6 animate-in slide-in-from-bottom-full">
            
            <div className="text-center pb-5 border-b border-gray-100">
              <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 bg-indigo-50 inline-block px-3 py-1 rounded-full">{selectedHkTask?.zona}</h4>
              <p className="text-base font-bold text-gray-900 leading-snug mt-2">{selectedHkTask?.rincian_jobdesk}</p>
            </div>

            <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
              <button onClick={() => setHkAction('Selesai')} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${hkAction === 'Selesai' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><CheckCircle2 size={16} className="inline mr-1.5 mb-0.5"/> Selesai</button>
              <button onClick={() => setHkAction('Kendala')} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${hkAction === 'Kendala' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><AlertTriangle size={16} className="inline mr-1.5 mb-0.5"/> Kendala</button>
            </div>

            {hkAction === 'Kendala' && (
              <div className="space-y-2 animate-in slide-in-from-bottom-4">
                <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-2">Deskripsi Kendala (Wajib)</label>
                <textarea placeholder="Tulis alasan kendala sedetail mungkin..." className="w-full h-28 bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-medium text-gray-900 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-50 outline-none transition-all resize-none" value={hkNote} onChange={e => setHkNote(e.target.value)}></textarea>
              </div>
            )}

            <div className="space-y-3">
               <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">
                 Foto Bukti {hkAction === 'Kendala' || selectedHkTask?.wajib_foto ? <span className="text-red-500">(Wajib)</span> : <span className="text-gray-400">(Opsional)</span>}
               </label>
               <label className="w-full h-48 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[1.5rem] flex flex-col items-center justify-center overflow-hidden relative cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                  {hkPreview ? (
                    <img src={hkPreview} className="w-full h-full object-cover shadow-inner" alt="Bukti HK" />
                  ) : (
                    <>
                      <Camera size={40} strokeWidth={1.5} className="text-gray-300 mb-3"/>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tap Buka Kamera</span>
                    </>
                  )}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleHkPhotoChange}/>
               </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowHkModal(false)} className="flex-1 py-4 font-black text-[11px] uppercase tracking-widest text-gray-500 bg-gray-100 rounded-2xl active:scale-95 transition-transform">Batal</button>
              <button onClick={submitHousekeeping} disabled={isSubmittingHk} className={`flex-[2] py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex justify-center items-center gap-2 active:scale-95 transition-all text-white shadow-lg ${hkAction === 'Selesai' ? 'bg-gray-900 hover:bg-black disabled:bg-gray-300' : 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'}`}>
                {isSubmittingHk ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} SIMPAN TUGAS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}