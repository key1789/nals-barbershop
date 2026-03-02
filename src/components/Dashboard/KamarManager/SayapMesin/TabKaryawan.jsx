import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Crown, Store, Camera, ToggleRight, ToggleLeft, X, Dices, ClipboardCheck, Loader2, Award } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
import imageCompression from 'browser-image-compression';

export default function TabKaryawan({ user }) {
  const [karyawanList, setKaryawanList] = useState([]);
  const [outletList, setOutletList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState('add');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  
  const fileInputRef = useRef(null);
  const modalRef = useRef(null); 

  const [formData, setFormData] = useState({ 
    id: null, nama: '', username: '', password: '', role: 'Capster', 
    gaji_pokok: 30, outlet_id: '', photo_url: '', is_active: true, 
    tanggal_masuk: new Date().toISOString().split('T')[0], tanggal_keluar: '', hk_area_pic: '',
    target_kepala_bulanan: 200, 
    toleransi_durasi_layanan_menit: 15, 
    toleransi_telat_absen_menit: 10 
  });

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };

    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      setTimeout(() => modalRef.current?.focus(), 10);
    } else {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

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
    
    setIsSubmitting(true); 
    
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
        target_kepala_bulanan: Number(formData.target_kepala_bulanan) || 0,
        toleransi_durasi_layanan_menit: Number(formData.toleransi_durasi_layanan_menit) || 0,
        toleransi_telat_absen_menit: Number(formData.toleransi_telat_absen_menit) || 0,
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
      setIsSubmitting(false); 
    }
  };

  const managers = karyawanList.filter(k => k.role === 'Manager' || k.role === 'Owner');
  const staffByOutlet = karyawanList.filter(k => k.role !== 'Manager' && k.role !== 'Owner').reduce((acc, staff) => {
    const outletTarget = outletList.find(o => o.id === staff.outlet_id);
    const namaCabang = outletTarget ? outletTarget.nama_outlet : 'Tanpa Cabang';
    if (!acc[namaCabang]) acc[namaCabang] = [];
    acc[namaCabang].push(staff);
    return acc;
  }, {});

  return (
    <div className="space-y-6 px-1 md:px-2 animate-in fade-in duration-300 min-h-[100dvh]">
      
      {/* HEADER TAB */}
      <div className="flex justify-between items-center mt-2 border-b border-slate-200/80 pb-5">
        <div>
           <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100/50">
                <Users size={22} strokeWidth={1.5}/>
              </div>
              Data Karyawan
           </h2>
        </div>
        <button 
          onClick={() => { 
            setMode('add'); 
            setFormData({ 
              id: null, nama: '', username: '', password: '', role: 'Capster', 
              gaji_pokok: 30, outlet_id: '', photo_url: '', is_active: true, 
              tanggal_masuk: new Date().toISOString().split('T')[0], tanggal_keluar: '', hk_area_pic: '',
              target_kepala_bulanan: 200, toleransi_durasi_layanan_menit: 15, toleransi_telat_absen_menit: 10 
            }); 
            setIsModalOpen(true); 
          }} 
          aria-label="Tambah Karyawan Baru"
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl font-semibold text-[14px] shadow-md shadow-slate-900/10 transition-all flex items-center gap-2 outline-none focus:ring-4 focus:ring-slate-200 active:scale-95"
        >
          <Plus size={18} strokeWidth={1.5}/> <span className="hidden md:inline">Tambah Karyawan</span>
        </button>
      </div>

      {/* LIST KARYAWAN */}
      {isLoading ? (
        <div className="text-center p-12 text-slate-400 animate-pulse font-medium flex flex-col items-center" aria-live="polite">
          <Loader2 size={32} strokeWidth={1.5} className="animate-spin mb-3 text-indigo-400"/>
          Memuat tim...
        </div>
      ) : (
        <div className="space-y-8">
          {/* GROUP 1: MANAGER / OWNER */}
          {managers.length > 0 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-[13px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                <Crown size={16} strokeWidth={1.5} className="text-amber-500"/> Manajemen Pusat
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {managers.map(k => (
                    <div 
                      key={k.id} 
                      onClick={() => { setMode('edit'); setFormData(k); setIsModalOpen(true); }} 
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit Profil ${k.nama}`}
                      onKeyDown={(e) => { if(e.key === 'Enter') { setMode('edit'); setFormData(k); setIsModalOpen(true); } }}
                      className={`bg-white p-5 rounded-3xl shadow-sm border border-slate-200/60 flex items-center gap-4 cursor-pointer hover:border-indigo-300 hover:shadow-md outline-none focus-visible:border-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-50 transition-all ${!k.is_active ? 'opacity-60 grayscale' : ''}`}
                    >
                      {k.photo_url ? (
                        <img src={k.photo_url} alt={`Foto ${k.nama}`} className="w-14 h-14 rounded-full object-cover border border-slate-200"/>
                      ) : (
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-amber-700 font-bold text-lg bg-amber-50 border border-amber-100">{k.nama.charAt(0)}</div>
                      )}
                      <div>
                        <h3 className="font-bold text-[15px] text-slate-900 leading-tight">{k.nama}</h3>
                        <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 mt-1.5 inline-block border border-amber-100">{k.role}</span>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          )}

          {/* GROUP 2: STAFF BERDASARKAN CABANG */}
          {Object.keys(staffByOutlet).map(cabang => (
            <div key={cabang} className="space-y-4 pt-2">
              <h2 className="flex items-center gap-2 text-[13px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                <Store size={16} strokeWidth={1.5} className="text-indigo-500"/> {cabang}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffByOutlet[cabang].map(k => (
                    <div 
                      key={k.id} 
                      onClick={() => { setMode('edit'); setFormData(k); setIsModalOpen(true); }} 
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit Profil ${k.nama}`}
                      onKeyDown={(e) => { if(e.key === 'Enter') { setMode('edit'); setFormData(k); setIsModalOpen(true); } }}
                      className={`bg-white p-5 rounded-3xl shadow-sm border border-slate-200/60 flex items-center gap-4 cursor-pointer hover:border-indigo-300 hover:shadow-md outline-none focus-visible:border-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-50 transition-all ${!k.is_active ? 'opacity-60 grayscale' : ''}`}
                    >
                      {k.photo_url ? (
                        <img src={k.photo_url} alt={`Foto ${k.nama}`} className="w-14 h-14 rounded-full object-cover border border-slate-200"/>
                      ) : (
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg bg-indigo-50 border border-indigo-100">{k.nama.charAt(0)}</div>
                      )}
                      <div>
                        <h3 className="font-bold text-[15px] text-slate-900 leading-tight">{k.nama}</h3>
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{k.role}</span>
                          {k.hk_area_pic && <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100/50 text-amber-700">PIC: {k.hk_area_pic}</span>}
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================
          MODAL FORM KARYAWAN
          ========================================= */}
      {isModalOpen && (
        <div 
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"
        >
           <div 
             ref={modalRef}
             tabIndex={-1}
             role="dialog"
             aria-modal="true"
             aria-labelledby="modal-title"
             onClick={(e) => e.stopPropagation()}
             className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
           >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 id="modal-title" className="font-extrabold text-slate-900 text-lg tracking-tight">Profil Karyawan</h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                aria-label="Tutup Modal"
                className="text-slate-400 hover:text-slate-900 bg-white hover:bg-slate-100 outline-none focus:ring-4 focus:ring-slate-100 rounded-full p-2 transition-all"
              >
                <X size={20} strokeWidth={1.5}/>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto no-scrollbar bg-slate-50/50">
               
               {/* FOTO & NAMA & STATUS */}
               <div className="flex flex-col sm:flex-row sm:items-center gap-5 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm shadow-slate-50">
                 <div className="relative shrink-0 w-max mx-auto sm:mx-0">
                   {formData.photo_url ? (
                     <img src={formData.photo_url} alt="Preview Avatar" className="w-20 h-20 rounded-full object-cover border border-slate-200"/>
                   ) : (
                     <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-400"><Users size={32} strokeWidth={1.5}/></div>
                   )}
                   <button 
                     type="button" 
                     onClick={() => fileInputRef.current.click()} 
                     aria-label="Ganti Foto"
                     className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full outline-none focus:ring-4 focus:ring-indigo-100 transition-all shadow-md"
                   >
                     <Camera size={14} strokeWidth={2}/>
                   </button>
                   <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" aria-hidden="true" />
                 </div>
                 
                 <div className="flex-1 space-y-3">
                   <input 
                     required 
                     value={formData.nama} 
                     onChange={e => setFormData({...formData, nama: e.target.value})} 
                     aria-label="Nama Lengkap"
                     className="w-full bg-transparent font-extrabold text-xl text-slate-900 outline-none border-b border-slate-200 focus:border-indigo-500 pb-1.5 placeholder-slate-300 transition-colors" 
                     placeholder="Nama Lengkap Karyawan"
                   />
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-slate-500">Status Aktif:</span>
                     <button 
                       type="button" 
                       onClick={() => setFormData({...formData, is_active: !formData.is_active})} 
                       aria-label={`Toggle Status ${formData.is_active ? 'Nonaktifkan' : 'Aktifkan'}`}
                       className="text-slate-400 hover:text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-50 rounded-full transition-colors"
                     >
                       {formData.is_active ? <ToggleRight size={36} strokeWidth={1.5} className="text-emerald-500" /> : <ToggleLeft size={36} strokeWidth={1.5} />}
                     </button>
                   </div>
                 </div>
               </div>

               {/* CABANG & ROLE */}
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label htmlFor="cabang-select" className="text-xs font-semibold text-slate-600 mb-1.5 block">Cabang</label>
                   <select 
                     id="cabang-select"
                     value={formData.outlet_id || ''} 
                     onChange={e => setFormData({...formData, outlet_id: e.target.value})} 
                     className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all appearance-none"
                   >
                     <option value="" disabled>-- Pilih --</option>
                     {outletList.map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
                   </select>
                 </div>
                 <div>
                   <label htmlFor="posisi-select" className="text-xs font-semibold text-slate-600 mb-1.5 block">Posisi</label>
                   <select 
                     id="posisi-select"
                     value={formData.role} 
                     onChange={e => setFormData({...formData, role: e.target.value})} 
                     className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all appearance-none"
                   >
                     <option value="Capster">Capster</option>
                     <option value="FO">Front Office</option>
                     <option value="Manager">Manager</option>
                     <option value="Owner">Owner</option>
                   </select>
                 </div>
               </div>
               
               {/* TANGGUNG JAWAB HK AREA */}
               <div className="p-4 border border-amber-200/60 bg-amber-50/50 rounded-3xl">
                 <label htmlFor="hk-select" className="text-xs font-bold text-amber-700 flex items-center gap-1.5 mb-2">
                   <ClipboardCheck size={14} strokeWidth={1.5}/> PIC Housekeeping (Zona)
                 </label>
                 <select 
                   id="hk-select"
                   value={formData.hk_area_pic || ''} 
                   onChange={e => setFormData({...formData, hk_area_pic: e.target.value})} 
                   className="w-full px-4 py-3 bg-white border border-amber-200/60 rounded-2xl text-[14px] font-medium outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all appearance-none"
                 >
                   <option value="">-- Tanpa PIC / Fleksibel --</option>
                   <option value="Area 1">Area 1</option>
                   <option value="Area 2">Area 2</option>
                   <option value="Area 3">Area 3</option>
                 </select>
                 <p className="text-[11px] text-amber-600/80 mt-2 font-medium leading-relaxed">
                   Pilih area tanggung jawab tetap untuk tugas Housekeeping harian.
                 </p>
               </div>

               {/* KREDENSIAL & GAJI */}
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <label htmlFor="gaji-input" className="text-xs font-semibold text-emerald-700 mb-1.5 block">
                      {formData.role === 'Capster' ? 'Komisi (%)' : 'Gaji Pokok (Rp)'}
                    </label>
                    <input 
                      id="gaji-input"
                      type="number" 
                      value={formData.gaji_pokok} 
                      onChange={e => setFormData({...formData, gaji_pokok: e.target.value})} 
                      className="w-full px-4 py-3 bg-white border border-emerald-200/60 rounded-2xl text-[15px] font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 text-emerald-900 transition-all"
                    />
                  </div>
                  <div className="col-span-1">
                    <label htmlFor="telat-input" className="text-xs font-semibold text-slate-600 mb-1.5 block">Telat Absen (Mnt)</label>
                    <input 
                      id="telat-input"
                      type="number" 
                      value={formData.toleransi_telat_absen_menit} 
                      onChange={e => setFormData({...formData, toleransi_telat_absen_menit: e.target.value})} 
                      className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-bold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="username-input" className="text-xs font-semibold text-slate-600 mb-1.5 block">Username</label>
                    <input 
                      id="username-input"
                      required 
                      value={formData.username} 
                      onChange={e => setFormData({...formData, username: e.target.value})} 
                      className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="password-input" className="text-xs font-semibold text-slate-600 mb-1.5 block">PIN / Sandi</label>
                    <div className="relative">
                      <input 
                        id="password-input"
                        required={mode === 'add'} 
                        placeholder={mode === 'add' ? "" : "Kosongkan jika tetap"}
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium pr-12 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all placeholder-slate-300"
                      />
                      <button 
                        type="button" 
                        onClick={generatePassword} 
                        aria-label="Generate Password Acak"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                      >
                        <Dices size={16} strokeWidth={1.5}/>
                      </button>
                    </div>
                  </div>
               </div>

               {/* PARAMETER KPI CAPSTER */}
               {formData.role === 'Capster' && (
                 <div className="p-5 bg-indigo-50/50 border border-indigo-100/60 rounded-3xl grid grid-cols-2 gap-4 animate-in fade-in mt-4">
                    <div className="col-span-2">
                      <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5"><Award size={14} strokeWidth={1.5}/> Parameter KPI Khusus</p>
                    </div>
                    <div>
                       <label htmlFor="target-kepala-input" className="text-[11px] font-semibold text-indigo-800 mb-1.5 block">Target Kepala/Bln</label>
                       <input 
                         id="target-kepala-input"
                         type="number" 
                         value={formData.target_kepala_bulanan} 
                         onChange={e => setFormData({...formData, target_kepala_bulanan: e.target.value})} 
                         className="w-full px-4 py-3 bg-white border border-indigo-200/60 rounded-2xl font-bold text-[14px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" 
                         placeholder="200" 
                       />
                    </div>
                    <div>
                       <label htmlFor="toleransi-cukur-input" className="text-[11px] font-semibold text-indigo-800 mb-1.5 block">Toleransi Waktu</label>
                       <input 
                         id="toleransi-cukur-input"
                         type="number" 
                         value={formData.toleransi_durasi_layanan_menit} 
                         onChange={e => setFormData({...formData, toleransi_durasi_layanan_menit: e.target.value})} 
                         className="w-full px-4 py-3 bg-white border border-indigo-200/60 rounded-2xl font-bold text-[14px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" 
                         placeholder="15 Mnt" 
                       />
                    </div>
                 </div>
               )}

               <div className="pt-2">
                 <button 
                   type="submit" 
                   disabled={isUploading || isSubmitting} 
                   aria-label="Simpan Data Karyawan"
                   className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white py-4 rounded-2xl font-bold text-[15px] shadow-md shadow-slate-900/10 active:scale-[0.98] transition-all outline-none focus:ring-4 focus:ring-slate-200 flex justify-center items-center gap-2"
                 >
                   {isSubmitting ? (
                     <>
                       <Loader2 size={20} strokeWidth={1.5} className="animate-spin" />
                       Menyimpan...
                     </>
                   ) : isUploading ? (
                     <>
                       <Loader2 size={20} strokeWidth={1.5} className="animate-spin" />
                       Mengupload Foto...
                     </>
                   ) : (
                     'Simpan Profil Karyawan'
                   )}
                 </button>
               </div>
            </form>
           </div>
        </div>
      )}

    </div>
  );
}