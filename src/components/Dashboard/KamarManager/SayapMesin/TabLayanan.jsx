import React, { useState, useEffect, useRef } from 'react';
import { Scissors, Plus, Clock, ToggleRight, ToggleLeft, X, Loader2 } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';

export default function TabLayanan({ user }) {
  const [servicesList, setServicesList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState('add');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef(null);
  const [formData, setFormData] = useState({ 
    id: null, nama_item: '', tipe: 'Service', kategori: 'Haircut', 
    harga_jual: 0, durasi_menit: 30, is_active: true 
  });
  // Lock scroll saat modal terbuka
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // ESC untuk tutup modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isModalOpen]);

  // Fokus ke modal saat buka
  useEffect(() => {
    if (isModalOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isModalOpen]);

  // ==========================================
  // FUNGSI TARIK DATA (KHUSUS LAYANAN)
  // ==========================================
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products_services')
        .select('*')
        .eq('tipe', 'Service') // Cuma narik yang tipenya jasa/service
        .order('nama_item', { ascending: true });
        
      if (error) throw error;
      setServicesList(data || []);
    } catch (error) {
      console.error("Gagal narik data layanan:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ==========================================
  // FUNGSI HANDLER FORM
  // ==========================================
  const handleToggleStatus = async (id, currentStatus) => { 
    try { 
      await supabase.from('products_services').update({ is_active: !currentStatus }).eq('id', id); 
      fetchData(); 
    } catch (error) {
      alert("Gagal update status!");
    } 
  };

  const handleSave = async (e) => {
    e.preventDefault(); 
    setIsSaving(true);
    try {
      const payload = { 
        nama_item: formData.nama_item, 
        tipe: 'Service', 
        kategori: formData.kategori, 
        harga_jual: formData.harga_jual, 
        durasi_menit: formData.durasi_menit,
        is_active: formData.is_active 
      };

      if (mode === 'add') { 
        await supabase.from('products_services').insert([payload]); 
      } else { 
        await supabase.from('products_services').update(payload).eq('id', formData.id); 
      }
      setIsModalOpen(false); 
      fetchData();
    } catch (error) { 
      alert("Gagal menyimpan layanan: " + error.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 min-h-[100dvh]">
      
      {/* HEADER TAB */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
         <div>
            <h2 className="font-black text-slate-800 text-lg flex items-center gap-2">
               <Scissors className="text-sky-500"/> Katalog Jasa Cukur
            </h2>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Master data layanan & harga</p>
         </div>
        <button 
          onClick={() => { 
            setMode('add'); 
            setFormData({ id: null, nama_item: '', tipe: 'Service', kategori: 'Haircut', harga_jual: 0, durasi_menit: 30, is_active: true }); 
            setIsModalOpen(true); 
          }} 
          className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-400"
          aria-label="Tambah Layanan"
        >
          <Plus size={18} /> Tambah Layanan
        </button>
      </div>

      {/* LIST KARTU LAYANAN */}
      {isLoading ? (
        <div className="text-center p-8 text-slate-400 animate-pulse font-bold">Memuat layanan...</div>
      ) : servicesList.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-sm">Belum ada layanan yang didaftarkan.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
           {servicesList.map(item => (
              <div 
                key={item.id} 
                onClick={() => { setMode('edit'); setFormData(item); setIsModalOpen(true); }} 
                role="button"
                tabIndex={0}
                aria-label={`Edit Layanan ${item.nama_item}`}
                onKeyDown={e => { if (e.key === 'Enter') { setMode('edit'); setFormData(item); setIsModalOpen(true); } }}
                className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between transition-all hover:border-sky-300 hover:shadow-md cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${!item.is_active ? 'opacity-50 grayscale-[50%] bg-slate-50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-inner ${item.is_active ? 'bg-sky-500' : 'bg-slate-300'}`}>
                    <Scissors size={24}/>
                  </div>
                  <div>
                    <h3 className={`font-bold ${item.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{item.nama_item}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Rp {Number(item.harga_jual).toLocaleString('id-ID')}</span>
                      <span className="text-xs font-semibold text-sky-600 flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-md"><Clock size={12}/> {item.durasi_menit} mnt</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToggleStatus(item.id, item.is_active); }} 
                  className="text-slate-400 hover:text-sky-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
                  aria-label={item.is_active ? `Nonaktifkan ${item.nama_item}` : `Aktifkan ${item.nama_item}`}
                >
                  {item.is_active ? <ToggleRight size={36} className="text-emerald-500" /> : <ToggleLeft size={36} />}
                </button>
              </div>
           ))}
        </div>
      )}

      {/* =========================================
          MODAL FORM LAYANAN
          ========================================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div
            ref={modalRef}
            className="bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
            tabIndex={0}
          >
            <div className="p-5 border-b flex justify-between items-center bg-sky-50 border-sky-100">
              <h2 className="font-black text-sky-900 flex items-center gap-2">
                 <Scissors size={20} className="text-sky-600"/> 
                 {mode === 'add' ? `Tambah Jasa Baru` : `Edit Jasa`}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1 hover:bg-white rounded-full text-sky-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
                aria-label="Tutup modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Layanan</label>
                <input 
                  required 
                  value={formData.nama_item} 
                  onChange={(e) => setFormData({...formData, nama_item: e.target.value})} 
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-300 transition-colors" 
                  placeholder="Misal: Haircut Premium..." 
                  aria-label="Nama Layanan"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga Jual (Rp)</label>
                  <input 
                    type="number" 
                    required 
                    value={formData.harga_jual} 
                    onChange={(e) => setFormData({...formData, harga_jual: e.target.value})} 
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-300 transition-colors" 
                    aria-label="Harga Jual"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                  <select 
                    value={formData.kategori} 
                    onChange={(e) => setFormData({...formData, kategori: e.target.value})} 
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-300 transition-colors"
                    aria-label="Kategori"
                  >
                    <option value="Haircut">Haircut / Cukur</option>
                    <option value="Treatment">Treatment / Perawatan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estimasi Durasi Pengerjaan (Menit)</label>
                <input 
                  type="number" 
                  required 
                  value={formData.durasi_menit} 
                  onChange={(e) => setFormData({...formData, durasi_menit: e.target.value})} 
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-300 transition-colors" 
                  aria-label="Durasi (menit)"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSaving} 
                className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 text-white py-3.5 rounded-xl font-black mt-4 shadow-lg shadow-sky-200 active:scale-95 transition-all flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                aria-label="Simpan Layanan"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20}/> : 'Simpan Layanan'}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}