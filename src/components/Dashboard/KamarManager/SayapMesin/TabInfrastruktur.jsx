import React, { useState, useEffect, useRef } from 'react';
// PERBAIKAN: Clock udah ditambahin di baris import ini 👇
import { Building2, Plus, Store, MapPin, Map, ToggleRight, ToggleLeft, KeyRound, Dices, Smartphone, ShieldAlert, Trash2, X, Loader2, Clock } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

export default function TabInfrastruktur({ user }) {
  const [outletList, setOutletList] = useState([]);
  const [activationCodes, setActivationCodes] = useState([]);
  const [deviceTokens, setDeviceTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOutletOpen, setIsModalOutletOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef(null);
  const [outletMode, setOutletMode] = useState('add');
  const [outletForm, setOutletForm] = useState({ 
    id: null, nama_outlet: '', alamat: '', latitude: '', longitude: '', radius_absen: 50, is_active: true 
  });
  
  const [selectedOutletForPin, setSelectedOutletForPin] = useState('');

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
    } catch (error) { 
      alert("Gagal cabut akses!"); 
    }
  };

  useEffect(() => {
    if (isModalOutletOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOutletOpen]);

  useEffect(() => {
    if (!isModalOutletOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') setIsModalOutletOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isModalOutletOpen]);

  useEffect(() => {
    if (isModalOutletOpen && modalRef.current) modalRef.current.focus();
  }, [isModalOutletOpen]);

  return (
    <div className="space-y-8 px-1 md:px-2 animate-in fade-in duration-300 min-h-[100dvh]">
      
      {/* ZONA 1: MANAJEMEN CABANG */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/60 shadow-sm">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-5 mb-5 gap-4">
           <div>
             <h2 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-500 border border-indigo-100/50">
                  <Building2 size={20} strokeWidth={1.5}/>
                </div>
                Manajemen Cabang
             </h2>
             <p className="text-[13px] font-medium text-slate-500 mt-1 md:ml-[44px]">Master data lokasi ruko & geotag absensi</p>
           </div>
           <button 
              onClick={() => { 
                setOutletMode('add'); 
                setOutletForm({ id: null, nama_outlet: '', alamat: '', latitude: '', longitude: '', radius_absen: 50, is_active: true }); 
                setIsModalOutletOpen(true); 
              }} 
              className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl font-semibold text-[14px] shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 active:scale-95 focus:outline-none"
           >
              <Plus size={18} strokeWidth={1.5}/> Buka Cabang
           </button>
         </div>

         {isLoading ? (
            <div className="text-center p-10 text-slate-400 font-medium flex flex-col items-center">
              <Loader2 size={32} strokeWidth={1.5} className="animate-spin mb-3 text-indigo-400"/>
              Memuat data cabang...
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {outletList.map(out => (
                <div 
                  key={out.id} 
                  onClick={() => { 
                    setOutletMode('edit'); 
                    setOutletForm({ ...out, latitude: out.latitude || '', longitude: out.longitude || '', radius_absen: out.radius_absen || 50 }); 
                    setIsModalOutletOpen(true); 
                  }} 
                  className={`p-5 rounded-3xl border flex items-center justify-between cursor-pointer transition-all hover:shadow-md ${out.is_active ? 'bg-white border-slate-200/80 hover:border-indigo-300' : 'bg-slate-50 border-slate-200 opacity-60 grayscale-[40%]'}`}
                >
                   <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-white border ${out.is_active ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                         <Store size={24} strokeWidth={1.5}/>
                      </div>
                      <div className="min-w-0 flex-1">
                         <h3 className="font-bold text-[15px] text-slate-900 truncate">{out.nama_outlet}</h3>
                         <p className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5 mt-1 truncate"><MapPin size={12} strokeWidth={1.5} className="shrink-0"/> {out.alamat || 'Belum diatur'}</p>
                         {out.latitude && out.longitude && (
                           <p className="text-[10px] mt-1.5 font-bold text-emerald-600 flex items-center gap-1"><Map size={12} strokeWidth={1.5}/> Geotag Aktif ({out.radius_absen}m)</p>
                         )}
                      </div>
                   </div>
                   <button onClick={(e) => { e.stopPropagation(); handleToggleOutletStatus(out.id, out.is_active); }} className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0 ml-2 focus:outline-none">
                      {out.is_active ? <ToggleRight size={32} strokeWidth={1.5} className="text-emerald-500" /> : <ToggleLeft size={32} strokeWidth={1.5} />}
                   </button>
                </div>
              ))}
            </div>
         )}
      </div>

      {/* ZONA 2: KONTROL AKSES KASIR (DEVICE & PIN) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* KIRI: PABRIK PIN */}
         <div className="bg-amber-50/50 rounded-3xl p-6 md:p-8 border border-amber-200/60 shadow-sm flex flex-col">
            <h2 className="font-extrabold text-amber-900 text-lg flex items-center gap-2 mb-1">
               <KeyRound size={20} strokeWidth={1.5} className="text-amber-600"/> Pabrik PIN Aktivasi
            </h2>
            <p className="text-[13px] font-medium text-amber-700/80 mb-6">Buat 6 digit PIN untuk mengunci tablet ruko.</p>
            
            <div className="bg-white p-5 rounded-3xl border border-amber-100 mb-8 shadow-sm shrink-0">
               <select value={selectedOutletForPin || ''} onChange={(e) => setSelectedOutletForPin(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] font-medium text-slate-800 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 mb-4 appearance-none">
                  <option value="">-- Pilih Cabang Tujuan --</option>
                  {outletList.filter(o => o.is_active).map(o => <option key={o.id} value={o.id}>{o.nama_outlet}</option>)}
               </select>
               <button onClick={handleGeneratePin} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-200 active:scale-[0.98] focus:outline-none">
                 <Dices size={18} strokeWidth={1.5}/> Generate PIN Kasir
               </button>
            </div>

            <h3 className="text-xs font-semibold text-amber-800 mb-3 shrink-0 flex items-center gap-2"><Clock size={14} strokeWidth={1.5}/> Histori PIN Terakhir</h3>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 no-scrollbar min-h-[150px]">
               {activationCodes.length === 0 ? (
                 <p className="text-center text-[13px] font-medium text-amber-600/60 pt-6">Belum ada histori PIN.</p>
               ) : (
                 activationCodes.slice(0, 10).map(pin => (
                    <div key={pin.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-amber-100 shadow-sm group">
                       <div>
                          <p className="font-extrabold text-slate-800 tracking-widest text-[15px]">{pin.code}</p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Untuk: {outletList.find(o => o.id === pin.outlet_id)?.nama_outlet || '?'}</p>
                       </div>
                       {pin.is_used ? <span className="bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Hangus</span> : <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Aktif</span>}
                    </div>
                 ))
               )}
            </div>
         </div>

         {/* KANAN: RADAR DEVICE AKTIF */}
         <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl text-white relative overflow-hidden flex flex-col group">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
            <h2 className="font-extrabold text-white text-lg flex items-center gap-2 mb-1 relative z-10">
               <Smartphone size={20} strokeWidth={1.5} className="text-indigo-400"/> Radar Tablet Ruko
            </h2>
            <p className="text-[13px] font-medium text-slate-400 mb-6 relative z-10">Daftar perangkat yang memiliki akses mesin kasir.</p>

            <div className="space-y-4 relative z-10 flex-1 overflow-y-auto pr-2 no-scrollbar min-h-[150px]">
               {deviceTokens.length === 0 ? (
                  <div className="text-center p-10 border border-slate-700 border-dashed rounded-3xl text-slate-500 font-medium text-[13px]">Belum ada perangkat terhubung.</div>
               ) : (
                  deviceTokens.map(token => (
                     <div key={token.id} className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl flex items-center justify-between hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20"><ShieldAlert size={20} strokeWidth={1.5}/></div>
                           <div>
                              <h4 className="font-bold text-[14px] text-slate-200">{outletList.find(o => o.id === token.outlet_id)?.nama_outlet || 'Cabang Unknown'}</h4>
                              <p className="text-[11px] font-medium text-slate-500 mt-1">Aktif sejak: {new Date(token.created_at).toLocaleDateString('id-ID')}</p>
                           </div>
                        </div>
                        <button onClick={() => handleRevokeToken(token.id)} className="p-2.5 text-slate-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all focus:outline-none" title="Cabut Akses Logout Paksa"><Trash2 size={18} strokeWidth={1.5}/></button>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>

      {/* MODAL OUTLET BARU */}
      {isModalOutletOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onClick={e => { if (e.target === e.currentTarget) setIsModalOutletOpen(false); }}
        >
          <div
            ref={modalRef}
            className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
            tabIndex={0}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <Building2 size={20} strokeWidth={1.5} className="text-indigo-500"/>
                {outletMode === 'add' ? 'Buka Cabang Baru' : 'Edit Info Cabang'}
              </h2>
              <button onClick={() => setIsModalOutletOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors focus:outline-none"><X size={20} strokeWidth={1.5} /></button>
            </div>

            <form onSubmit={handleSaveOutlet} className="p-6 space-y-5 bg-slate-50/50 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nama Cabang / Ruko</label>
                <input
                  required
                  value={outletForm.nama_outlet || ''}
                  onChange={(e) => setOutletForm({...outletForm, nama_outlet: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder="Misal: Nal's Sudirman"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Alamat Lengkap</label>
                <textarea
                  required
                  value={outletForm.alamat || ''}
                  onChange={(e) => setOutletForm({...outletForm, alamat: e.target.value})}
                  rows="2"
                  className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all resize-none"
                  placeholder="Jl. Sudirman No 12..."
                ></textarea>
              </div>

              {/* DATA GEOTAG ABSENSI */}
              <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-3xl space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Map size={18} strokeWidth={1.5} className="text-emerald-500"/>
                  <h3 className="text-sm font-bold text-emerald-800">Koordinat Geotag Absensi</h3>
                </div>
                <p className="text-[12px] font-medium text-emerald-600/80 leading-relaxed">Copy dari Google Maps. Digunakan untuk validasi absen karyawan radius ruko.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-emerald-700 mb-1 block">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={outletForm.latitude || ''}
                      onChange={(e) => setOutletForm({...outletForm, latitude: e.target.value})}
                      className="w-full px-3 py-2.5 bg-white border border-emerald-200/60 rounded-xl text-[14px] font-bold text-emerald-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all"
                      placeholder="-6.20000"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-emerald-700 mb-1 block">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={outletForm.longitude || ''}
                      onChange={(e) => setOutletForm({...outletForm, longitude: e.target.value})}
                      className="w-full px-3 py-2.5 bg-white border border-emerald-200/60 rounded-xl text-[14px] font-bold text-emerald-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all"
                      placeholder="106.816666"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-emerald-700 mb-1 block">Radius Toleransi (Meter)</label>
                  <input
                    type="number"
                    min="10"
                    value={outletForm.radius_absen || ''}
                    onChange={(e) => setOutletForm({...outletForm, radius_absen: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-emerald-200/60 rounded-xl text-[14px] font-bold text-emerald-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all"
                    placeholder="50"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold text-[15px] shadow-md shadow-slate-900/10 active:scale-[0.98] transition-all focus:outline-none flex items-center justify-center gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 size={20} strokeWidth={1.5} className="animate-spin"/> : null}
                  {outletMode === 'add' ? 'Resmikan Cabang' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}