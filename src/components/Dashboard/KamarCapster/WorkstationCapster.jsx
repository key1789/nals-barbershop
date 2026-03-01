import React, { useState, useEffect } from 'react';
import { 
  Clock, History, Send, Camera, User, CheckCircle2,
  ArrowRight, Sparkles, Image as ImageIcon, ChevronLeft, RefreshCw, Scissors, MapPin, Calendar, FileText, AlertTriangle, Save, Loader2, Lock, Edit3
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import imageCompression from 'browser-image-compression';

const getCleanType = (tipe) => (tipe || 'service').toLowerCase().trim();

// --- KOMPONEN TOMBOL HYBRID (SWIPE / CLICK) ---
const SwipeOrClickButton = ({ onAction, text, colorClass = "bg-indigo-600", disabled = false, isDanger = false }) => {
  const [sliderValue, setSliderValue] = useState(0);

  const handleSliderChange = (e) => {
    if (disabled) return;
    const val = e.target.value;
    setSliderValue(val);
    if (val >= 100) { onAction(); setTimeout(() => setSliderValue(0), 500); }
  };

  const bgBorder = disabled ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700';
  const textCol = isDanger ? 'text-white' : 'text-slate-800 dark:text-white';

  return (
    <div className={`relative w-full h-16 rounded-[2rem] overflow-hidden flex items-center justify-center group border-2 ${bgBorder}`}>
      <div className={`absolute left-0 top-0 h-full ${colorClass} transition-all duration-150`} style={{ width: `${sliderValue}%` }}></div>
      <span className={`relative z-10 font-black uppercase tracking-widest text-xs flex items-center gap-2 pointer-events-none transition-colors ${sliderValue > 10 ? 'text-white' : textCol}`}>
        {sliderValue > 10 ? 'LEPASKAN UNTUK EKSEKUSI...' : text}
      </span>
      <input 
        type="range" min="0" max="100" value={sliderValue} disabled={disabled}
        onChange={handleSliderChange} onMouseUp={() => { if (sliderValue < 100) setSliderValue(0); }} onTouchEnd={() => { if (sliderValue < 100) setSliderValue(0); }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <button disabled={disabled} onClick={() => { setSliderValue(100); setTimeout(() => { onAction(); setSliderValue(0); }, 300); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900/10 dark:bg-white/20 p-3 rounded-full hover:bg-slate-900/20 dark:hover:bg-white/40 transition-colors z-20">
        <ArrowRight size={16} className={sliderValue > 10 ? 'text-white' : 'text-slate-800 dark:text-white'}/>
      </button>
    </div>
  );
};

const WorkstationCapster = ({ user }) => {
  const [queues, setQueues] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hairProducts, setHairProducts] = useState([]);
  
  // STATE LAYAR TEMPUR
  const [activeVisit, setActiveVisit] = useState(null); 
  const [historyData, setHistoryData] = useState(null);
  const [currentNote, setCurrentNote] = useState(null); 
  const [repetisi, setRepetisi] = useState(0);
  const [timer, setTimer] = useState(0);
  const [activeTab, setActiveTab] = useState('info'); 
  const [showSummary, setShowSummary] = useState(false); 

  // STATE FORM
  const [customerForm, setCustomerForm] = useState({ pekerjaan: '', hobi: '', karakter_konsumen: '' });
  const [crmForm, setCrmForm] = useState({ final_style: '', kondisi_rambut: '', rekomendasi_produk: '', catatan_obrolan: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingSignal, setIsSendingSignal] = useState(false);
  
  // STATE FOTO
  const [fotoFiles, setFotoFiles] = useState({ depan: null, belakang: null, kanan: null, kiri: null });
  const [fotoPreviews, setFotoPreviews] = useState({ depan: null, belakang: null, kanan: null, kiri: null });

  // 1. TARIK DATA AWAL
  const fetchDataInitial = async () => {
    setIsFetching(true);
    try {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      
      const { data: qData } = await supabase.from('visits')
        .select(`*, customers(*), visit_items(qty, harga_saat_ini, products_services(nama_item, tipe))`)
        .eq('capster_id', user.id) 
        .gte('created_at', startOfDay.toISOString())
        .order('no_antrean', { ascending: true });
      
      if (qData) {
        setQueues(qData);
        if (activeVisit) {
          const updatedActive = qData.find(v => v.id === activeVisit.id);
          if (updatedActive) setActiveVisit(updatedActive);
        }
      }

      // 🔍 MENCARI PRODUK GROOMING
      const { data: pData } = await supabase.from('products_services')
        .select('nama_item')
        .ilike('tipe', 'product')
        .ilike('kategori', '%grooming%'); 
      
      if (pData) setHairProducts(pData);

    } catch (err) { console.error(err); } 
    finally { setIsFetching(false); }
  };

  useEffect(() => { 
    fetchDataInitial(); 
    const channelName = `capster-${user.id}-room`;
    const capsterSatelit = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `capster_id=eq.${user.id}` }, 
      () => { fetchDataInitial(); })
      .subscribe();
    return () => { capsterSatelit.unsubscribe().then(() => supabase.removeChannel(capsterSatelit)); };
  }, [user.id]);

  // TARIK INTEL PELANGGAN
  const fetchIntel = async (visit) => {
    try {
      const { count } = await supabase.from('visits')
        .select('*', {count: 'exact', head: true})
        .eq('customer_id', visit.customer_id)
        .ilike('status_transaksi', 'paid');
      setRepetisi(count || 0);

      const { data: hData } = await supabase.from('service_notes')
        .select('*').eq('customer_id', visit.customer_id).neq('visit_id', visit.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setHistoryData(hData || null);

      const { data: cData } = await supabase.from('service_notes')
        .select('*').eq('visit_id', visit.id).maybeSingle();
      
      setCurrentNote(cData || null);

      setCrmForm({ 
        final_style: cData?.final_style || '', 
        kondisi_rambut: cData?.kondisi_rambut || '', 
        rekomendasi_produk: cData?.rekomendasi_produk || visit.rekomendasi_produk || '', 
        catatan_obrolan: cData?.catatan_obrolan || '' 
      });

      setFotoPreviews({
        depan: cData?.foto_depan ? `https://oisxwukvwrhqvrwrkuhe.supabase.co/storage/v1/object/public/service_notes_photos/${cData.foto_depan}` : null,
        belakang: cData?.foto_belakang ? `https://oisxwukvwrhqvrwrkuhe.supabase.co/storage/v1/object/public/service_notes_photos/${cData.foto_belakang}` : null,
        kanan: cData?.foto_kanan ? `https://oisxwukvwrhqvrwrkuhe.supabase.co/storage/v1/object/public/service_notes_photos/${cData.foto_kanan}` : null,
        kiri: cData?.foto_kiri ? `https://oisxwukvwrhqvrwrkuhe.supabase.co/storage/v1/object/public/service_notes_photos/${cData.foto_kiri}` : null,
      });

    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    let interval;
    if (activeVisit && activeVisit.start_service) {
      interval = setInterval(() => {
        let st = activeVisit.start_service;
        if (!st.endsWith('Z') && !st.includes('+')) st += 'Z'; 
        let et = activeVisit.end_service;
        if (et && !et.endsWith('Z') && !et.includes('+')) et += 'Z';

        const start = new Date(st).getTime();
        const end = activeVisit.end_service ? new Date(et).getTime() : new Date().getTime();
        const diffSeconds = Math.floor((end - start) / 1000);
        setTimer(diffSeconds > 0 ? diffSeconds : 0);
      }, 1000);
    } else { setTimer(0); }
    return () => clearInterval(interval);
  }, [activeVisit]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const openCombatMode = (visit) => {
    setActiveVisit(visit);
    setActiveTab('info'); 
    
    setCustomerForm({
      pekerjaan: visit.customers?.pekerjaan || '', hobi: visit.customers?.hobi || '', karakter_konsumen: visit.customers?.karakter_konsumen || ''
    });
    setFotoFiles({ depan: null, belakang: null, kanan: null, kiri: null });
    
    fetchIntel(visit);
  };

  const handleMulaiCukur = async () => {
    try {
      const now = new Date().toISOString();
      await supabase.from('visits').update({ status_layanan: 'On Process', start_service: now }).eq('id', activeVisit.id);
      fetchDataInitial();
    } catch (err) { alert("Gagal mulai."); }
  };

  const handleAkhiriLayanan = async () => {
    try {
      const now = new Date().toISOString();
      await supabase.from('visits').update({ status_layanan: 'Done', end_service: now }).eq('id', activeVisit.id);
      fetchDataInitial();
      setActiveTab('form'); 
    } catch (err) { alert("Gagal akhiri layanan."); }
  };

  const handleSendSignal = async () => {
    if(!crmForm.rekomendasi_produk) return alert("Ketik atau pilih produk dulu Bos!");
    setIsSendingSignal(true);
    try {
      await supabase.from('visits').update({ rekomendasi_produk: crmForm.rekomendasi_produk }).eq('id', activeVisit.id);
      alert("✅ Sinyal Rekomendasi berhasil terkirim ke Kasir!");
    } catch (err) { alert("Gagal kirim sinyal."); }
    finally { setIsSendingSignal(false); }
  };

  const handleFotoChange = async (e, slotKey) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoPreviews(prev => ({ ...prev, [slotKey]: URL.createObjectURL(file) }));
    const options = { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true };
    try {
      const compressedFile = await imageCompression(file, options);
      setFotoFiles(prev => ({ ...prev, [slotKey]: compressedFile }));
    } catch (error) { console.log("Gagal kompres", error); }
  };

  const handleSimpanCRM = async (statusCrm) => {
    if (statusCrm === 'Final' && (!crmForm.final_style || !crmForm.kondisi_rambut)) {
      return alert("Model Rambut dan Kondisi wajib diisi buat Simpan Final!");
    }
    
    setIsSaving(true);
    try {
      const v = activeVisit;
      
      let st = v.start_service;
      if (st && !st.endsWith('Z') && !st.includes('+')) st += 'Z';
      let et = v.end_service;
      if (et && !et.endsWith('Z') && !et.includes('+')) et += 'Z';
      let durasiMenit = 0;
      if (st) {
        const end = et ? new Date(et) : new Date();
        durasiMenit = Math.round((end - new Date(st)) / 60000);
      }

      let fotoUrls = { 
        depan: currentNote?.foto_depan || null, 
        belakang: currentNote?.foto_belakang || null, 
        kanan: currentNote?.foto_kanan || null, 
        kiri: currentNote?.foto_kiri || null 
      };
      
      const uploadPromises = Object.entries(fotoFiles).map(async ([key, file]) => {
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${v.id}-${key}-${Date.now()}.${fileExt}`;
          const { data, error } = await supabase.storage.from('service_notes_photos').upload(fileName, file);
          if (!error) fotoUrls[key] = data.path; 
        }
      });
      await Promise.all(uploadPromises);

      await supabase.from('customers').update({
        pekerjaan: customerForm.pekerjaan, hobi: customerForm.hobi, karakter_konsumen: customerForm.karakter_konsumen
      }).eq('id', v.customer_id);

      // ✅ FIX BUG 400 BAD REQUEST: capster_id DIBUANG DARI SINI
      const notePayload = {
        visit_id: v.id, 
        customer_id: v.customer_id, 
        final_style: crmForm.final_style, 
        kondisi_rambut: crmForm.kondisi_rambut,
        rekomendasi_produk: crmForm.rekomendasi_produk, 
        catatan_obrolan: crmForm.catatan_obrolan,
        status_crm: statusCrm,
        foto_depan: fotoUrls.depan, 
        foto_belakang: fotoUrls.belakang, 
        foto_kanan: fotoUrls.kanan, 
        foto_kiri: fotoUrls.kiri
      };

      if (currentNote && currentNote.id) {
        await supabase.from('service_notes').update(notePayload).eq('id', currentNote.id);
      } else {
        await supabase.from('service_notes').insert([notePayload]);
      }

      const visitPayload = { rekomendasi_produk: crmForm.rekomendasi_produk };
      if (statusCrm === 'Final') {
        visitPayload.status_layanan = 'Done';
        visitPayload.durasi_layanan = durasiMenit;
      }
      await supabase.from('visits').update(visitPayload).eq('id', v.id);

      if(statusCrm === 'Final') {
        setShowSummary(false);
        setActiveVisit(null);
      } else {
        alert("✅ Draft Berhasil Disimpan!");
        fetchIntel(v); 
      }
      fetchDataInitial();

    } catch (err) { alert("Gagal menyimpan: " + err.message); } 
    finally { setIsSaving(false); }
  };

  const DataLists = () => (
    <>
      <datalist id="list-pekerjaan"><option value="Mahasiswa"/><option value="Pelajar"/><option value="PNS"/><option value="Karyawan Swasta"/><option value="Wiraswasta"/><option value="Polisi/TNI"/></datalist>
      <datalist id="list-hobi"><option value="Olahraga"/><option value="Otomotif"/><option value="Gaming"/><option value="Musik"/><option value="Traveling"/></datalist>
      <datalist id="list-karakter"><option value="Pendiam / Santai"/><option value="Suka Ngobrol"/><option value="Perfeksionis / Detail"/><option value="Buru-buru"/></datalist>
      <datalist id="list-style"><option value="French Crop"/><option value="Comma Hair"/><option value="Drop Fade"/><option value="Buzz Cut"/><option value="Mullet"/><option value="Undercut"/></datalist>
      <datalist id="list-kondisi"><option value="Normal / Sehat"/><option value="Kering / Ketombe"/><option value="Berminyak / Lepek"/><option value="Tipis / Rontok"/></datalist>
      <datalist id="list-produk">{hairProducts.map(p => <option key={p.nama_item} value={p.nama_item}/>)}</datalist>
    </>
  );

  if (activeVisit) {
    const isWaiting = activeVisit.status_layanan === 'Waiting';
    const isProcess = activeVisit.status_layanan === 'On Process';
    const isDone = activeVisit.status_layanan === 'Done';
    const isReadOnly = currentNote?.status_crm === 'Final';

    const displayName = `${activeVisit.customers?.inisial_panggilan || 'Kak'}. ${activeVisit.customers?.nama || 'UMUM'}`;
    const servicesTaken = activeVisit.visit_items
      ?.filter(it => getCleanType(it.products_services?.tipe) === 'service')
      ?.map(it => `${it.qty}x ${it.products_services?.nama_item}`).join(', ') || 'Hanya Layanan Umum';

    const kerjaAI = activeVisit.customers?.pekerjaan || 'Pelanggan';
    const hobiAI = activeVisit.customers?.hobi || 'hal seru';
    let teksAI = `Tamu lo ini seorang ${kerjaAI} yang suka ${hobiAI}. `;
    if (historyData?.catatan_obrolan) teksAI += `Terakhir ke sini dia ngomongin soal: "${historyData.catatan_obrolan}". Coba tanyain kelanjutannya buat mancing obrolan asik!`;
    else teksAI += `Ajak kenalan dan cari tau kesibukannya hari ini biar dia ngerasa nyaman.`;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white font-sans animate-in slide-in-from-right-full duration-300 pb-40">
        <DataLists />
        
        {/* HEADER TETAP */}
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <button onClick={() => setActiveVisit(null)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200"><ChevronLeft size={24}/></button>
            <div className="text-center flex-1 px-4">
              <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">{displayName}</h3>
              <div className="flex items-center justify-center gap-2">
                <span className="text-[9px] bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded uppercase font-black">{activeVisit.customers?.tier || 'Member'}</span>
              </div>
              <p className="text-[11px] font-bold text-slate-500 mt-3 flex items-center justify-center gap-1"><Scissors size={12}/> {servicesTaken}</p>
            </div>
            <div className="w-10"></div>
          </div>

          {isWaiting && !isReadOnly && (
            <SwipeOrClickButton onAction={handleMulaiCukur} text="MULAI LAYANAN" colorClass="bg-indigo-600" />
          )}
          
          {(isProcess || isDone) && (
            <div className="flex items-center gap-3">
              <div className={`w-1/3 bg-slate-100 dark:bg-slate-950 border ${isProcess ? 'border-indigo-500 shadow-inner' : 'border-slate-300 dark:border-slate-800'} rounded-2xl p-3 flex flex-col items-center justify-center transition-all`}>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">{isProcess ? <Clock size={10} className="animate-pulse text-indigo-500"/> : <CheckCircle2 size={10} className="text-emerald-500"/>} {isProcess ? 'Durasi' : 'Selesai'}</p>
                <p className={`text-xl font-black font-mono tracking-tighter leading-none ${isProcess ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{formatTime(timer)}</p>
              </div>
              <div className="flex-1">
                {isProcess && !isReadOnly ? (
                  <SwipeOrClickButton onAction={handleAkhiriLayanan} text="AKHIRI LAYANAN" colorClass="bg-rose-500" isDanger={true} />
                ) : (
                  <button onClick={() => setActiveTab('form')} className="w-full h-16 bg-slate-800 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                    {isReadOnly ? <Lock size={16}/> : <Edit3 size={16}/>} {isReadOnly ? 'Data Terkunci' : 'Lanjut Isi CRM'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl mt-6 border border-slate-200 dark:border-slate-800">
            <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'info' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-400'}`}>💡 Info & Histori</button>
            <button onClick={() => setActiveTab('form')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'form' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-400'}`}>📝 Input Data CRM</button>
          </div>
        </div>

        {/* TAB 1: INFO & HISTORI */}
        <div className="p-6">
          {activeTab === 'info' && (
            <div className="space-y-6 animate-in slide-in-from-left-4">
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><MapPin size={14}/> Informasi Dasar</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-[9px] font-bold text-slate-400 uppercase">Pekerjaan</p><p className="text-xs font-bold text-slate-800 dark:text-white mt-1 leading-tight">{activeVisit.customers?.pekerjaan || '-'}</p></div>
                  <div><p className="text-[9px] font-bold text-slate-400 uppercase">Hobi</p><p className="text-xs font-bold text-slate-800 dark:text-white mt-1">{activeVisit.customers?.hobi || '-'}</p></div>
                  <div><p className="text-[9px] font-bold text-slate-400 uppercase">Karakter</p><p className="text-xs font-bold text-slate-800 dark:text-white mt-1">{activeVisit.customers?.karakter_konsumen || '-'}</p></div>
                  <div><p className="text-[9px] font-bold text-slate-400 uppercase">Tgl Lahir</p><p className="text-xs font-bold text-slate-800 dark:text-white mt-1"><Calendar size={10} className="inline mr-1"/>{activeVisit.customers?.tanggal_lahir || '-'}</p></div>
                  <div className="col-span-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Alamat</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-white mt-1">{activeVisit.customers?.alamat || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/30 rounded-3xl p-5 relative overflow-hidden shadow-sm">
                <Sparkles className="absolute -right-4 -bottom-4 text-indigo-500/10" size={100}/>
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Intel Pelanggan (AI)</h4>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Total Kunjungan</p>
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{repetisi} Kali</p>
                  </div>
                </div>
                
                {historyData ? (
                  <div className="space-y-4 relative z-10">
                    <p className="text-[10px] font-bold text-slate-500 mb-2">Terakhir datang: <span className="font-black text-slate-700 dark:text-slate-300">{new Date(historyData.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</span></p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/60 dark:bg-slate-900/50 p-3 rounded-xl border border-indigo-100 dark:border-slate-800">
                        <span className="block text-[9px] font-black uppercase text-slate-400 mb-1">Final Style Terakhir</span>
                        <span className="font-black text-slate-800 dark:text-white">{historyData.final_style || '-'}</span>
                      </div>
                      <div className="bg-white/60 dark:bg-slate-900/50 p-3 rounded-xl border border-indigo-100 dark:border-slate-800">
                        <span className="block text-[9px] font-black uppercase text-slate-400 mb-1">Kondisi Rambut</span>
                        <span className="font-black text-slate-800 dark:text-white">{historyData.kondisi_rambut || '-'}</span>
                      </div>
                    </div>
                    
                    {historyData.catatan_obrolan && (
                      <div className="bg-white/60 dark:bg-slate-900/50 p-3 rounded-xl border border-indigo-100 dark:border-slate-800">
                        <span className="block text-[9px] font-black uppercase text-slate-400 mb-1">Catatan Obrolan Terakhir</span>
                        <span className="italic text-slate-600 dark:text-slate-400 text-xs">"{historyData.catatan_obrolan}"</span>
                      </div>
                    )}
                    
                    <div className="bg-emerald-100/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 rounded-xl mt-2">
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold leading-relaxed">
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">💡 AI Bahan Obrolan:</span> {teksAI}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-indigo-200 dark:border-indigo-500/30 mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                      {['foto_depan', 'foto_belakang', 'foto_kanan', 'foto_kiri'].map(col => {
                        if(historyData[col]) {
                          return (
                            <div key={col} className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                              <img src={`https://oisxwukvwrhqvrwrkuhe.supabase.co/storage/v1/object/public/service_notes_photos/${historyData[col]}`} className="w-full h-full object-cover" alt="Histori" onError={(e) => e.target.style.display='none'}/>
                            </div>
                          )
                        }
                        return null;
                      })}
                    </div>

                  </div>
                ) : (
                  <div className="bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 rounded-2xl text-amber-800 dark:text-amber-300 text-xs relative z-10 shadow-inner">
                    <p className="font-black flex items-center gap-2 mb-1"><AlertTriangle size={14}/> Pelanggan Baru!</p>
                    <p className="font-medium">Tamu ini belum punya rekam medis. Ajak kenalan, tanyain kesibukannya, dan bikin dia nyaman biar jadi pelanggan tetap.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INPUT DATA CRM */}
          {activeTab === 'form' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 relative">
              
              {isReadOnly ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 text-xs font-bold flex items-center gap-2 mb-4">
                  <Lock size={16}/> Data CRM hari ini sudah dikunci (Read-Only).
                </div>
              ) : (
                <div className="flex gap-3 mb-6">
                  <button onClick={() => handleSimpanCRM('Draft')} disabled={isSaving} className="flex-1 py-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-all">
                    Simpan Draft
                  </button>
                  <button onClick={() => setShowSummary(true)} disabled={isSaving} className="flex-[1.5] py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex justify-center items-center gap-2">
                    <Lock size={16}/> Kunci Final
                  </button>
                </div>
              )}

              <div className={`space-y-6 ${isReadOnly ? 'opacity-70 pointer-events-none' : ''}`}>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={14}/> Update Profil (Opsional)</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 block">Pekerjaan</label>
                      <input list="list-pekerjaan" placeholder="Pilih/Ketik..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-indigo-500 outline-none" value={customerForm.pekerjaan} onChange={e => setCustomerForm({...customerForm, pekerjaan: e.target.value})}/>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 block">Hobi / Minat</label>
                      <input list="list-hobi" placeholder="Pilih/Ketik..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-indigo-500 outline-none" value={customerForm.hobi} onChange={e => setCustomerForm({...customerForm, hobi: e.target.value})}/>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 block">Sifat / Karakter</label>
                      <input list="list-karakter" placeholder="Pilih/Ketik..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-indigo-500 outline-none" value={customerForm.karakter_konsumen} onChange={e => setCustomerForm({...customerForm, karakter_konsumen: e.target.value})}/>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText size={14}/> Rekam Medis Rambut (Wajib)</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 block">Final Style (Model)</label>
                      <input list="list-style" placeholder="Pilih/Ketik model..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-indigo-500 outline-none" value={crmForm.final_style} onChange={e => setCrmForm({...crmForm, final_style: e.target.value})}/>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 block">Kondisi Rambut / Kulit</label>
                      <input list="list-kondisi" placeholder="Pilih/Ketik kondisi..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-indigo-500 outline-none" value={crmForm.kondisi_rambut} onChange={e => setCrmForm({...crmForm, kondisi_rambut: e.target.value})}/>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-3xl p-5 shadow-sm">
                  <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Sparkles size={14}/> Sinyal Upselling & Obrolan</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-1 block">Rekomendasi Produk (Kirim ke FO)</label>
                      <div className="flex gap-2">
                        <input list="list-produk" placeholder="Pilih produk Grooming..." className="flex-1 w-full bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-emerald-500 outline-none" value={crmForm.rekomendasi_produk} onChange={e => setCrmForm({...crmForm, rekomendasi_produk: e.target.value})}/>
                        <button type="button" onClick={handleSendSignal} disabled={isSendingSignal} className="w-14 bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-lg active:scale-95">
                          {isSendingSignal ? <Loader2 size={18} className="animate-spin"/> : <Send size={18} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-1 block">Topik Obrolan Hari Ini</label>
                      <textarea placeholder="Tadi ngobrolin apa? Buat bahan obrolan kunjungan berikutnya..." className="w-full h-20 bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:border-emerald-500 outline-none" value={crmForm.catatan_obrolan} onChange={e => setCrmForm({...crmForm, catatan_obrolan: e.target.value})}></textarea>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Camera size={14}/> Dokumentasi Foto</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {[ { label: 'Depan', key: 'depan' }, { label: 'Belakang', key: 'belakang' }, { label: 'Kanan', key: 'kanan' }, { label: 'Kiri', key: 'kiri' } ].map((slot) => (
                      <label key={slot.key} className="aspect-[3/4] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors group shadow-inner overflow-hidden relative">
                        {fotoPreviews[slot.key] ? (
                          <img src={fotoPreviews[slot.key]} alt={slot.label} className="w-full h-full object-cover opacity-80" />
                        ) : (
                          <>
                            <ImageIcon size={20} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 mb-2"/>
                            <span className="text-[8px] font-black text-slate-400 uppercase">{slot.label}</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" disabled={isReadOnly} onChange={(e) => handleFotoChange(e, slot.key)} />
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* ✅ FIX UI: MODAL KONFIRMASI MENAMPILKAN SEMUA DATA */}
        {showSummary && (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden animate-in fade-in pb-10">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
               <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center">
                 <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32}/></div>
                 <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Kunci Permanen?</h3>
                 <p className="text-[10px] text-slate-500 font-bold mt-1">Pastikan seluruh data rekam medis sudah benar.</p>
               </div>
               
               <div className="p-6 space-y-2 max-h-[50vh] overflow-y-auto bg-white dark:bg-slate-900 no-scrollbar">
                  {/* REVIEW PROFIL */}
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 mb-1">Update Profil</h4>
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-800 py-1.5"><span className="text-xs font-bold text-slate-500">Pekerjaan</span><span className="text-xs font-black text-slate-800 dark:text-white text-right w-1/2 truncate">{customerForm.pekerjaan || '-'}</span></div>
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-800 py-1.5"><span className="text-xs font-bold text-slate-500">Hobi</span><span className="text-xs font-black text-slate-800 dark:text-white text-right w-1/2 truncate">{customerForm.hobi || '-'}</span></div>
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-800 py-1.5"><span className="text-xs font-bold text-slate-500">Karakter</span><span className="text-xs font-black text-slate-800 dark:text-white text-right w-1/2 truncate">{customerForm.karakter_konsumen || '-'}</span></div>

                  {/* REVIEW CRM RAMBUT */}
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-1">Rekam Medis (Wajib)</h4>
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-800 py-1.5"><span className="text-xs font-bold text-slate-500">Model</span><span className="text-xs font-black text-indigo-600 dark:text-indigo-400 text-right w-1/2 truncate">{crmForm.final_style || '-'}</span></div>
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-800 py-1.5"><span className="text-xs font-bold text-slate-500">Kondisi</span><span className="text-xs font-black text-slate-800 dark:text-white text-right w-1/2 truncate">{crmForm.kondisi_rambut || '-'}</span></div>
                  
                  {/* REVIEW CATATAN & PRODUK */}
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-1">Sinyal Obrolan</h4>
                  <div className="flex flex-col border-b border-slate-50 dark:border-slate-800 py-1.5"><span className="text-xs font-bold text-slate-500 mb-1">Rekomendasi Produk (FO)</span><span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{crmForm.rekomendasi_produk || '-'}</span></div>
                  <div className="flex flex-col border-b border-slate-50 dark:border-slate-800 py-1.5"><span className="text-xs font-bold text-slate-500 mb-1">Topik Obrolan</span><span className="text-xs font-medium italic text-slate-700 dark:text-slate-300">"{crmForm.catatan_obrolan || '-'}"</span></div>
               </div>

               <div className="p-4 grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                 <button onClick={() => setShowSummary(false)} className="py-4 font-black text-xs text-slate-500 uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-800 rounded-2xl transition-colors">Batal</button>
                 <button onClick={() => handleSimpanCRM('Final')} disabled={isSaving} className="py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                   {isSaving ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Kunci Final
                 </button>
               </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // =========================================================================
  // RENDER UI 2: RADAR ANTREAN (LIST MODE)
  // =========================================================================
  const onProcessQueues = queues.filter(q => q.status_layanan === 'On Process');
  const waitingQueues = queues.filter(q => q.status_layanan === 'Waiting');
  const doneQueues = queues.filter(q => q.status_layanan === 'Done');
  const paidQueues = doneQueues.filter(q => q.status_transaksi?.toLowerCase() === 'paid');
  
  let totalOmzet = 0;
  paidQueues.forEach(q => {
    q.visit_items?.forEach(item => { totalOmzet += ((item.qty || 1) * (item.harga_saat_ini || 0)); });
  });
  
  const komisiPersen = parseFloat(user.gaji_pokok) || 0; 
  const totalCuan = totalOmzet * (komisiPersen / 100);

  const QueueCard = ({ q, type }) => {
    let bgCol = type === 'process' ? 'bg-indigo-600 border-indigo-400 shadow-[0_10px_30px_rgba(79,70,229,0.3)]' : type === 'waiting' ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 opacity-80';
    let textTitle = type === 'process' ? 'text-white' : 'text-slate-800 dark:text-white';
    let textSub = type === 'process' ? 'text-indigo-200' : 'text-slate-400';
    let btnCol = type === 'process' ? 'bg-white text-indigo-600' : type === 'waiting' ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-slate-400 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400';

    return (
      <div onClick={() => openCombatMode(q)} className={`p-5 rounded-[2rem] border-2 flex justify-between items-center group cursor-pointer transition-all active:scale-95 ${bgCol}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className={`text-[10px] font-black uppercase tracking-widest ${textSub}`}>#{String(q.no_antrean).padStart(3,'0')}</p>
            {type === 'process' && <span className="bg-white text-indigo-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase animate-pulse shadow-sm">Sedang Dicukur</span>}
            {type === 'done' && <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] px-2 py-0.5 rounded uppercase font-black"><CheckCircle2 size={10} className="inline mr-1"/>Selesai</span>}
          </div>
          <h4 className={`text-xl font-black uppercase tracking-tight leading-none mb-1 ${textTitle}`}>{q.customers?.inisial_panggilan || 'Kak'}. {q.customers?.nama}</h4>
          <p className={`text-[10px] font-bold uppercase ${type === 'process' ? 'text-indigo-200' : 'text-amber-500'}`}>{q.customers?.tier || 'Member'}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm ${btnCol}`}>
          <ArrowRight size={20} strokeWidth={3}/>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-28 min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white font-sans animate-fade-in relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">Radar Antrean</h2>
          <p className="text-[10px] text-slate-500 font-black tracking-widest mt-1 uppercase flex items-center gap-1"><User size={12}/> {waitingQueues.length} Antrean Menunggu</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={fetchDataInitial} className="w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 shadow-sm active:scale-90 transition-all"><RefreshCw size={16} className={isFetching ? 'animate-spin' : ''}/></button>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/50 px-4 py-2 rounded-[1rem] text-right shadow-sm">
            <p className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Komisi {komisiPersen}%</p>
            <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 leading-none">Rp {totalCuan.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {onProcessQueues.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b-2 border-indigo-100 dark:border-indigo-900 pb-2"><Scissors size={14}/> Sedang Dieksekusi</h3>
            <div className="space-y-3">
              {onProcessQueues.map(q => <QueueCard key={q.id} q={q} type="process"/>)}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b-2 border-orange-100 dark:border-orange-900 pb-2"><Clock size={14}/> Menunggu Giliran ({waitingQueues.length})</h3>
          <div className="space-y-3">
             {waitingQueues.length === 0 ? (
               <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] bg-white dark:bg-slate-900/50">
                 <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Kursi Anda Kosong Bos.</p>
               </div>
             ) : (
               waitingQueues.map(q => <QueueCard key={q.id} q={q} type="waiting"/>)
             )}
          </div>
        </div>

        {doneQueues.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b-2 border-emerald-100 dark:border-emerald-900 pb-2"><History size={14}/> Selesai Hari Ini ({doneQueues.length})</h3>
            <div className="space-y-3">
              {doneQueues.map(q => <QueueCard key={q.id} q={q} type="done"/>)}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default WorkstationCapster;