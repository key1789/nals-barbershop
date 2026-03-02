import React, { useState } from 'react';
import { ShieldAlert, Fingerprint, Camera, Award } from 'lucide-react';

// Import "Anak-anak buah" (Tab) dari folder SayapHRD
// import TabAbsensi from './SayapHRD/TabAbsensi';
// import TabAuditSOP from './SayapHRD/TabAuditSOP';
import TabRekapKPI from './SayapHRD/TabRekapKPI'; // Ini file yang kita coding tadi

export default function SayapHRD({ user, outletId }) {
  // Default tab yang kebuka pertama kali (bisa diset ke 'rekap' sementara)
  const [activeTab, setActiveTab] = useState('rekap');

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto relative font-sans text-slate-900 animate-in fade-in duration-300">
      
      {/* HEADER SAYAP */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <ShieldAlert className="text-rose-600" size={32} /> Polisi Ruko (HRD)
        </h1>
        <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">
          Pusat Audit Operasional & Kinerja
        </p>
      </div>
      
      {/* TABS MENU NAVIGATION */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-6 scrollbar-hide border-b border-slate-200">
        
        {/* Tombol Tab 1: Absensi */}
        <button 
          onClick={() => setActiveTab('absensi')} 
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl whitespace-nowrap text-sm font-black transition-all uppercase tracking-widest ${
            activeTab === 'absensi' 
              ? 'bg-rose-50 text-rose-700 border-b-2 border-rose-600' 
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Fingerprint size={16}/> Radar Absen
        </button>

        {/* Tombol Tab 2: Audit SOP */}
        <button 
          onClick={() => setActiveTab('audit')} 
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl whitespace-nowrap text-sm font-black transition-all uppercase tracking-widest ${
            activeTab === 'audit' 
              ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600' 
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Camera size={16}/> Audit SOP
        </button>

        {/* Tombol Tab 3: Rekap KPI (Yang kita buat tadi) */}
        <button 
          onClick={() => setActiveTab('rekap')} 
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl whitespace-nowrap text-sm font-black transition-all uppercase tracking-widest ${
            activeTab === 'rekap' 
              ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600' 
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Award size={16}/> Mahkamah KPI
        </button>

      </div>

      {/* RENDER KOMPONEN SESUAI TAB YANG AKTIF */}
      <div className="mt-4">
        {/* {activeTab === 'absensi' && <TabAbsensi outletId={outletId} />} */}
        {/* {activeTab === 'audit' && <TabAuditSOP outletId={outletId} />} */}
        {activeTab === 'rekap' && <TabRekapKPI outletId={outletId} />}
      </div>
      
    </div>
  );
}