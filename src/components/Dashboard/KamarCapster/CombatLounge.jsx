import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, MapPin, Sparkles, Clock, CheckCircle2, ArrowRight, 
  Scissors, Lock, Edit3, Calendar, AlertTriangle, User, FileText, 
  Send, Camera, Image as ImageIcon, Loader2, Save 
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { compressImage } from './utils/imageCompressor';

const REF_STYLES = ["French Crop", "Comma Hair", "Undercut", "Mullet", "Buzz Cut", "Fade"];
const REF_JOBS = ["Mahasiswa", "Pelajar", "PNS", "Karyawan Swasta", "Wiraswasta", "Polisi/TNI"];
const REF_CONDS = ["Normal / Sehat", "Kering / Ketombe", "Berminyak / Lepek", "Tipis / Rontok"];

const SwipeOrClickButton = ({ onAction, text, colorClass = "bg-indigo-600", disabled = false, isDanger = false }) => {
  const [sliderValue, setSliderValue] = useState(0);
  const handleSliderChange = (e) => {
    if (disabled) return;
    const val = e.target.value;
    setSliderValue(val);
    if (val >= 100) { onAction(); setTimeout(() => setSliderValue(0), 500); }
  };
  return (
    <div className={`relative w-full h-16 rounded-[2rem] overflow-hidden flex items-center justify-center border-2 ${disabled ? 'opacity-50' : ''} border-slate-700 bg-slate-900`}>
      <div className={`absolute left-0 top-0 h-full ${colorClass} transition-all duration-150`} style={{ width: `${sliderValue}%` }}></div>
      <span className={`relative z-10 font-black uppercase tracking-widest text-xs pointer-events-none ${sliderValue > 10 ? 'text-white' : 'text-slate-400'}`}>
        {sliderValue > 10 ? 'LEPASKAN UNTUK EKSEKUSI...' : text}
      </span>
      <input type="range" min="0" max="100" value={sliderValue} disabled={disabled} onChange={handleSliderChange} onMouseUp={() => sliderValue < 100 && setSliderValue(0)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"/>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full z-10"><ArrowRight size={16} className="text-white"/></div>
    </div>
  );
};

export default function CombatLounge({ user, tamu, onBack }) {
  const [activeData, setActiveData] = useState(tamu);
  const [activeTab, setActiveTab] = useState('info');
  const [showSummary, setShowSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingSignal, setIsSendingSignal] = useState(false);
  const [timer, setTimer] = useState(0);

  // --- STATE MODAL FOTO ---
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const [historyData, setHistoryData] = useState(null);
  const [currentNote, setCurrentNote] = useState(null);
  const [repetisi, setRepetisi] = useState(0);
  const [suggestions, setSuggestions] = useState({ styles: REF_STYLES, jobs: REF_JOBS, conditions: REF_CONDS, hobbies: [], karakters: [], products: [] });

  const [crmForm, setCrmForm] = useState({ final_style: '', kondisi_rambut: '', rekomendasi_produk: '', catatan_obrolan: '' });
  const [customerForm, setCustomerForm] = useState({ 
    pekerjaan: activeData?.customers?.pekerjaan || '', 
    hobi: activeData?.customers?.hobi || '',
    karakter_konsumen: activeData?.customers?.karakter_konsumen || ''
  });
  
  const [fotoFiles, setFotoFiles] = useState({ depan: null, belakang: null, kanan: null, kiri: null });
  const [fotoPreviews, setFotoPreviews] = useState({ depan: null, belakang: null, kanan: null, kiri: null });

  const isReadOnly = currentNote?.status_crm === 'Final';
  const isProcess = activeData.status_layanan === 'On Process';
  const isDone = activeData.status_layanan === 'Done';
  
  // Kalau udah ada foto di DB, artinya foto udah di-lock!
  const isPhotoLocked = currentNote?.foto_depan || currentNote?.foto_belakang || currentNote?.foto_kanan || currentNote?.foto_kiri;

  useEffect(() => {
    const fetchIntel = async () => {
      try {
        const { data: notes } = await supabase.from('service_notes').select('final_style, kondisi_rambut').limit(50);
        const { data: custs } = await supabase.from('customers').select('pekerjaan, hobi, karakter_konsumen').limit(50);
        const { data: pData } = await supabase.from('products_services').select('nama_item').ilike('tipe', 'product').ilike('kategori', '%grooming%');
        
        const getUnique = (arr, key) => [...new Set(arr?.map(i => i[key]).filter(Boolean))];
        setSuggestions({
          styles: [...new Set([...REF_STYLES, ...getUnique(notes, 'final_style')])],
          jobs: [...new Set([...REF_JOBS, ...getUnique(custs, 'pekerjaan')])],
          conditions: [...new Set([...REF_CONDS, ...getUnique(notes, 'kondisi_rambut')])],
          hobbies: getUnique(custs, 'hobi'),
          karakters: getUnique(custs, 'karakter_konsumen'),
          products: getUnique(pData, 'nama_item')
        });

        const { count } = await supabase.from('visits').select('*', { count: 'exact', head: true }).eq('customer_id', activeData.customer_id).ilike('status_transaksi', 'paid');
        setRepetisi(count || 0);

        const { data: hData } = await supabase.from('service_notes').select('*').eq('customer_id', activeData.customer_id).neq('visit_id', activeData.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        setHistoryData(hData || null);

        const { data: cData } = await supabase.from('service_notes').select('*').eq('visit_id', activeData.id).maybeSingle();
        if(cData) {
          setCurrentNote(cData);
          setCrmForm({ final_style: cData.final_style || '', kondisi_rambut: cData.kondisi_rambut || '', rekomendasi_produk: cData.rekomendasi_produk || activeData.rekomendasi_produk || '', catatan_obrolan: cData.catatan_obrolan || '' });
          setFotoPreviews({
            depan: cData.foto_depan ? supabase.storage.from('service_notes_photos').getPublicUrl(cData.foto_depan).data.publicUrl : null,
            belakang: cData.foto_belakang ? supabase.storage.from('service_notes_photos').getPublicUrl(cData.foto_belakang).data.publicUrl : null,
            kanan: cData.foto_kanan ? supabase.storage.from('service_notes_photos').getPublicUrl(cData.foto_kanan).data.publicUrl : null,
            kiri: cData.foto_kiri ? supabase.storage.from('service_notes_photos').getPublicUrl(cData.foto_kiri).data.publicUrl : null,
          });
        }
      } catch (err) { console.error("Gagal nyedot data:", err); }
    };
    fetchIntel();
  }, [activeData.customer_id, activeData.id]);

  useEffect(() => {
    let interval;
    if (isProcess && activeData.start_service) {
      interval = setInterval(() => {
        let st = activeData.start_service;
        if (!st.endsWith('Z') && !st.includes('+')) st += 'Z';
        const end = activeData.end_service ? new Date(activeData.end_service + (!activeData.end_service.endsWith('Z') ? 'Z' : '')).getTime() : new Date().getTime();
        const diff = Math.floor((end - new Date(st).getTime()) / 1000);
        setTimer(diff > 0 ? diff : 0);
      }, 1000);
    } else if (isDone && activeData.start_service && activeData.end_service) {
        let st = activeData.start_service;
        if (!st.endsWith('Z') && !st.includes('+')) st += 'Z';
        let et = activeData.end_service;
        if (!et.endsWith('Z') && !et.includes('+')) et += 'Z';
        const diff = Math.floor((new Date(et).getTime() - new Date(st).getTime()) / 1000);
        setTimer(diff > 0 ? diff : 0);
    }
    return () => clearInterval(interval);
  }, [isProcess, isDone, activeData.start_service, activeData.end_service]);

  // ✨ FITUR BARU: AUTO-SAVE DRAFT SAAT NGETIK (ON BLUR) ✨
  const handleAutoSaveDraft = async () => {
    if (isReadOnly) return; // Kalau udah final, gak usah auto-save
    try {
      // 1. Auto-save ke Customers
      await supabase.from('customers').update(customerForm).eq('id', activeData.customer_id);
      
      // 2. Auto-save ke Service Notes (Sebagai Draft)
      const notePayload = {
        visit_id: activeData.id, 
        customer_id: activeData.customer_id,
        ...crmForm, 
        status_crm: currentNote?.status_crm || 'Draft'
      };

      if (currentNote?.id) {
        await supabase.from('service_notes').update(notePayload).eq('id', currentNote.id);
      } else {
        const { data } = await supabase.from('service_notes').insert([notePayload]).select().single();
        if (data) setCurrentNote(data); // Simpan ID biar next auto-save cuma nge-update
      }
    } catch (err) { console.error("Auto-save gagal:", err); }
  };

  const handleMulaiCukur = async () => {
    const now = new Date().toISOString();
    await supabase.from('visits').update({ status_layanan: 'On Process', start_service: now }).eq('id', activeData.id);
    setActiveData(prev => ({ ...prev, status_layanan: 'On Process', start_service: now }));
  };

  const handleAkhiriLayanan = async () => {
    const now = new Date().toISOString();
    await supabase.from('visits').update({ status_layanan: 'Done', end_service: now }).eq('id', activeData.id);
    setActiveData(prev => ({ ...prev, status_layanan: 'Done', end_service: now }));
    setActiveTab('form');
  };

  // ✨ FITUR BARU: UPLOAD FOTO TERPISAH DARI KUNCI FINAL ✨
  const handleFotoChange = async (e, key) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoPreviews(prev => ({ ...prev, [key]: URL.createObjectURL(file) }));
    const compressed = await compressImage(file);
    setFotoFiles(prev => ({ ...prev, [key]: compressed }));
  };

  const handleUploadPhotos = async () => {
    setIsUploadingPhotos(true);
    try {
      const uploadPromises = Object.entries(fotoFiles).map(async ([key, file]) => {
        if (!file) return null;
        const fileName = `${activeData.id}-${key}-${Date.now()}.jpg`;
        const { data } = await supabase.storage.from('service_notes_photos').upload(fileName, file);
        return { key, path: data?.path || null };
      });
      
      const results = await Promise.all(uploadPromises);
      const updates = {};
      results.forEach(res => { if (res?.path) updates[`foto_${res.key}`] = res.path; });

      if (Object.keys(updates).length > 0) {
        if (currentNote?.id) {
          await supabase.from('service_notes').update(updates).eq('id', currentNote.id);
        } else {
          // Kalau belum pernah ngetik apa-apa tapi udah mau upload foto duluan
          const payload = { visit_id: activeData.id, customer_id: activeData.customer_id, status_crm: 'Draft', ...updates };
          const { data } = await supabase.from('service_notes').insert([payload]).select().single();
          if (data) setCurrentNote(data);
        }
        // Update state lokal biar UI ngelock fotonya
        setCurrentNote(prev => ({ ...prev, ...updates }));
      }
      setShowPhotoModal(false);
      alert("✅ Foto berhasil di-Lock!");
    } catch (err) { 
      alert("Gagal upload foto."); 
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const handleSendSignal = async () => {
    if(!crmForm.rekomendasi_produk) return alert("Ketik rekomendasi produk dulu!");
    setIsSendingSignal(true);
    await supabase.from('visits').update({ rekomendasi_produk: crmForm.rekomendasi_produk }).eq('id', activeData.id);
    alert("✅ Sinyal Rekomendasi terkirim ke Kasir!");
    setIsSendingSignal(false);
  };

  // KUNCI FINAL SEKARANG SUPER CEPAT (KARENA FOTO UDAH DIUPLOAD TERPISAH)
  const handleSimpanFinal = async () => {
    setIsSaving(true);
    setShowSummary(false);
    onBack(); // Langsung balik ke Radar
    
    try {
      // Pastikan auto-save terakhir dijalanin + ubah status ke Final
      await supabase.from('customers').update(customerForm).eq('id', activeData.customer_id);
      
      const notePayload = {
        visit_id: activeData.id, 
        customer_id: activeData.customer_id,
        ...crmForm, 
        status_crm: 'Final' // Kunci gembok di sini!
      };

      if (currentNote?.id) {
        await supabase.from('service_notes').update(notePayload).eq('id', currentNote.id);
      } else {
        await supabase.from('service_notes').insert([notePayload]);
      }
    } catch (err) { console.error("Kunci Final Error:", err); }
  };

  const servicesTaken = activeData.visit_items?.filter(it => (it.products_services?.tipe || 'service').toLowerCase().trim() === 'service')
    ?.map(it => `${it.qty}x ${it.products_services?.nama_item}`).join(', ') || 'Hanya Layanan Umum';

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const kerjaAI = activeData.customers?.pekerjaan || 'Pelanggan';
  const hobiAI = activeData.customers?.hobi || 'hal seru';
  let teksAI = `Tamu lo ini seorang ${kerjaAI} yang suka ${hobiAI}. `;
  if (historyData?.catatan_obrolan) teksAI += `Bulan lalu dia ngomongin: "${historyData.catatan_obrolan}". Tanyain kelanjutannya!`;
  else teksAI += `Ajak kenalan dan cari tau kesibukannya hari ini biar dia nyaman.`;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-40 animate-in slide-in-from-right duration-300">
      <datalist id="styles">{suggestions.styles.map(s => <option key={s} value={s}/>)}</datalist>
      <datalist id="jobs">{suggestions.jobs.map(j => <option key={j} value={j}/>)}</datalist>
      <datalist id="conds">{suggestions.conditions.map(c => <option key={c} value={c}/>)}</datalist>
      <datalist id="hobs">{suggestions.hobbies.map(h => <option key={h} value={h}/>)}</datalist>
      <datalist id="karakters">{suggestions.karakters.map(k => <option key={k} value={k}/>)}</datalist>
      <datalist id="prods">{suggestions.products.map(p => <option key={p} value={p}/>)}</datalist>

      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-full"><ChevronLeft size={20}/></button>
          <div className="flex-1 text-center">
            <h3 className="text-xl font-black uppercase tracking-tighter">{activeData.customers?.inisial_panggilan || 'Kak'}. {activeData.customers?.nama}</h3>
            <span className="text-[9px] bg-amber-500/20 text-amber-500 font-bold uppercase px-2 py-0.5 rounded">{activeData.customers?.tier || 'Member'}</span>
            <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center justify-center gap-1"><Scissors size={10}/> {servicesTaken}</p>
          </div>
          <div className="w-10"></div>
        </div>

        {/* STATUS BAR */}
        {!isDone ? (
          isProcess ? (
            <div className="flex gap-3">
              <div className="flex-1 bg-slate-950 border border-indigo-500 rounded-2xl p-3 text-center">
                <p className="text-[9px] text-slate-500 uppercase font-black">Durasi</p>
                <p className="text-xl font-mono text-indigo-400">{formatTime(timer)}</p>
              </div>
              <div className="flex-[2]">
                <SwipeOrClickButton text="GESER AKHIRI" onAction={handleAkhiriLayanan} colorClass="bg-rose-600" isDanger />
              </div>
            </div>
          ) : (
            <SwipeOrClickButton text="GESER MULAI LAYANAN" onAction={handleMulaiCukur} />
          )
        ) : (
          <div className="flex items-center gap-3">
             <div className="w-1/3 bg-slate-950 border border-emerald-800 rounded-2xl p-3 text-center">
                <p className="text-[9px] text-slate-500 uppercase font-black"><CheckCircle2 size={10} className="inline text-emerald-500"/> Selesai</p>
                <p className="text-xl font-mono text-slate-500">{formatTime(timer)}</p>
             </div>
             <div className="flex-1 h-16 bg-slate-800 rounded-[2rem] flex items-center justify-center gap-2 text-slate-400 font-black text-xs uppercase">
               {isReadOnly ? <><Lock size={16}/> Data Terkunci</> : <><Edit3 size={16}/> Nyicil Isi CRM</>}
             </div>
          </div>
        )}

        {/* TABS */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl mt-6 border border-slate-800">
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl ${activeTab === 'info' ? 'bg-slate-800 text-indigo-400' : 'text-slate-500'}`}>💡 Info & Histori</button>
          <button onClick={() => setActiveTab('form')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl ${activeTab === 'form' ? 'bg-slate-800 text-indigo-400' : 'text-slate-500'}`}>📝 Input CRM</button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {activeTab === 'info' ? (
          <div className="space-y-6 animate-in fade-in">
            {/* ... AREA INFO (Sama kayak kemaren) ... */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-[2rem]">
              <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 flex items-center gap-2"><MapPin size={14}/> Informasi Dasar</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><p className="text-slate-500 font-bold mb-1 uppercase text-[9px]">Pekerjaan</p><p className="font-black">{activeData.customers?.pekerjaan || '-'}</p></div>
                <div><p className="text-slate-500 font-bold mb-1 uppercase text-[9px]">Hobi</p><p className="font-black">{activeData.customers?.hobi || '-'}</p></div>
                <div><p className="text-slate-500 font-bold mb-1 uppercase text-[9px]">Karakter</p><p className="font-black">{activeData.customers?.karakter_konsumen || '-'}</p></div>
                <div><p className="text-slate-500 font-bold mb-1 uppercase text-[9px]">Tgl Lahir</p><p className="font-black flex items-center gap-1"><Calendar size={10}/> {activeData.customers?.tanggal_lahir || '-'}</p></div>
                <div className="col-span-2"><p className="text-slate-500 font-bold mb-1 uppercase text-[9px]">Alamat</p><p className="font-black">{activeData.customers?.alamat || '-'}</p></div>
              </div>
            </div>

            <div className="bg-indigo-900/20 border border-indigo-500/30 p-5 rounded-[2rem] relative overflow-hidden">
              <Sparkles className="absolute right-4 bottom-4 text-indigo-500/10" size={80}/>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> AI Copilot & Histori</h4>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Total Kunjungan</p>
                  <p className="text-sm font-black text-indigo-400">{repetisi} Kali</p>
                </div>
              </div>
              
              {historyData ? (
                <div className="space-y-4 relative z-10">
                  <p className="text-[10px] font-bold text-slate-400 mb-2">Terakhir datang: <span className="font-black text-white">{new Date(historyData.created_at).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}</span></p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Model Terakhir</span>
                      <span className="font-black text-white">{historyData.final_style || '-'}</span>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Kondisi Rambut</span>
                      <span className="font-black text-white">{historyData.kondisi_rambut || '-'}</span>
                    </div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl mt-2">
                    <p className="text-[11px] text-emerald-300 font-bold leading-relaxed">
                      <span className="text-emerald-400 font-black">💡 Obrolan AI:</span> {teksAI}
                    </p>
                  </div>

                  {/* FOTO HISTORI */}
                  <div className="pt-3 border-t border-indigo-500/30 mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                    {['foto_depan', 'foto_belakang', 'foto_kanan', 'foto_kiri'].map(col => {
                      if(historyData[col]) {
                        return (
                          <div key={col} className="w-16 h-16 bg-slate-800 rounded-xl flex-shrink-0 overflow-hidden">
                            <img src={supabase.storage.from('service_notes_photos').getPublicUrl(historyData[col]).data.publicUrl} className="w-full h-full object-cover" alt="Histori"/>
                          </div>
                        )
                      }
                      return null;
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-amber-300 text-xs relative z-10">
                  <p className="font-black flex items-center gap-2 mb-1"><AlertTriangle size={14}/> Pelanggan Baru!</p>
                  <p className="font-medium">Tamu ini belum punya rekam medis. Bikin dia nyaman biar jadi pelanggan tetap.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB CRM */
          <div className={`space-y-6 animate-in fade-in ${isReadOnly ? 'opacity-70 pointer-events-none' : ''}`}>
            {isReadOnly ? (
               <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 text-xs font-bold flex items-center gap-2">
                 <Lock size={16}/> Data Rekam Medis hari ini sudah dikunci permanen.
               </div>
            ) : (
               <div className="flex gap-2">
                 <div className="flex-1 py-4 bg-slate-900 border border-slate-800 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 text-slate-400"><Save size={14}/> Auto-Save Aktif</div>
                 <button onClick={() => setShowSummary(true)} className="flex-[2] py-4 bg-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"><Lock size={14}/> Kunci Final</button>
               </div>
            )}

            {/* AREA TOMBOL FOTO POP-UP */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-[2rem] flex justify-between items-center">
               <div>
                 <h4 className="text-[10px] font-black text-slate-500 uppercase mb-1 flex items-center gap-2"><Camera size={14}/> Dokumentasi Foto</h4>
                 <p className="text-[9px] text-slate-500 font-bold">{isPhotoLocked ? 'Foto sudah dikunci aman.' : 'Foto akan dikunci langsung saat disave.'}</p>
               </div>
               <button onClick={() => setShowPhotoModal(true)} className={`px-4 py-3 rounded-xl font-black text-[10px] uppercase shadow-md flex items-center gap-2 ${isPhotoLocked ? 'bg-slate-800 text-emerald-500' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                 {isPhotoLocked ? <><CheckCircle2 size={14}/> Lihat Foto</> : <><Camera size={14}/> Upload Foto</>}
               </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-[2rem] space-y-4">
               <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-2"><User size={14}/> Profil Tamu</h4>
               <div className="space-y-3">
                  <input onBlur={handleAutoSaveDraft} list="jobs" placeholder="PEKERJAAN..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-bold uppercase outline-none focus:border-indigo-500" value={customerForm.pekerjaan} onChange={e => setCustomerForm({...customerForm, pekerjaan: e.target.value})}/>
                  <input onBlur={handleAutoSaveDraft} list="hobs" placeholder="HOBI..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-bold uppercase outline-none focus:border-indigo-500" value={customerForm.hobi} onChange={e => setCustomerForm({...customerForm, hobi: e.target.value})}/>
                  <input onBlur={handleAutoSaveDraft} list="karakters" placeholder="KARAKTER..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-bold uppercase outline-none focus:border-indigo-500" value={customerForm.karakter_konsumen} onChange={e => setCustomerForm({...customerForm, karakter_konsumen: e.target.value})}/>
               </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-[2rem] space-y-4">
               <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-2"><Edit3 size={14}/> Rekam Medis Rambut</h4>
               <div className="space-y-3">
                  <input onBlur={handleAutoSaveDraft} list="styles" placeholder="MODEL RAMBUT..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-bold uppercase outline-none focus:border-indigo-500" value={crmForm.final_style} onChange={e => setCrmForm({...crmForm, final_style: e.target.value})}/>
                  <input onBlur={handleAutoSaveDraft} list="conds" placeholder="KONDISI KULIT / RAMBUT..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-bold uppercase outline-none focus:border-indigo-500" value={crmForm.kondisi_rambut} onChange={e => setCrmForm({...crmForm, kondisi_rambut: e.target.value})}/>
               </div>
            </div>

            <div className="bg-emerald-900/20 border border-emerald-500/30 p-5 rounded-[2rem] space-y-4">
               <h4 className="text-[10px] font-black text-emerald-400 uppercase mb-2 flex items-center gap-2"><Sparkles size={14}/> Sinyal Obrolan</h4>
               <div className="space-y-3">
                  <div className="flex gap-2">
                    <input onBlur={handleAutoSaveDraft} list="prods" placeholder="REKOMENDASI PRODUK..." className="flex-1 w-full bg-slate-950 border border-emerald-800 p-4 rounded-xl text-xs font-bold uppercase outline-none focus:border-emerald-500" value={crmForm.rekomendasi_produk} onChange={e => setCrmForm({...crmForm, rekomendasi_produk: e.target.value})}/>
                    <button onClick={handleSendSignal} disabled={isSendingSignal || isReadOnly} className="w-14 bg-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-500 transition-colors"><Send size={18}/></button>
                  </div>
                  <textarea onBlur={handleAutoSaveDraft} placeholder="TADI NGOBROLIN APA?" className="w-full h-24 bg-slate-950 border border-emerald-800 p-4 rounded-xl text-xs font-bold outline-none focus:border-emerald-500" value={crmForm.catatan_obrolan} onChange={e => setCrmForm({...crmForm, catatan_obrolan: e.target.value})}></textarea>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* ✨ POP-UP MODAL FOTO KHUSUS ✨ */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-sm flex flex-col p-4 animate-in fade-in">
          <div className="flex-1 overflow-y-auto no-scrollbar pt-10 pb-6 space-y-6">
             <div className="text-center">
               <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4"><Camera size={32}/></div>
               <h3 className="text-xl font-black uppercase italic">Menu Foto</h3>
               <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">
                 {isPhotoLocked ? "Foto sudah dikunci. Mode Read-Only." : "Setelah disimpan, foto tidak bisa diganti."}
               </p>
             </div>

             <div className="grid grid-cols-2 gap-4">
               {['depan', 'belakang', 'kanan', 'kiri'].map(k => (
                 <label key={k} className="aspect-[3/4] bg-slate-900 border-2 border-dashed border-slate-700 rounded-[2rem] flex flex-col items-center justify-center overflow-hidden relative cursor-pointer hover:border-indigo-500 transition-colors">
                   {fotoPreviews[k] ? (
                     <img src={fotoPreviews[k]} className="w-full h-full object-cover" />
                   ) : (
                     <>
                       <ImageIcon size={30} className="text-slate-700 mb-2"/>
                       <span className="text-[10px] font-black text-slate-500 uppercase">{k}</span>
                     </>
                   )}
                   <input type="file" accept="image/*" capture="environment" className="hidden" disabled={isPhotoLocked || isUploadingPhotos} onChange={e => handleFotoChange(e, k)}/>
                 </label>
               ))}
             </div>
          </div>
          
          <div className="p-4 grid grid-cols-2 gap-3 bg-slate-950 border-t border-slate-800">
             <button onClick={() => setShowPhotoModal(false)} className="py-4 font-black text-xs text-slate-400 uppercase bg-slate-900 rounded-2xl active:scale-95">Tutup</button>
             {!isPhotoLocked && (
               <button onClick={handleUploadPhotos} disabled={isUploadingPhotos} className="py-4 bg-indigo-600 rounded-2xl font-black text-xs uppercase flex justify-center items-center gap-2 active:scale-95 shadow-lg shadow-indigo-500/30">
                 {isUploadingPhotos ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} SIMPAN FOTO
               </button>
             )}
          </div>
        </div>
      )}

      {/* MODAL SUMMARY LENGKAP (KUNCI FINAL) */}
      {showSummary && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-end p-4">
          <div className="w-full max-h-[90vh] overflow-y-auto no-scrollbar bg-slate-900 rounded-[2.5rem] border border-slate-800 p-6 space-y-6 animate-in slide-in-from-bottom-full pb-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32}/></div>
              <h3 className="text-xl font-black uppercase italic">Kunci Permanen?</h3>
            </div>
            
            <div className="bg-slate-950 rounded-2xl p-5 space-y-4 border border-slate-800">
               <div>
                 <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">Profil Tamu</h4>
                 <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-slate-400">Pekerjaan</span><span className="text-white text-right w-1/2 truncate">{customerForm.pekerjaan || '-'}</span></div>
                 <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-slate-400">Hobi</span><span className="text-white text-right w-1/2 truncate">{customerForm.hobi || '-'}</span></div>
               </div>
               
               <div>
                 <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">Rekam Medis</h4>
                 <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-slate-400">Model</span><span className="text-indigo-400 text-right w-1/2 truncate">{crmForm.final_style || '-'}</span></div>
                 <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-slate-400">Kondisi</span><span className="text-white text-right w-1/2 truncate">{crmForm.kondisi_rambut || '-'}</span></div>
               </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowSummary(false)} className="flex-1 py-4 font-black text-[10px] uppercase text-slate-500 bg-slate-800 rounded-2xl">Batal</button>
              <button onClick={handleSimpanFinal} disabled={isSaving} className="flex-[2] py-4 bg-emerald-600 rounded-2xl font-black text-[10px] uppercase flex justify-center items-center gap-2">
                {isSaving ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} KUNCI SEKARANG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}