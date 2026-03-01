import React, { useState, useEffect } from 'react';
import { 
  Ticket, Plus, Search, CheckCircle, XCircle, Edit, Trash2, 
  ToggleLeft, ToggleRight, Loader2, Target, Percent, DollarSign, Gift
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const PromoManager = ({ user }) => {
  const [promos, setPromos] = useState([]);
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State untuk Modal Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    nama_promo: '',
    syarat_poin: 0,
    tipe_sasaran: 'Global', // 'Global', 'Item', 'Suka_Suka'
    target_item_ids: [],
    jenis_potongan: 'Nominal', // 'Nominal', 'Persen', 'Gratis'
    nilai_potongan: 0,
    is_active: true
  });

  // 1. Ambil Data Promo & Services dari Database
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Ambil Promo
      const { data: promoData } = await supabase
        .from('promo_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (promoData) setPromos(promoData);

      // Ambil Services (Untuk pilihan promo spesifik item)
      const { data: serviceData } = await supabase
        .from('products_services')
        .select('id, nama_item, tipe, harga_jual')
        .eq('is_active', true)
        .order('nama_item', { ascending: true });
      if (serviceData) setServices(serviceData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Handler Toggle Aktif/Non-Aktif
  const handleToggleActive = async (id, currentStatus) => {
    try {
      await supabase.from('promo_campaigns').update({ is_active: !currentStatus }).eq('id', id);
      fetchData(); // Refresh data
    } catch (error) {
      alert("Gagal merubah status promo!");
    }
  };

  // 3. Handler Hapus Promo
  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus promo ini permanen? (Saran: Lebih baik di-Nonaktifkan saja jika untuk histori)")) return;
    try {
      await supabase.from('promo_campaigns').delete().eq('id', id);
      fetchData();
    } catch (error) {
      alert("Gagal menghapus! Promo ini mungkin sudah pernah dipakai di transaksi.");
    }
  };

  // 4. Handler Simpan Promo Baru
  const handleSavePromo = async () => {
    if (!formData.nama_promo) return alert("Nama promo wajib diisi!");
    if (formData.tipe_sasaran === 'Item' && formData.target_item_ids.length === 0) return alert("Pilih minimal 1 produk/layanan target!");

    setIsSaving(true);
    try {
      // Penyesuaian data sebelum dikirim (Safety Net)
      let finalJenis = formData.jenis_potongan;
      let finalNilai = formData.nilai_potongan;

      if (formData.tipe_sasaran === 'Suka_Suka') {
        finalJenis = 'Nominal'; // Default aman untuk database
        finalNilai = 0; 
      } else if (formData.jenis_potongan === 'Gratis') {
        finalNilai = 0;
      }

      await supabase.from('promo_campaigns').insert([{
        nama_promo: formData.nama_promo,
        syarat_poin: parseInt(formData.syarat_poin) || 0,
        tipe_sasaran: formData.tipe_sasaran,
        target_item_ids: formData.tipe_sasaran === 'Item' ? formData.target_item_ids : [],
        jenis_potongan: finalJenis,
        nilai_potongan: parseFloat(finalNilai) || 0,
        is_active: formData.is_active
      }]);

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert("Gagal menyimpan promo: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nama_promo: '', syarat_poin: 0, tipe_sasaran: 'Global', 
      target_item_ids: [], jenis_potongan: 'Nominal', nilai_potongan: 0, is_active: true
    });
  };

  const filteredPromos = promos.filter(p => p.nama_promo.toLowerCase().includes(searchQuery.toLowerCase()));
  const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="flex-1 h-full bg-slate-50 p-8 overflow-hidden flex flex-col font-sans">
      
      {/* HEADER MANAGER */}
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <Ticket className="text-indigo-600" size={32}/> Manajemen Promo
          </h2>
          <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">Pusat Kendali Strategi Marketing</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30">
          <Plus size={20} strokeWidth={3}/> Bikin Promo Baru
        </button>
      </div>

      {/* TOOLBAR (SEARCH) */}
      <div className="mb-6 flex gap-4 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
          <input 
            type="text" 
            placeholder="Cari nama promo..." 
            className="w-full py-3.5 pl-12 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* LIST PROMO (TABLE/CARDS) */}
      <div className="flex-1 overflow-y-auto no-scrollbar bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-indigo-500"/>
            <p className="font-bold">Memuat Data Promo...</p>
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Ticket size={64} className="mb-4 opacity-20"/>
            <p className="font-bold text-lg">Belum Ada Promo Aktif</p>
            <p className="text-sm">Klik tombol "Bikin Promo Baru" untuk memulai.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4">
            {filteredPromos.map(promo => (
              <div key={promo.id} className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${promo.is_active ? 'bg-white border-slate-100 hover:border-indigo-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                
                {/* INFO KIRI */}
                <div className="flex items-center gap-5 flex-1">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-sm ${promo.is_active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                    <Ticket size={28} strokeWidth={2.5}/>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-lg font-black text-slate-800">{promo.nama_promo}</h4>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest ${promo.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                        {promo.is_active ? 'Aktif' : 'Mati'}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs font-bold text-slate-500">
                      <span className="flex items-center gap-1"><Target size={14}/> Sasaran: {promo.tipe_sasaran.replace('_', ' ')}</span>
                      {promo.tipe_sasaran !== 'Suka_Suka' && (
                        <span className="flex items-center gap-1">
                          {promo.jenis_potongan === 'Nominal' ? <DollarSign size={14}/> : promo.jenis_potongan === 'Persen' ? <Percent size={14}/> : <Gift size={14}/>} 
                          Potongan: {promo.jenis_potongan === 'Nominal' ? formatIDR(promo.nilai_potongan) : promo.jenis_potongan === 'Persen' ? `${promo.nilai_potongan}%` : 'GRATIS'}
                        </span>
                      )}
                      {promo.syarat_poin > 0 && <span className="text-amber-500 bg-amber-50 px-2 rounded">Tukar: {promo.syarat_poin} Poin</span>}
                    </div>
                  </div>
                </div>

                {/* AKSI KANAN */}
                <div className="flex items-center gap-3">
                  <button onClick={() => handleToggleActive(promo.id, promo.is_active)} className={`p-2 rounded-xl transition-colors ${promo.is_active ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-500 hover:bg-emerald-50'}`} title={promo.is_active ? 'Matikan Promo' : 'Aktifkan Promo'}>
                    {promo.is_active ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}
                  </button>
                  <button onClick={() => handleDelete(promo.id)} className="p-2.5 bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white rounded-xl transition-colors" title="Hapus Promo">
                    <Trash2 size={20}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL FORM TAMBAH PROMO */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* HEADER MODAL */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2"><Ticket className="text-indigo-600"/> Racik Promo Baru</h3>
              <button onClick={() => {setIsModalOpen(false); resetForm();}} className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-white rounded-full border border-slate-200 shadow-sm"><XCircle size={24}/></button>
            </div>

            {/* BODY FORM */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white">
              
              {/* NAMA & POIN */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nama Program / Promo</label>
                  <input type="text" placeholder="Cth: Merdeka Sale, Tukar 50 Poin..." className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-600 focus:bg-white transition-colors" value={formData.nama_promo} onChange={(e) => setFormData({...formData, nama_promo: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Syarat Poin</label>
                  <input type="number" min="0" placeholder="0" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-600 focus:bg-white transition-colors" value={formData.syarat_poin} onChange={(e) => setFormData({...formData, syarat_poin: e.target.value})} />
                  <p className="text-[9px] font-bold text-slate-400 mt-1">Isi 0 jika tanpa poin.</p>
                </div>
              </div>

              {/* TIPE SASARAN */}
              <div className="p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Tipe Sasaran Promo</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Global', 'Item', 'Suka_Suka'].map(tipe => (
                    <button key={tipe} onClick={() => setFormData({...formData, tipe_sasaran: tipe})} className={`py-3 rounded-xl border-2 font-black text-xs uppercase transition-all ${formData.tipe_sasaran === tipe ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                      {tipe.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                {formData.tipe_sasaran === 'Global' && <p className="text-xs font-semibold text-slate-500 mt-3 text-center">✅ Memotong dari Total Seluruh Tagihan.</p>}
                {formData.tipe_sasaran === 'Suka_Suka' && <p className="text-xs font-semibold text-amber-600 mt-3 text-center">⚠️ Bahaya: Pelanggan bayar bebas. Gunakan untuk event khusus.</p>}
              </div>

              {/* JIKA ITEM SPESIFIK: Munculkan Checkbox Pilihan Menu */}
              {formData.tipe_sasaran === 'Item' && (
                <div className="p-5 bg-indigo-50 border-2 border-indigo-100 rounded-2xl animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-3">Pilih Target Layanan/Produk (Bisa Lebih Dari 1)</label>
                  <div className="max-h-40 overflow-y-auto bg-white border border-indigo-100 rounded-xl p-2 space-y-1">
                    {services.map(svc => {
                      const isSelected = formData.target_item_ids.includes(svc.id);
                      return (
                        <label key={svc.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-600 font-medium'}`}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 accent-indigo-600"
                            checked={isSelected}
                            onChange={(e) => {
                              if(e.target.checked) {
                                setFormData({...formData, target_item_ids: [...formData.target_item_ids, svc.id]});
                              } else {
                                setFormData({...formData, target_item_ids: formData.target_item_ids.filter(id => id !== svc.id)});
                              }
                            }}
                          />
                          <span className="flex-1">{svc.nama_item}</span>
                          <span className="text-xs opacity-70 bg-white px-2 py-0.5 rounded shadow-sm">{svc.tipe}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BENTUK POTONGAN (Sembunyikan jika Suka-Suka) */}
              {formData.tipe_sasaran !== 'Suka_Suka' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Bentuk Potongan</label>
                    <select className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-600 transition-colors" value={formData.jenis_potongan} onChange={(e) => setFormData({...formData, jenis_potongan: e.target.value})}>
                      <option value="Nominal">Potongan Rupiah (Rp)</option>
                      <option value="Persen">Potongan Persen (%)</option>
                      <option value="Gratis">100% GRATIS</option>
                    </select>
                  </div>
                  
                  {formData.jenis_potongan !== 'Gratis' && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                        {formData.jenis_potongan === 'Nominal' ? 'Nominal Rupiah (Rp)' : 'Persentase (%)'}
                      </label>
                      <input 
                        type="number" 
                        placeholder="Cth: 15000 atau 15" 
                        className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-600 transition-colors" 
                        value={formData.nilai_potongan} 
                        onChange={(e) => setFormData({...formData, nilai_potongan: e.target.value})} 
                      />
                    </div>
                  )}
                </div>
              )}
              
            </div>

            {/* FOOTER MODAL (TOMBOL SIMPAN) */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
              <button disabled={isSaving} onClick={handleSavePromo} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-300 text-white rounded-2xl font-black uppercase text-base shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all">
                {isSaving ? <Loader2 className="animate-spin" size={24}/> : <CheckCircle size={24}/>} 
                Simpan Promo & Aktifkan
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default PromoManager;