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

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isModalOpen]);

  useEffect(() => {
    if (isModalOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isModalOpen]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products_services')
        .select('*')
        .eq('tipe', 'Service')
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
    <div className="space-y-6 px-1 md:px-2 animate-in fade-in duration-300 min-h-[100dvh]">
      
      {/* HEADER TAB */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200/80 pb-5 gap-4 mt-2">
         <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
               <div className="p-2.5 bg-sky-50 rounded-2xl text-sky-500 border border-sky-100/50">
                 <Scissors size={22} strokeWidth={1.5}/>
               </div>
               Katalog Layanan
            </h2>
            <p className="text-[14px] font-medium text-slate-500 mt-1.5 md:ml-[54px]">Master data jasa dan durasi pengerjaan</p>
         </div>
        <button 
          onClick={() => { 
            setMode('add'); 
            setFormData({ id: null, nama_item: '', tipe: 'Service', kategori: 'Haircut', harga_jual: 0, durasi_menit: 30, is_active: true }); 
            setIsModalOpen(true); 
          }} 
          className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl font-semibold text-[14px] shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 active:scale-95 focus:outline-none"
          aria-label="Tambah Layanan"
        >
          <Plus size={18} strokeWidth={1.5}/> Tambah Layanan
        </button>
      </div>

      {/* LIST KARTU LAYANAN */}
      {isLoading ? (
        <div className="text-center p-12 text-slate-400 animate-pulse font-medium flex flex-col items-center">
          <Loader2 size={32} strokeWidth={1.5} className="animate-spin mb-3 text-sky-400"/>
          Memuat layanan...
        </div>
      ) : servicesList.length === 0 ? (
        <div className="text-center p-16 border border-dashed border-slate-300 bg-slate-50/50 rounded-3xl text-slate-500 font-medium flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
            <Scissors size={28} strokeWidth={1.5} className="text-slate-400"/>
          </div>
          Belum ada layanan yang didaftarkan.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
           {servicesList.map(item => (
              <div 
                key={item.id} 
                onClick={() => { setMode('edit'); setFormData(item); setIsModalOpen(true); }} 
                role="button"
                tabIndex={0}
                aria-label={`Edit Layanan ${item.nama_item}`}
                onKeyDown={e => { if (e.key === 'Enter') { setMode('edit'); setFormData(item); setIsModalOpen(true); } }}
                className={`bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-200/60 flex items-center justify-between gap-3 transition-all hover:border-sky-300 hover:shadow-md cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${!item.is_active ? 'opacity-60 grayscale-[40%] bg-slate-50' : ''}`}
              >
                <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 border ${item.is_active ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    <Scissors size={24} strokeWidth={1.5}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-bold text-[14px] md:text-[15px] truncate ${item.is_active ? 'text-slate-900' : 'text-slate-500 line-through'}`}>{item.nama_item}</h3>
                    <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                      <span className="text-[11px] md:text-[12px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full truncate">Rp {Number(item.harga_jual).toLocaleString('id-ID')}</span>
                      <span className="text-[11px] md:text-[12px] font-semibold text-sky-600 flex items-center gap-1.5 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-full shrink-0"><Clock size={12} strokeWidth={1.5}/> {item.durasi_menit} mnt</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToggleStatus(item.id, item.is_active); }} 
                  className="text-slate-400 hover:text-sky-600 transition-colors focus:outline-none shrink-0 ml-1"
                  aria-label={item.is_active ? `Nonaktifkan ${item.nama_item}` : `Aktifkan ${item.nama_item}`}
                >
                  {item.is_active ? <ToggleRight size={32} strokeWidth={1.5} className="text-emerald-500" /> : <ToggleLeft size={32} strokeWidth={1.5} />}
                </button>
              </div>
           ))}
        </div>
      )}

      {/* MODAL FORM LAYANAN */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div
            ref={modalRef}
            className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
            tabIndex={0}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="font-extrabold text-slate-900 text-lg tracking-tight flex items-center gap-2">
                 <Scissors size={20} strokeWidth={1.5} className="text-sky-500"/> 
                 {mode === 'add' ? `Tambah Jasa Baru` : `Edit Jasa`}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors focus:outline-none"
                aria-label="Tutup modal"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 bg-slate-50/50">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nama Layanan</label>
                <input 
                  required 
                  value={formData.nama_item || ''} 
                  onChange={(e) => setFormData({...formData, nama_item: e.target.value})} 
                  className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium text-slate-900 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 transition-all" 
                  placeholder="Misal: Haircut Premium..." 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Harga Jual (Rp)</label>
                  <input 
                    type="number" 
                    required 
                    value={formData.harga_jual || ''} 
                    onChange={(e) => setFormData({...formData, harga_jual: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 transition-all" 
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Kategori</label>
                  <select 
                    value={formData.kategori || 'Haircut'} 
                    onChange={(e) => setFormData({...formData, kategori: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-medium text-slate-900 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 transition-all appearance-none"
                  >
                    <option value="Haircut">Haircut / Cukur</option>
                    <option value="Treatment">Treatment / Perawatan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Estimasi Durasi (Menit)</label>
                <input 
                  type="number" 
                  required 
                  value={formData.durasi_menit || ''} 
                  onChange={(e) => setFormData({...formData, durasi_menit: e.target.value})} 
                  className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-[15px] font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50 transition-all" 
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white py-4 rounded-2xl font-bold text-[15px] shadow-md shadow-slate-900/10 active:scale-[0.98] transition-all flex justify-center items-center gap-2 focus:outline-none"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} strokeWidth={1.5}/> : 'Simpan Layanan'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}