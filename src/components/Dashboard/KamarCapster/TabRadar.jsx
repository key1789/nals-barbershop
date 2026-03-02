import React, { useState, useEffect } from 'react';
import { User, Scissors, Clock, History, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../supabaseClient'; 

export default function TabRadar({ user, onSelectTamu }) {
  const [queues, setQueues] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  const fetchAntreanHariIni = async () => {
    setIsFetching(true);
    try {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('visits')
        .select(`*, customers(*), visit_items(*, products_services(nama_item, tipe))`)
        .eq('capster_id', user.id) 
        .gte('created_at', startOfDay.toISOString())
        .order('no_antrean', { ascending: true });
      
      if (error) throw error;
      if (data) setQueues(data);
    } catch (err) { console.error("Gagal narik antrean:", err); } finally { setIsFetching(false); }
  };

  useEffect(() => {
    fetchAntreanHariIni(); 
    const channelName = `capster-${user.id}-radar`;
    const radarSatelit = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `capster_id=eq.${user.id}` }, () => fetchAntreanHariIni())
      .subscribe();
    return () => { supabase.removeChannel(radarSatelit); };
  }, [user.id]);

  const onProcessQueues = queues.filter(q => q.status_layanan === 'On Process');
  const waitingQueues = queues.filter(q => q.status_layanan === 'Waiting');
  const doneQueues = queues.filter(q => q.status_layanan === 'Done');
  const paidQueues = doneQueues.filter(q => q.status_transaksi?.toLowerCase() === 'paid');
  
  let totalOmzet = 0;
  paidQueues.forEach(q => { q.visit_items?.forEach(item => { totalOmzet += ((item.qty || 1) * (item.harga_saat_ini || 0)); }); });
  
  const komisiPersen = parseFloat(user.gaji_pokok) || 0; 
  const totalCuan = totalOmzet * (komisiPersen / 100);

  const isCapsterSibuk = onProcessQueues.length > 0;

  const handlePilihTamu = (q, type) => {
    if (type === 'waiting' && isCapsterSibuk) { alert("🛑 Selesaikan dulu antrean yang sedang dieksekusi Bos!"); return; }
    if (typeof onSelectTamu === 'function') onSelectTamu(q);
    else alert("Ups! Kabel navigasi ke Combat Lounge belum disambung Bos.");
  };

  const QueueCard = ({ q, type }) => {
    let bgCol = type === 'process' ? 'bg-indigo-600 border-indigo-500 shadow-[0_8px_20px_rgba(79,70,229,0.25)]' : type === 'waiting' ? 'bg-white border-gray-100 hover:border-indigo-200 shadow-[0_4px_15px_rgb(0,0,0,0.03)]' : 'bg-gray-50 border-gray-100 opacity-70';
    let textTitle = type === 'process' ? 'text-white' : 'text-gray-900';
    let textSub = type === 'process' ? 'text-indigo-200' : 'text-gray-500';

    return (
      <div onClick={() => handlePilihTamu(q, type)} className={`p-5 rounded-[2rem] border-2 flex justify-between items-center cursor-pointer transition-all active:scale-95 ${bgCol}`}>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <p className={`text-[10px] font-black uppercase tracking-widest ${textSub}`}>#{String(q.no_antrean).padStart(3,'0')}</p>
            {type === 'process' && <span className="bg-white text-indigo-600 text-[9px] px-2 py-0.5 rounded-full font-black uppercase shadow-sm">Eksekusi</span>}
            {type === 'done' && <span className="bg-green-100 text-green-600 border border-green-200 text-[9px] px-2 py-0.5 rounded-md uppercase font-black"><CheckCircle2 size={10} className="inline mr-1"/>Selesai</span>}
          </div>
          <h4 className={`text-xl font-black uppercase tracking-tight leading-none mb-1 ${textTitle}`}>{q.customers?.inisial_panggilan || 'Kak'}. {q.customers?.nama || 'UMUM'}</h4>
          <p className={`text-[10px] font-bold uppercase ${type === 'process' ? 'text-indigo-200' : 'text-amber-500'}`}>{q.customers?.tier || 'Member'}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm ${type === 'process' ? 'bg-white text-indigo-600' : (isCapsterSibuk && type === 'waiting') ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'}`}>
          <ArrowRight size={20} strokeWidth={2.5}/>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-28 text-gray-900 animate-in fade-in duration-300 font-sans">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">Radar</h2>
          <p className="text-[10px] text-gray-500 font-bold tracking-widest mt-1 uppercase flex items-center gap-1"><User size={12}/> {waitingQueues.length} Menunggu</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={fetchAntreanHariIni} className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 active:scale-90 transition-all shadow-sm"><RefreshCw size={16} className={isFetching ? 'animate-spin' : ''}/></button>
          <div className="bg-green-50 border border-green-100 px-4 py-2 rounded-[1rem] text-right">
            <p className="text-[8px] font-black text-green-600 uppercase tracking-widest mb-0.5">Komisi ({komisiPersen}%)</p>
            <p className="text-sm font-black text-green-700 leading-none">Rp {totalCuan.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {onProcessQueues.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b-2 border-indigo-100 pb-2"><Scissors size={14}/> Sedang Dieksekusi</h3>
            <div className="space-y-3">{onProcessQueues.map(q => <QueueCard key={q.id} q={q} type="process"/>)}</div>
          </div>
        )}

        <div>
          <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b-2 border-orange-100 pb-2"><Clock size={14}/> Antrean ({waitingQueues.length})</h3>
          <div className="space-y-3">
             {waitingQueues.length === 0 ? (
               <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-[2rem] bg-gray-50"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Kursi Anda Kosong Bos.</p></div>
             ) : ( waitingQueues.map(q => <QueueCard key={q.id} q={q} type="waiting"/>) )}
          </div>
        </div>

        {doneQueues.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b-2 border-green-100 pb-2"><History size={14}/> Selesai Hari Ini</h3>
            <div className="space-y-3">{doneQueues.map(q => <QueueCard key={q.id} q={q} type="done"/>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}