import React, { useState, useEffect, useRef } from 'react';
import { Building2, Plus, Store, MapPin, Map, ToggleRight, ToggleLeft, KeyRound, Dices, Smartphone, ShieldAlert, Trash2, X } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

export default function TabInfrastruktur({ user }) {
  const [outletList, setOutletList] = useState([]);
  const [activationCodes, setActivationCodes] = useState([]);
  const [deviceTokens, setDeviceTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // === STATE MODAL CABANG ===
  const [isModalOutletOpen, setIsModalOutletOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef(null);
  const [outletMode, setOutletMode] = useState('add');
  const [outletForm, setOutletForm] = useState({ 
    id: null, nama_outlet: '', alamat: '', latitude: '', longitude: '', radius_absen: 50, is_active: true 
  });
  
  // State untuk Pabrik PIN
  const [selectedOutletForPin, setSelectedOutletForPin] = useState('');

  // ==========================================
  // FUNGSI TARIK DATA (KHUSUS INFRASTRUKTUR)
  // ==========================================
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [outletRes, pinRes, tokenRes] = await Promise.all([
        supabase.from('outlets').select('*').order('nama_outlet', { ascending: true }),
        supabase.from('activation_codes').select('*').order('created_at', { ascending: false }),
        supabase.from('device_tokens').select('*').order('created_at', { ascending: false })
      ]);

      setOutletList(outletRes.data || []);
      setActivationCodes(pinRes.data || []);
      setDeviceTokens(tokenRes.data || []);
    } catch (error) {
      console.error("Gagal narik data infrastruktur:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ==========================================
  // FUNGSI HANDLER CABANG & DEVICE
  // ==========================================
  const handleSaveOutlet = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { 
        nama_outlet: outletForm.nama_outlet, 
        alamat: outletForm.alamat, 
        latitude: outletForm.latitude ? parseFloat(outletForm.latitude) : null,
        longitude: outletForm.longitude ? parseFloat(outletForm.longitude) : null,
        radius_absen: outletForm.radius_absen ? parseInt(outletForm.radius_absen, 10) : 50,
        is_active: outletForm.is_active 
      };

      if (outletMode === 'add') { 
        await supabase.from('outlets').insert([payload]); 
      } else { 
        await supabase.from('outlets').update(payload).eq('id', outletForm.id); 
      }
      setIsModalOutletOpen(false);
      fetchData();
      alert(`Cabang ${outletForm.nama_outlet} berhasil disimpan!`);
    } catch (error) { 
      alert("Gagal nyimpen cabang: " + error.message); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleOutletStatus = async (id, currentStatus) => {
    try { 
      await supabase.from('outlets').update({ is_active: !currentStatus }).eq('id', id); 
      fetchData(); 
    } catch (error) { alert("Gagal update status!"); }
  };

  const handleGeneratePin = async () => {
    if (!selectedOutletForPin) return alert("Pilih cabang dulu buat bikin PIN!");
    try {
      const newPin = Math.floor(100000 + Math.random() * 900000).toString();
      await supabase.from('activation_codes').insert([{ 
        outlet_id: selectedOutletForPin, 
        code: newPin, 
        is_used: false 
      }]);
      fetchData();
      alert(`PIN Baru Berhasil Dibuat: ${newPin}\nSegera masukkan PIN ini di tablet kasir.`);
    } catch (error) { 
      alert("Gagal bikin PIN: " + error.message); 
    }
  };

  const handleRevokeToken = async (tokenId) => {
    if (!window.confirm("Yakin mau cabut akses tablet ini? Kasir akan otomatis ter-logout.")) return;
    try { 
      await supabase.from('device_tokens').delete().eq('id', tokenId); 
      fetchData(); 
      alert("Akses Perangkat Berhasil Dicabut!");
    } catch (error) { 
      alert("Gagal cabut akses!"); 
    }
  };

  // Lock scroll saat modal terbuka
  useEffect(() => {
    if (isModalOutletOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOutletOpen]);

  // ESC untuk tutup modal
  useEffect(() => {
    if (!isModalOutletOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsModalOutletOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isModalOutletOpen]);

  // Fokus ke modal saat buka
  useEffect(() => {
    if (isModalOutletOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isModalOutletOpen]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 min-h-[100dvh]">
      
      {/* ZONA 1: MANAJEMEN CABANG */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
           <div>
             <h2 className="font-black text-slate-800 text-lg flex items-center gap-2"><Building2 className="text-indigo-500"/> Manajemen Cabang</h2>
             <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Master data lokasi ruko & geotag</p>
           </div>
           <button 
              onClick={() => { 
                setOutletMode('add'); 
                setOutletForm({ id: null, nama_outlet: '', alamat: '', latitude: '', longitude: '', radius_absen: 50, is_active: true }); 
                setIsModalOutletOpen(true); 
              }} 
              className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 active:scale-95"
           >
              <Plus size={16}/> Buka Cabang
           </button>
         </div>

         {isLoading ? (
            <div className="text-center p-8 text-slate-400 font-bold">Memuat data cabang...</div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {outletList.map(out => (
                <div 
                  key={out.id} 
                  onClick={() => { 
                    setOutletMode('edit'); 
                    setOutletForm({ ...out, latitude: out.latitude || '', longitude: out.longitude || '', radius_absen: out.radius_absen || 50 }); 
                    setIsModalOutletOpen(true); 
                  }} 
                  className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all hover:shadow-md ${out.is_active ? 'bg-slate-50 border-slate-200 hover:border-indigo-400' : 'bg-slate-100 border-slate-200 opacity-60 grayscale'}`}
                >
                   <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-inner ${out.is_active ? 'bg-indigo-500' : 'bg-slate-400'}`}><Store size={20}/></div>
                      <div>
                         <h3 className="font-bold text-slate-800">{out.nama_outlet}</h3>
                         <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><MapPin size={10}/> {out.alamat || 'Alamat belum diatur'}</p>
                         {out.latitude && out.longitude && (
                           <p className="text-[9px] mt-1 font-bold text-emerald-600 uppercase flex items-center gap-1"><Map size={10}/> Geotag Aktif ({out.radius_absen}m)</p>
                         )}
                      </div>
                   </div>
                   <button onClick={(e) => { e.stopPropagation(); handleToggleOutletStatus(out.id, out.is_active); }} className="text-slate-400 hover:text-indigo-600 transition-colors">
                      {out.is_active ? <ToggleRight size={32} className="text-emerald-500" /> : <ToggleLeft size={32} />}
                   </button>
                </div>
              ))}
            </div>
         )}
      </div>

      {/* ZONA 2: KONTROL AKSES KASIR (DEVICE & PIN) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         
         {/* KIRI: PABRIK PIN */}
         <div className="bg-amber-50 rounded-3xl p-6 border border-amber-200 shadow-sm flex flex-col">
            <h2 className="font-black text-amber-800 text-lg flex items-center gap-2 mb-2"><KeyRound className="text-amber-500"/> Pabrik PIN Aktivasi</h2>
            <p className="text-xs font-bold text-amber-700/70 mb-6">Buat 6 digit PIN untuk mengunci tablet ruko.</p>
            
            <div className="bg-white p-4 rounded-2xl border border-amber-100 mb-6 shadow-inner shrink-0">
               <select value={selectedOutletForPin} onChange={(e) => setSelectedOutletForPin(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-amber-500 mb-3">
                  <option value="">-- Pilih Cabang Tujuan --</option>
                  {outletList.filter(o => o.is_active).map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
               </select>
               <button onClick={handleGeneratePin} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95">
                 <Dices size={18}/> Generate PIN Kasir
               </button>
            </div>

            <h3 className="text-[10px] font-black uppercase text-amber-800 tracking-widest mb-3 shrink-0">Histori PIN Terakhir</h3>
            <div className="space-y-2 flex-1 overflow-y-auto pr-2 no-scrollbar min-h-[150px]">
               {activationCodes.length === 0 ? (
                 <p className="text-center text-xs font-bold text-amber-600/50 pt-4">Belum ada histori PIN.</p>
               ) : (
                 activationCodes.slice(0, 10).map(pin => (
                    <div key={pin.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-amber-100/50 shadow-sm">
                       <div>
                          <p className="font-black text-slate-800 tracking-widest">{pin.code}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Buat: {outletList.find(o => o.id === pin.outlet_id)?.nama_outlet || '?'}</p>
                       </div>
                       {pin.is_used ? <span className="bg-rose-100 text-rose-600 text-[9px] font-black px-2 py-1 rounded-md uppercase">Hangus</span> : <span className="bg-emerald-100 text-emerald-600 text-[9px] font-black px-2 py-1 rounded-md uppercase">Aktif</span>}
                    </div>
                 ))
               )}
            </div>
         </div>

         {/* KANAN: RADAR DEVICE AKTIF */}
         <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-sm text-white relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <h2 className="font-black text-white text-lg flex items-center gap-2 mb-2 relative z-10"><Smartphone className="text-indigo-400"/> Radar Tablet Ruko</h2>
            <p className="text-xs font-bold text-slate-400 mb-6 relative z-10">Daftar perangkat yang memiliki akses mesin kasir.</p>

            <div className="space-y-3 relative z-10 flex-1 overflow-y-auto pr-2 no-scrollbar min-h-[150px]">
               {deviceTokens.length === 0 ? (
                  <div className="text-center p-6 border border-slate-800 border-dashed rounded-2xl text-slate-500 font-bold text-sm">Belum ada perangkat terhubung.</div>
               ) : (
                  deviceTokens.map(token => (
                     <div key={token.id} className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center"><ShieldAlert size={18}/></div>
                           <div>
                              <h4 className="font-bold text-sm text-slate-200">{outletList.find(o => o.id === token.outlet_id)?.nama_outlet || 'Cabang Unknown'}</h4>
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{new Date(token.created_at).toLocaleDateString('id-ID')}</p>
                           </div>
                        </div>
                        <button onClick={() => handleRevokeToken(token.id)} className="p-2 text-slate-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all" title="Cabut Akses Logout Paksa"><Trash2 size={16}/></button>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>

      {/* =========================================
          MODAL OUTLET / CABANG BARU (+ GEOTAG)
          ========================================= */}
      {isModalOutletOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onClick={e => {
            if (e.target === e.currentTarget) setIsModalOutletOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
            tabIndex={0}
          >
            <div className="p-5 border-b bg-indigo-50 border-indigo-100 flex justify-between items-center">
              <h2 className="font-black text-indigo-800 flex items-center gap-2">
                <Building2 size={20} className="text-indigo-600"/>
                {outletMode === 'add' ? 'Buka Cabang Baru' : 'Edit Info Cabang'}
              </h2>
              <button
                onClick={() => setIsModalOutletOpen(false)}
                className="p-1 hover:bg-white rounded-full text-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Tutup modal"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveOutlet} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Cabang / Ruko</label>
                <input
                  required
                  value={outletForm.nama_outlet}
                  onChange={(e) => setOutletForm({...outletForm, nama_outlet: e.target.value})}
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300 transition-colors"
                  placeholder="Misal: Nal's Sudirman"
                  aria-label="Nama Cabang"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Lengkap</label>
                <textarea
                  required
                  value={outletForm.alamat || ''}
                  onChange={(e) => setOutletForm({...outletForm, alamat: e.target.value})}
                  rows="2"
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300 transition-colors"
                  placeholder="Jl. Sudirman No 12..."
                  aria-label="Alamat Lengkap"
                ></textarea>
              </div>
              {/* DATA GEOTAG ABSENSI */}
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Map size={16} className="text-emerald-500"/>
                  <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest">Koordinat Geotag Absensi</h3>
                </div>
                <p className="text-[10px] font-bold text-emerald-600/70 leading-tight">Copy dari Google Maps. Digunakan untuk validasi absen karyawan radius ruko.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest ml-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={outletForm.latitude}
                      onChange={(e) => setOutletForm({...outletForm, latitude: e.target.value})}
                      className="w-full mt-1 p-3 bg-white border border-emerald-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300 transition-colors"
                      placeholder="-6.20000"
                      aria-label="Latitude"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest ml-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={outletForm.longitude}
                      onChange={(e) => setOutletForm({...outletForm, longitude: e.target.value})}
                      className="w-full mt-1 p-3 bg-white border border-emerald-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300 transition-colors"
                      placeholder="106.816666"
                      aria-label="Longitude"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest ml-1">Radius Toleransi (Meter)</label>
                  <input
                    type="number"
                    min="10"
                    value={outletForm.radius_absen}
                    onChange={(e) => setOutletForm({...outletForm, radius_absen: e.target.value})}
                    className="w-full mt-1 p-3 bg-white border border-emerald-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300 transition-colors"
                    placeholder="50"
                    aria-label="Radius Toleransi"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-black shadow-lg shadow-indigo-200 mt-4 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 flex items-center justify-center gap-2"
                aria-label={outletMode === 'add' ? 'Resmikan Cabang' : 'Simpan Perubahan'}
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                )}
                {outletMode === 'add' ? 'Resmikan Cabang' : 'Simpan Perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}