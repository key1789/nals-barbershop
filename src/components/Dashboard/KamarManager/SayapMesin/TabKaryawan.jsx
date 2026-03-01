import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Crown, Store, Camera, ToggleRight, ToggleLeft, X, Dices, ClipboardCheck } from 'lucide-react';
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
  const fileInputRef = useRef(null);
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
    try {
      // 1. KITA FILTER DATA SEBELUM DIKIRIM (Reality Check)
      const payload = {
        nama: formData.nama,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        is_active: formData.is_active,
        tanggal_masuk: formData.tanggal_masuk,
        
        // 2. CONVERT STRING KE ANGKA, KALAU KOSONG JADIIN 0
        gaji_pokok: formData.gaji_pokok === '' || formData.gaji_pokok === null ? 0 : Number(formData.gaji_pokok),
        
        // 3. KALAU TEXT KOSONG, UBAH JADI NULL BIAR SUPABASE NGGAK NGAMUK
        outlet_id: formData.outlet_id === '' ? null : formData.outlet_id,
        photo_url: formData.photo_url === '' ? null : formData.photo_url,
        tanggal_keluar: formData.tanggal_keluar === '' ? null : formData.tanggal_keluar,
        hk_area_pic: formData.hk_area_pic === '' ? null : formData.hk_area_pic,
      };

      if (mode === 'add') { 
        // ID nggak usah dikirim kalau 'add', biarin Supabase yang bikin otomatis
        await supabase.from('users').insert([payload]); 
      } else { 
        // Kalau edit, kita baru pake ID dari formData
        await supabase.from('users').update(payload).eq('id', formData.id); 
      } 
      
      setIsModalOpen(false); 
      fetchData();
    } catch (error) { 
      alert("Gagal nyimpen karyawan: " + error.message); 
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
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER TAB */}
      <div className="flex justify-end">
        <button 
          onClick={() => { 
            setMode('add'); 
            setFormData({ id: null, nama: '', username: '', password: '', role: 'Capster', gaji_pokok: 30, outlet_id: '', photo_url: '', is_active: true, tanggal_masuk: new Date().toISOString().split('T')[0], tanggal_keluar: '', hk_area_pic: '' }); 
            setIsModalOpen(true); 
          }} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
        >
          <Plus size={18} /> Tambah Karyawan
        </button>
      </div>

      {/* LIST KARYAWAN */}
      {isLoading ? (
        <div className="text-center p-8 text-slate-400 animate-pulse font-bold">Memuat tim...</div>
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
                    <div key={k.id} onClick={() => { setMode('edit'); setFormData(k); setIsModalOpen(true); }} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-indigo-300 transition-all ${!k.is_active ? 'opacity-50 grayscale' : ''}`}>
                      {k.photo_url ? <img src={k.photo_url} className="w-12 h-12 rounded-full object-cover"/> : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black bg-amber-500">{k.nama.charAt(0)}</div>}
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
                    <div key={k.id} onClick={() => { setMode('edit'); setFormData(k); setIsModalOpen(true); }} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-indigo-300 transition-all ${!k.is_active ? 'opacity-50 grayscale' : ''}`}>
                      {k.photo_url ? <img src={k.photo_url} className="w-12 h-12 rounded-full object-cover"/> : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black bg-indigo-500">{k.nama.charAt(0)}</div>}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b flex justify-between items-center">
              <h2 className="font-black text-slate-800">Profil Karyawan</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
               
               {/* FOTO & NAMA & STATUS */}
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <div className="relative">
                   {formData.photo_url ? <img src={formData.photo_url} className="w-16 h-16 rounded-full object-cover border-4 border-white"/> : <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-400"><Users size={24}/></div>}
                   <button type="button" onClick={() => fileInputRef.current.click()} className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 text-white rounded-full"><Camera size={12}/></button>
                   <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*"/>
                 </div>
                 <div className="flex-1">
                   <input required value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} className="w-full bg-transparent font-black text-lg text-slate-800 outline-none border-b focus:border-indigo-600 pb-1" placeholder="Nama Lengkap"/>
                   <div className="flex items-center justify-between mt-2">
                     <span className="text-[10px] font-black uppercase text-slate-400">Status Aktif:</span>
                     <button type="button" onClick={() => setFormData({...formData, is_active: !formData.is_active})} className="text-slate-400 hover:text-indigo-600">
                       {formData.is_active ? <ToggleRight size={28} className="text-emerald-500" /> : <ToggleLeft size={28} />}
                     </button>
                   </div>
                 </div>
               </div>

               {/* CABANG & ROLE */}
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase">Cabang</label>
                   <select value={formData.outlet_id || ''} onChange={e => setFormData({...formData, outlet_id: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500">
                     <option value="" disabled>-- Pilih --</option>
                     {outletList.map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase">Posisi</label>
                   <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500">
                     <option value="Capster">Capster</option>
                     <option value="FO">Front Office</option>
                     <option value="Manager">Manager</option>
                   </select>
                 </div>
               </div>

               
               {/* TANGGUNG JAWAB HK AREA - DROPDOWN VERSION */}
<div className="p-3 border border-amber-200 bg-amber-50 rounded-xl">
  <label className="text-[10px] font-black text-amber-700 uppercase flex items-center gap-1">
    <ClipboardCheck size={12}/> PIC Housekeeping (Zona)
  </label>
  <select 
    value={formData.hk_area_pic || ''} 
    onChange={e => setFormData({...formData, hk_area_pic: e.target.value})} 
    className="w-full mt-1 p-2 bg-white border border-amber-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 transition-all"
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
                    <label className="text-[10px] font-black text-slate-400 uppercase">{formData.role === 'Capster' ? 'Komisi (%)' : 'Gaji Pokok'}</label>
                    <input type="number" value={formData.gaji_pokok} onChange={e => setFormData({...formData, gaji_pokok: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase">Username</label>
                    <input required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase">PIN / Sandi</label>
                    <div className="relative mt-1">
                      <input required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-10 outline-none focus:border-indigo-500"/>
                      <button type="button" onClick={generatePassword} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200"><Dices size={16}/></button>
                    </div>
                  </div>
               </div>

               <button type="submit" disabled={isUploading} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-4 rounded-xl font-black shadow-lg shadow-slate-200 mt-4 active:scale-95 transition-all">
                 {isUploading ? 'Mengupload Foto...' : 'Simpan Profil Karyawan'}
               </button>
            </form>
           </div>
        </div>
      )}

    </div>
  );
}