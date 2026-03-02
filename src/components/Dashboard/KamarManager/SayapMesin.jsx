import React, { useState } from 'react';

// Import semua pecahan Tab dari dalam folder SayapMesin
import TabKaryawan from './SayapMesin/TabKaryawan';
import TabLayanan from './SayapMesin/TabLayanan';
import TabProduk from './SayapMesin/TabProduk';
import TabInfrastruktur from './SayapMesin/TabInfrastruktur';
import TabOperasional from './SayapMesin/TabOperasional';

export default function SayapMesin({ user }) {
  const [activeTab, setActiveTab] = useState('karyawan');

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto relative font-sans text-slate-900">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">⚙️ System Settings</h1>
      </div>
      
      {/* TABS MENU NAVIGATION */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-6 scrollbar-hide">
        {['karyawan', 'layanan', 'produk', 'infrastruktur', 'operasional'].map((t) => (
          <button 
            key={t} 
            onClick={() => setActiveTab(t)} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all capitalize ${
              activeTab === t 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t === 'operasional' ? 'Operasional & SOP' : t}
          </button>
        ))}
      </div>

      {/* RENDER KOMPONEN SESUAI TAB YANG AKTIF */}
      <div className="mt-4">
        {activeTab === 'karyawan' && <TabKaryawan user={user} />}
        {activeTab === 'layanan' && <TabLayanan user={user} />}
        {activeTab === 'produk' && <TabProduk user={user} />}
        {activeTab === 'infrastruktur' && <TabInfrastruktur user={user} />}
        {activeTab === 'operasional' && <TabOperasional user={user} />}
      </div>
    </div>
  );
}