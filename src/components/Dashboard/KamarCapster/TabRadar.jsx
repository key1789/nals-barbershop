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
        // PERBAIKAN: Tarik semua data customer & products_services
        .select(`
          *, 
          customers(*), 
          visit_items(*, products_services(nama_item, tipe))
        `)
        .eq('capster_id', user.id) 
        .gte('created_at', startOfDay.toISOString())
        .order('no_antrean', { ascending: true });
      
      if (error) throw error;
      if (data) setQueues(data);
    } catch (err) {
      console.error("Gagal narik antrean:", err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchAntreanHariIni(); 
    const channelName = `capster-${user.id}-radar`;
    const radarSatelit = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `capster_id=eq.${user.id}` }, 
        () => fetchAntreanHariIni() 
      ).subscribe();
    return () => { supabase.removeChannel(radarSatelit); };
  }, [user.id]);

  const onProcessQueues = queues.filter(q => q.status_layanan === 'On Process');
  const waitingQueues = queues.filter(q => q.status_layanan === 'Waiting');
  const doneQueues = queues.filter(q => q.status_layanan === 'Done');
  const paidQueues = doneQueues.filter(q => q.status_transaksi?.toLowerCase() === 'paid');
  
  let totalOmzet = 0;
  paidQueues.forEach(q => {
    q.visit_items?.forEach(item => { totalOmzet += ((item.qty || 1) * (item.harga_saat_ini || 0)); });
  });
  
  // PERBAIKAN: Komisi ambil dari gaji_pokok user
  const komisiPersen = parseFloat(user.gaji_pokok) || 0; 
  const totalCuan = totalOmzet * (komisiPersen / 100);

  // LOGIKA ANTI DOUBLE-PROCESS
  const isCapsterSibuk = onProcessQueues.length > 0;

  const handlePilihTamu = (q, type) => {
    if (type === 'waiting' && isCapsterSibuk) {
      alert("🛑 Selesaikan dulu antrean yang sedang dieksekusi Bos!");
      return;
    }
    onSelectTamu(q);
  };

  const QueueCard = ({ q, type }) => {
    let bgCol = type === 'process' ? 'bg-indigo-600 border-indigo-400 shadow-[0_10px_30px_rgba(79,70,229,0.3)]' : type === 'waiting' ? 'bg-slate-900 border-slate-800 hover:border-indigo-500 shadow-sm' : 'bg-slate-950 border-slate-800 opacity-60';
    let textTitle = type === 'process' ? 'text-white' : 'text-slate-100';
    let textSub = type === 'process' ? 'text-indigo-200' : 'text-slate-500';

    return (
      <div onClick={() => handlePilihTamu(q, type)} className={`p-5 rounded-[2rem] border-2 flex justify-between items-center cursor-pointer transition-all active:scale-95 ${bgCol}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className={`text-[10px] font-black uppercase tracking-widest ${textSub}`}>#{String(q.no_antrean).padStart(3,'0')}</p>
            {type === 'process' && <span className="bg-white text-indigo-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase animate-pulse shadow-sm">Dieksekusi</span>}
            {type === 'done' && <span className="bg-emerald-900/50 text-emerald-400 border border-emerald-800 text-[8px] px-2 py-0.5 rounded uppercase font-black"><CheckCircle2 size={10} className="inline mr-1"/>Selesai</span>}
          </div>
          <h4 className={`text-xl font-black uppercase tracking-tight leading-none mb-1 ${textTitle}`}>{q.customers?.inisial_panggilan || 'Kak'}. {q.customers?.nama || 'UMUM'}</h4>
          <p className={`text-[10px] font-bold uppercase ${type === 'process' ? 'text-indigo-200' : 'text-amber-500'}`}>{q.customers?.tier || 'Member'}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm ${type === 'process' ? 'bg-white text-indigo-600' : (isCapsterSibuk && type === 'waiting') ? 'bg-slate-800 text-slate-600 opacity-50' : 'bg-slate-800 text-slate-400'}`}>
          <ArrowRight size={20} strokeWidth={3}/>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-28 text-slate-100 animate-in fade-in duration-300">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Radar</h2>
          <p className="text-[10px] text-slate-500 font-black tracking-widest mt-1 uppercase flex items-center gap-1"><User size={12}/> {waitingQueues.length} Menunggu</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={fetchAntreanHariIni} className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-400 active:scale-90 transition-all"><RefreshCw size={16} className={isFetching ? 'animate-spin' : ''}/></button>
          <div className="bg-emerald-900/20 border border-emerald-500/50 px-4 py-2 rounded-[1rem] text-right">
            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Komisi ({komisiPersen}%)</p>
            <p className="text-sm font-black text-emerald-300 leading-none">Rp {totalCuan.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {onProcessQueues.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b-2 border-indigo-900 pb-2"><Scissors size={14}/> Sedang Dieksekusi</h3>
            <div className="space-y-3">{onProcessQueues.map(q => <QueueCard key={q.id} q={q} type="process"/>)}</div>
          </div>
        )}

        <div>
          <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b-2 border-orange-900 pb-2"><Clock size={14}/> Antrean ({waitingQueues.length})</h3>
          <div className="space-y-3">
             {waitingQueues.length === 0 ? (
               <div className="p-6 text-center border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-900/50"><p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Kursi Anda Kosong Bos.</p></div>
             ) : ( waitingQueues.map(q => <QueueCard key={q.id} q={q} type="waiting"/>) )}
          </div>
        </div>

        {doneQueues.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b-2 border-emerald-900 pb-2"><History size={14}/> Selesai Hari Ini</h3>
            <div className="space-y-3">{doneQueues.map(q => <QueueCard key={q.id} q={q} type="done"/>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}