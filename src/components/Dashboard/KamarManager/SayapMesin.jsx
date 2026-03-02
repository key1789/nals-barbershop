import React, { useState } from 'react';
import { Settings2 } from 'lucide-react'; // <-- Pake Lucide biar senada!

// Import semua pecahan Tab dari dalam folder SayapMesin
import TabKaryawan from './SayapMesin/TabKaryawan';
import TabLayanan from './SayapMesin/TabLayanan';
import TabProduk from './SayapMesin/TabProduk';
import TabInfrastruktur from './SayapMesin/TabInfrastruktur';
import TabOperasional from './SayapMesin/TabOperasional';

export default function SayapMesin({ user }) {
  const [activeTab, setActiveTab] = useState('karyawan');

  return (
    <div className="p-2 md:p-6 max-w-4xl mx-auto relative text-slate-900 animate-in fade-in duration-500">
      
      {/* HEADER SAYAP */}
      <div className="mb-8 px-2 md:px-0 flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-2xl text-slate-700 shadow-sm border border-slate-200/50">
            <Settings2 size={26} strokeWidth={1.5} />
          </div>
          System Settings
        </h1>
        <p className="text-[15px] font-medium text-slate-500 md:ml-[52px]">
          Konfigurasi Operasional & Data Master
        </p>
      </div>
      
      {/* TABS MENU NAVIGATION */}
      <div className="flex overflow-x-auto gap-3 pb-4 mb-6 no-scrollbar px-2 md:px-0">
        {['karyawan', 'layanan', 'produk', 'infrastruktur', 'operasional'].map((t) => (
          <button 
            key={t} 
            onClick={() => setActiveTab(t)} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full whitespace-nowrap text-[14px] font-semibold transition-all focus:outline-none capitalize
              ${activeTab === t 
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
          >
            {t === 'operasional' ? 'Operasional & SOP' : t}
          </button>
        ))}
      </div>

      {/* RENDER KOMPONEN */}
      <div className="mt-2 animate-in fade-in duration-300">
        {activeTab === 'karyawan' && <TabKaryawan user={user} />}
        {activeTab === 'layanan' && <TabLayanan user={user} />}
        {activeTab === 'produk' && <TabProduk user={user} />}
        {activeTab === 'infrastruktur' && <TabInfrastruktur user={user} />}
        {activeTab === 'operasional' && <TabOperasional user={user} />}
      </div>

    </div>
  );
}