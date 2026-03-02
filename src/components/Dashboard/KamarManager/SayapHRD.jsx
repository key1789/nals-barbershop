import React, { useState } from 'react';
import { ShieldAlert, Fingerprint, Camera, Award } from 'lucide-react';

// Import "Anak-anak buah" (Tab) dari folder SayapHRD
import TabAbsensi from './SayapHRD/TabAbsensi'; 
import TabAuditSOP from './SayapHRD/TabAuditSOP'; 
import TabRekapKPI from './SayapHRD/TabRekapKPI';

export default function SayapHRD({ user, outletId }) {
  const [activeTab, setActiveTab] = useState('rekap');

  return (
    <div className="p-2 md:p-6 max-w-5xl mx-auto relative text-slate-900 animate-in fade-in duration-500">
      
      {/* HEADER SAYAP */}
      <div className="mb-8 px-2 md:px-0 flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600 shadow-sm border border-rose-100/50">
            <ShieldAlert size={26} strokeWidth={1.5} />
          </div>
          Manajemen SDM (HRD)
        </h1>
        <p className="text-[15px] font-medium text-slate-500 md:ml-[52px]">
          Pusat Controlling Performa SDM
        </p>
      </div>
      
      {/* TABS MENU NAVIGATION */}
      <div className="flex overflow-x-auto gap-3 pb-4 mb-6 no-scrollbar px-2 md:px-0">
        
        <button 
          onClick={() => setActiveTab('absensi')} 
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full whitespace-nowrap text-[14px] font-semibold transition-all focus:outline-none
            ${activeTab === 'absensi' 
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
              : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <Fingerprint size={18} strokeWidth={1.5} className={activeTab === 'absensi' ? 'text-rose-400' : ''}/> 
          Controlling Absen
        </button>

        <button 
          onClick={() => setActiveTab('audit')} 
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full whitespace-nowrap text-[14px] font-semibold transition-all focus:outline-none
            ${activeTab === 'audit' 
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
              : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <Camera size={18} strokeWidth={1.5} className={activeTab === 'audit' ? 'text-amber-400' : ''}/> 
          Audit LogBook
        </button>

        <button 
          onClick={() => setActiveTab('rekap')} 
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full whitespace-nowrap text-[14px] font-semibold transition-all focus:outline-none
            ${activeTab === 'rekap' 
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
              : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <Award size={18} strokeWidth={1.5} className={activeTab === 'rekap' ? 'text-emerald-400' : ''}/> 
          Closing KPI & Payroll
        </button>

      </div>

      {/* RENDER KOMPONEN */}
      <div className="mt-2 animate-in fade-in duration-300">
        {activeTab === 'absensi' && <TabAbsensi outletId={outletId} />} 
        {activeTab === 'audit' && <TabAuditSOP outletId={outletId} />} 
        {activeTab === 'rekap' && <TabRekapKPI outletId={outletId} />}
      </div>
      
    </div>
  );
}