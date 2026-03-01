import React, { useState, useEffect } from 'react';
import { 
  Scissors, CalendarClock, History, MessageSquare, 
  User, Zap, Clock, TrendingUp 
} from 'lucide-react';

const DashboardView = ({ user, queues }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Jam Digital Real-time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Hitung Total Selesai Hari Ini
  const totalSelesai = queues.filter(q => q.status === 'Done').length;

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto space-y-8 bg-slate-50 animate-in fade-in duration-500">
      
      {/* 1. WELCOME BANNER & STATS */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-stretch">
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex-1 flex justify-between items-center">
          <div className="text-left">
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Ringkasan Outlet</h1>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="text-right text-4xl font-black text-indigo-600 tabular-nums">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        
        <div className="bg-indigo-600 p-6 rounded-[2.5rem] shadow-lg shadow-indigo-200 flex flex-col justify-center min-w-[240px] text-white text-center relative overflow-hidden">
          <TrendingUp className="absolute -right-4 -top-4 w-24 h-24 opacity-10 rotate-12" />
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Transaksi Selesai</p>
          <p className="text-4xl font-black">{totalSelesai} <span className="text-sm font-normal opacity-70 italic">Visits</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">
        
        {/* 2. CAPSTER ON-DUTY (Gaya BarberPOS Pro) */}
        <div className="lg:col-span-8 space-y-6">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Scissors size={18} className="text-indigo-600"/>
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs">Capster On-Duty</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Contoh Data Staf - Nanti bisa dihubungkan ke tabel 'capsters' */}
              {['Budi', 'Andi'].map((name, idx) => (
                <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 text-lg uppercase">
                    {name[0]}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <h4 className="font-black text-sm text-slate-800 truncate">{name}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">On-Duty • {idx === 0 ? '1' : '0'} Antrean</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. BOOKING HARI INI */}
          <section className="space-y-6 text-left">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-indigo-600"/>
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs">Jadwal Booking</h3>
            </div>
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-5 bg-indigo-50/50 border-b border-slate-100 font-black text-[10px] text-indigo-700 uppercase tracking-widest">
                Konfirmasi Kedatangan
              </div>
              <div className="divide-y divide-slate-50">
                <div className="p-5 flex justify-between items-center gap-4">
                  <div className="flex items-center gap-5 min-w-0 flex-1">
                    <div className="text-center min-w-[65px] border-r border-slate-100 pr-5">
                      <p className="text-xl font-black text-indigo-600">14:00</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">WIB</p>
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="font-bold text-slate-800 truncate">Pelanggan VIP</p>
                      <p className="text-[10px] text-slate-400">Menunggu Kedatangan</p>
                    </div>
                  </div>
                  <button className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors">
                    <MessageSquare size={16}/>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 4. REPEAT REMINDER (Gaya BarberPOS Pro) */}
        <div className="lg:col-span-4 space-y-8">
          <section className="text-left">
            <div className="flex items-center gap-2 mb-4">
              <History size={18} className="text-orange-500"/>
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs">Reminder Repeat</h3>
            </div>
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-sm text-slate-800">Cek Database Pelanggan</p>
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-1">4 Minggu Sejak Kunjungan Terakhir</p>
                  </div>
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-300">
                    <User size={14}/>
                  </div>
                </div>
                <button className="w-full py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100">
                  <MessageSquare size={14}/> Hubungi via WA
                </button>
              </div>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};

export default DashboardView;