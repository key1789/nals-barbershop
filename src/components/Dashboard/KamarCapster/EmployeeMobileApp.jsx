import React, { useState } from 'react';
import { Home, UserCircle, Scissors, ClipboardList, LogOut } from 'lucide-react';
import WorkstationCapster from './WorkstationCapster'; // Import file anak yang barusan dibikin

const BarbershopCapsterApp = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('antrean'); 

  // LOGIC UNTUK RENDER TAB YANG AKTIF
  const renderContent = () => {
    // Jika tab antrean aktif, panggil komponen WorkstationCapster
    if (activeTab === 'antrean') return <WorkstationCapster user={user} />;
    
    // Tampilan cadangan untuk tab yang belum kita buat
    return (
      <div className="p-8 text-center text-white flex flex-col items-center justify-center h-[80vh] bg-slate-950">
        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
           {activeTab === 'home' ? <Home size={40} className="text-indigo-500"/> : 
            activeTab === 'profil' ? <UserCircle size={40} className="text-emerald-500"/> : 
            <ClipboardList size={40} className="text-amber-500"/>}
        </div>
        <h2 className="text-2xl font-black uppercase italic mb-2 text-slate-100">Halo, {user?.nama}!</h2>
        <p className="text-xs text-slate-400 max-w-[250px] mb-12 leading-relaxed">
          Silakan buka tab <strong className="text-white">ANTREAN</strong> (Ikon Gunting) untuk masuk ke Mesin Layar Tempur.
        </p>
        
        <button onClick={onLogout} className="px-6 py-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-rose-500/20 active:scale-95 shadow-sm">
          <LogOut size={14}/> Keluar Aplikasi
        </button>
      </div>
    );
  };

  return (
    <div className="dark"> {/* Paksa tema gelap buat mobile app ini */}
      <div className="bg-slate-950 min-h-screen flex justify-center">
        {/* Frame mirip HP - max-w-md */}
        <div className="w-full max-w-md bg-slate-950 min-h-screen shadow-2xl relative flex flex-col border-x border-slate-900/50">
          
          <main className="flex-1 overflow-y-auto no-scrollbar">
            {renderContent()}
          </main>
          
          {/* BOTTOM NAVIGATION BAR (FIXED) */}
          <nav className="fixed bottom-0 w-full max-w-md bg-slate-900/90 backdrop-blur-xl border-t border-slate-800/80 flex justify-around p-4 z-[100] pb-6">
            <button onClick={() => setActiveTab('home')} className={`p-2 flex flex-col items-center transition-all ${activeTab === 'home' ? 'text-indigo-400 -translate-y-2' : 'text-slate-500'}`}>
              <Home size={22}/>
              <span className="text-[8px] font-black tracking-widest mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">HOME</span>
            </button>
            <button onClick={() => setActiveTab('antrean')} className={`p-3.5 bg-slate-800 rounded-2xl flex flex-col items-center transition-all shadow-lg border border-slate-700 ${activeTab === 'antrean' ? 'text-white bg-indigo-600 shadow-indigo-600/30 border-indigo-400 -translate-y-4 scale-110' : 'text-slate-400'}`}>
                <Scissors size={24}/>
            </button>
            <button onClick={() => setActiveTab('tugas')} className={`p-2 flex flex-col items-center transition-all ${activeTab === 'tugas' ? 'text-amber-400 -translate-y-2' : 'text-slate-500'}`}>
              <ClipboardList size={22}/>
            </button>
            <button onClick={() => setActiveTab('profil')} className={`p-2 flex flex-col items-center transition-all ${activeTab === 'profil' ? 'text-emerald-400 -translate-y-2' : 'text-slate-500'}`}>
              <UserCircle size={22}/>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default BarbershopCapsterApp;