import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Crown, Store, Camera, ToggleRight, ToggleLeft, X, Dices, ClipboardCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
import imageCompression from 'browser-image-compression';

export default function TabKaryawan({ user }) {
  const [karyawanList, setKaryawanList] = useState([]);
  const [outletList, setOutletList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // State Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState('add');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // UPDATE 1: State isSubmitting
  
  const fileInputRef = useRef(null);
  const modalRef = useRef(null); // UPDATE 4: Ref untuk modal

  const [formData, setFormData] = useState({ 
    id: null, nama: '', username: '', password: '', role: 'Capster', 
    gaji_pokok: 30, outlet_id: '', photo_url: '', is_active: true, 
    tanggal_masuk: new Date().toISOString().split('T')[0], tanggal_keluar: '', hk_area_pic: '' 
  });

  // ==========================================
  // FUNGSI TARIK DATA
  // ==========================================
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [karyawanRes, outletRes] = await Promise.all([
        supabase.from('users').select('*').order('nama', { ascending: true }),
        supabase.from('outlets').select('id, nama_outlet').eq('is_active', true)
      ]);
      setKaryawanList(karyawanRes.data || []);
      setOutletList(outletRes.data || []);
    } catch (error) {
      console.error("Gagal narik data karyawan:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // UPDATE 2, 3 & 4: Lock scroll body, ESC handler, dan modal auto-focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };

    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      // Auto-focus ke modal untuk aksesibilitas saat terbuka
      setTimeout(() => modalRef.current?.focus(), 10);
    } else {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    }

    // Cleanup saat unmount atau dependency berubah
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

  // ==========================================
  // FUNGSI HANDLER FORM & DATABASE
  // ==========================================
  const generatePassword = () => setFormData({ ...formData, password: Math.floor(10000 + Math.random() * 90000).toString() });
  
  const handleToggleStatus = async (id, currentStatus) => { 
    try { 
      await supabase.from('users').update({ is_active: !currentStatus }).eq('id', id); 
      fetchData(); 
    } catch (error) {
      alert("Gagal update status!");
    } 
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]; 
    if (!file) return; 
    setIsUploading(true);
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.1, maxWidthOrHeight: 800 });
      const fileName = `avatar_${Date.now()}.jpg`;
      await supabase.storage.from('avatars').upload(fileName, compressedFile);
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setFormData({ ...formData, photo_url: publicUrl });
    } catch (error) { 
      alert("Gagal upload foto: " + error.message); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleSave = async (e) => {
    e.preventDefault(); 
    if (!formData.outlet_id && (formData.role === 'Capster' || formData.role === 'FO')) {
      return alert("Pilih cabang dulu untuk posisi ini!");
    }
    
    setIsSubmitting(true); // UPDATE 1: Mulai loading submit
    
    try {
      const payload = {
        nama: formData.nama,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        is_active: formData.is_active,
        tanggal_masuk: formData.tanggal_masuk,
        gaji_pokok: formData.gaji_pokok === '' || formData.gaji_pokok === null ? 0 : Number(formData.gaji_pokok),
        outlet_id: formData.outlet_id === '' ? null : formData.outlet_id,
        photo_url: formData.photo_url === '' ? null : formData.photo_url,
        tanggal_keluar: formData.tanggal_keluar === '' ? null : formData.tanggal_keluar,
        hk_area_pic: formData.hk_area_pic === '' ? null : formData.hk_area_pic,
      };

      if (mode === 'add') { 
        await supabase.from('users').insert([payload]); 
      } else { 
        await supabase.from('users').update(payload).eq('id', formData.id); 
      } 
      
      setIsModalOpen(false); 
      fetchData();
    } catch (error) { 
      alert("Gagal nyimpen karyawan: " + error.message); 
    } finally {
      setIsSubmitting(false); // UPDATE 1: Stop loading submit
    }
  };

  // ==========================================
  // GROUPING LOGIC (UI)
  // ==========================================
  const managers = karyawanList.filter(k => k.role === 'Manager' || k.role === 'Owner');
  const staffByOutlet = karyawanList.filter(k => k.role !== 'Manager' && k.role !== 'Owner').reduce((acc, staff) => {
    const outletTarget = outletList.find(o => o.id === staff.outlet_id);
    const namaCabang = outletTarget ? outletTarget.nama_outlet : 'Tanpa Cabang';
    if (!acc[namaCabang]) acc[namaCabang] = [];
    acc[namaCabang].push(staff);
    return acc;
  }, {});

  return (
    // UPDATE 6: Pakai min-h-[100dvh]
    <div className="space-y-6 animate-in fade-in duration-300 min-h-[100dvh]">
      
      {/* HEADER TAB */}
      <div className="flex justify-end">
        <button 
          onClick={() => { 
            setMode('add'); 
            setFormData({ id: null, nama: '', username: '', password: '', role: 'Capster', gaji_pokok: 30, outlet_id: '', photo_url: '', is_active: true, tanggal_masuk: new Date().toISOString().split('T')[0], tanggal_keluar: '', hk_area_pic: '' }); 
            setIsModalOpen(true); 
          }} 
          aria-label="Tambah Karyawan Baru"
          // UPDATE 5: Focus ring & outline-none
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600"
        >
          <Plus size={18} /> Tambah Karyawan
        </button>
      </div>

      {/* LIST KARYAWAN */}
      {isLoading ? (
        <div className="text-center p-8 text-slate-400 animate-pulse font-bold" aria-live="polite">Memuat tim...</div>
      ) : (
        <>
          {/* GROUP 1: MANAGER / OWNER */}
          {managers.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                <Crown size={16} className="text-amber-500"/> Manajemen Pusat
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {managers.map(k => (
                    <div 
                      key={k.id} 
                      onClick={() => { setMode('edit'); setFormData(k); setIsModalOpen(true); }} 
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit Profil ${k.nama}`}
                      onKeyDown={(e) => { if(e.key === 'Enter') { setMode('edit'); setFormData(k); setIsModalOpen(true); } }}
                      // UPDATE 5: focus ring untuk aksesibilitas tab navigasi
                      className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-indigo-300 outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-100 transition-all ${!k.is_active ? 'opacity-50 grayscale' : ''}`}
                    >
                      {k.photo_url ? <img src={k.photo_url} alt={`Foto ${k.nama}`} className="w-12 h-12 rounded-full object-cover"/> : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black bg-amber-500">{k.nama.charAt(0)}</div>}
                      <div>
                        <h3 className="font-bold text-slate-800">{k.nama}</h3>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">{k.role}</span>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          )}

          {/* GROUP 2: STAFF BERDASARKAN CABANG */}
          {Object.keys(staffByOutlet).map(cabang => (
            <div key={cabang} className="space-y-3 pt-4">
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                <Store size={16} className="text-indigo-400"/> {cabang}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {staffByOutlet[cabang].map(k => (
                    <div 
                      key={k.id} 
                      onClick={() => { setMode('edit'); setFormData(k); setIsModalOpen(true); }} 
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit Profil ${k.nama}`}
                      onKeyDown={(e) => { if(e.key === 'Enter') { setMode('edit'); setFormData(k); setIsModalOpen(true); } }}
                      className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-indigo-300 outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-100 transition-all ${!k.is_active ? 'opacity-50 grayscale' : ''}`}
                    >
                      {k.photo_url ? <img src={k.photo_url} alt={`Foto ${k.nama}`} className="w-12 h-12 rounded-full object-cover"/> : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black bg-indigo-500">{k.nama.charAt(0)}</div>}
                      <div>
                        <h3 className="font-bold text-slate-800">{k.nama}</h3>
                        <div className="flex gap-1 mt-1">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">{k.role}</span>
                          {k.hk_area_pic && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">PIC: {k.hk_area_pic}</span>}
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* =========================================
          MODAL FORM KARYAWAN
          ========================================= */}
      {isModalOpen && (
        <div 
          // UPDATE 3: Modal tutup kalau backdrop diklik
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
           <div 
             // UPDATE 3, 4 & 5: Auto-focus & Stop propagation (biar ga ikutan ketutup)
             ref={modalRef}
             tabIndex={-1}
             role="dialog"
             aria-modal="true"
             aria-labelledby="modal-title"
             onClick={(e) => e.stopPropagation()}
             className="bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
           >
            <div className="p-5 border-b flex justify-between items-center">
              <h2 id="modal-title" className="font-black text-slate-800">Profil Karyawan</h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                aria-label="Tutup Modal"
                className="text-slate-400 hover:text-rose-500 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg p-1 transition-all"
              >
                <X size={20}/>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
               
               {/* FOTO & NAMA & STATUS */}
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <div className="relative">
                   {formData.photo_url ? <img src={formData.photo_url} alt="Preview Avatar" className="w-16 h-16 rounded-full object-cover border-4 border-white"/> : <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-400"><Users size={24}/></div>}
                   <button 
                     type="button" 
                     onClick={() => fileInputRef.current.click()} 
                     aria-label="Ganti Foto"
                     className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600 transition-all"
                   >
                     <Camera size={12}/>
                   </button>
                   <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" aria-hidden="true" />
                 </div>
                 <div className="flex-1">
                   <input 
                     required 
                     value={formData.nama} 
                     onChange={e => setFormData({...formData, nama: e.target.value})} 
                     aria-label="Nama Lengkap"
                     className="w-full bg-transparent font-black text-lg text-slate-800 outline-none border-b focus:border-indigo-600 pb-1" 
                     placeholder="Nama Lengkap"
                   />
                   <div className="flex items-center justify-between mt-2">
                     <span className="text-[10px] font-black uppercase text-slate-400">Status Aktif:</span>
                     <button 
                       type="button" 
                       onClick={() => setFormData({...formData, is_active: !formData.is_active})} 
                       aria-label={`Toggle Status ${formData.is_active ? 'Nonaktifkan' : 'Aktifkan'}`}
                       className="text-slate-400 hover:text-indigo-600 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-full"
                     >
                       {formData.is_active ? <ToggleRight size={28} className="text-emerald-500" /> : <ToggleLeft size={28} />}
                     </button>
                   </div>
                 </div>
               </div>

               {/* CABANG & ROLE */}
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label htmlFor="cabang-select" className="text-[10px] font-black text-slate-400 uppercase">Cabang</label>
                   <select 
                     id="cabang-select"
                     value={formData.outlet_id || ''} 
                     onChange={e => setFormData({...formData, outlet_id: e.target.value})} 
                     className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200"
                   >
                     <option value="" disabled>-- Pilih --</option>
                     {outletList.map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
                   </select>
                 </div>
                 <div>
                   <label htmlFor="posisi-select" className="text-[10px] font-black text-slate-400 uppercase">Posisi</label>
                   <select 
                     id="posisi-select"
                     value={formData.role} 
                     onChange={e => setFormData({...formData, role: e.target.value})} 
                     className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200"
                   >
                     <option value="Capster">Capster</option>
                     <option value="FO">Front Office</option>
                     <option value="Manager">Manager</option>
                   </select>
                 </div>
               </div>

               
               {/* TANGGUNG JAWAB HK AREA - DROPDOWN VERSION */}
               <div className="p-3 border border-amber-200 bg-amber-50 rounded-xl">
                 <label htmlFor="hk-select" className="text-[10px] font-black text-amber-700 uppercase flex items-center gap-1">
                   <ClipboardCheck size={12}/> PIC Housekeeping (Zona)
                 </label>
                 <select 
                   id="hk-select"
                   value={formData.hk_area_pic || ''} 
                   onChange={e => setFormData({...formData, hk_area_pic: e.target.value})} 
                   className="w-full mt-1 p-2 bg-white border border-amber-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-200 transition-all"
                 >
                   <option value="">-- Tanpa PIC / Fleksibel --</option>
                   <option value="Area 1">Area 1</option>
                   <option value="Area 2">Area 2</option>
                   <option value="Area 3">Area 3</option>
                 </select>
                 <p className="text-[9px] text-amber-600/70 mt-1 font-bold leading-tight">
                   Pilih area tanggung jawab tetap untuk laporan Housekeeping harian.
                 </p>
               </div>

               {/* KREDENSIAL & GAJI */}
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label htmlFor="gaji-input" className="text-[10px] font-black text-slate-400 uppercase">{formData.role === 'Capster' ? 'Komisi (%)' : 'Gaji Pokok'}</label>
                    <input 
                      id="gaji-input"
                      type="number" 
                      value={formData.gaji_pokok} 
                      onChange={e => setFormData({...formData, gaji_pokok: e.target.value})} 
                      className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="username-input" className="text-[10px] font-black text-slate-400 uppercase">Username</label>
                    <input 
                      id="username-input"
                      required 
                      value={formData.username} 
                      onChange={e => setFormData({...formData, username: e.target.value})} 
                      className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="password-input" className="text-[10px] font-black text-slate-400 uppercase">PIN / Sandi</label>
                    <div className="relative mt-1">
                      <input 
                        id="password-input"
                        required 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-10 outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200"
                      />
                      <button 
                        type="button" 
                        onClick={generatePassword} 
                        aria-label="Generate Password Acak"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all"
                      >
                        <Dices size={16}/>
                      </button>
                    </div>
                  </div>
               </div>

               {/* UPDATE 7: Feedback loading submit dan disable logic */}
               <button 
                 type="submit" 
                 disabled={isUploading || isSubmitting} 
                 aria-label="Simpan Data Karyawan"
                 className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-4 rounded-xl font-black shadow-lg shadow-slate-200 mt-4 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 flex justify-center items-center gap-2"
               >
                 {isSubmitting ? (
                   <>
                     <Loader2 size={18} className="animate-spin" />
                     Menyimpan...
                   </>
                 ) : isUploading ? (
                   <>
                     <Loader2 size={18} className="animate-spin" />
                     Mengupload Foto...
                   </>
                 ) : (
                   'Simpan Profil Karyawan'
                 )}
               </button>
            </form>
           </div>
        </div>
      )}

    </div>
  );
}