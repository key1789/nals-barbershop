import React, { useState } from 'react';
import { Wallet, LineChart, Receipt, Vault, LockKeyhole } from 'lucide-react';

// Import Tab Anak Buah
import TabDashboardKeuangan from './SayapFinance/TabDashboardKeuangan';
import TabPettyCash from './SayapFinance/TabPettyCash';
import TabClosingKasir from './SayapFinance/TabClosingKasir';
import TabBukuBesar from './SayapFinance/TabBukuBesar';

export default function SayapFinance({ user, outletId }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="w-full text-slate-900">
      
      {/* HEADER SAYAP - Better responsive padding */}
      <div className="mb-6 sm:mb-8 px-1 sm:px-4 md:px-0 flex flex-col gap-1.5">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-emerald-50 rounded-2xl text-emerald-600 shadow-sm border border-emerald-100/50 shrink-0">
            <Wallet size={24} strokeWidth={1.5} />
          </div>
          <span>Brankas Keuangan</span>
        </h1>
        <p className="text-sm sm:text-[15px] font-medium text-slate-500 sm:ml-[52px]">
          Pusat Kendali Laba Rugi & Arus Kas
        </p>
      </div>
      
      {/* TABS MENU NAVIGATION - Fixed scrollbar visibility */}
      <div className="relative px-1 sm:px-4 md:px-0">
        <div className="flex overflow-x-auto gap-2 sm:gap-3 pb-3 mb-6 scroll-smooth scrollbar-hide">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full whitespace-nowrap text-sm sm:text-[14px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500
              ${activeTab === 'dashboard' 
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <LineChart size={16} strokeWidth={1.5} className={activeTab === 'dashboard' ? 'text-emerald-400' : ''}/> 
            <span>Dashboard Keuangan</span>
          </button>

          <button 
            onClick={() => setActiveTab('pettycash')} 
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full whitespace-nowrap text-sm sm:text-[14px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500
              ${activeTab === 'pettycash' 
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <Receipt size={16} strokeWidth={1.5} className={activeTab === 'pettycash' ? 'text-amber-400' : ''}/> 
            <span>Petty Cash</span>
          </button>

          <button 
            onClick={() => setActiveTab('bukubesar')} 
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full whitespace-nowrap text-sm sm:text-[14px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500
              ${activeTab === 'bukubesar' 
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <LockKeyhole size={16} strokeWidth={1.5} className={activeTab === 'bukubesar' ? 'text-rose-400' : ''}/> 
            <span>Management</span>
          </button>

          <button 
            onClick={() => setActiveTab('closing')} 
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full whitespace-nowrap text-sm sm:text-[14px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500
              ${activeTab === 'closing' 
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <Vault size={16} strokeWidth={1.5} className={activeTab === 'closing' ? 'text-indigo-400' : ''}/> 
            <span>Daily Closing</span>
          </button>
        </div>
        {/* Scroll indicator untuk mobile */}
        <div className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden"></div>
      </div>

      {/* RENDER KOMPONEN */}
      <div className="px-1 sm:px-4 md:px-0 animate-in fade-in duration-300">
        {activeTab === 'dashboard' && <TabDashboardKeuangan outletId={outletId} user={user} />}
        {activeTab === 'pettycash' && <TabPettyCash outletId={outletId} user={user} />} {/* <--- INI UDAH NYALA */}
        {activeTab === 'closing' && <TabClosingKasir outletId={outletId} user={user} />}
        {activeTab === 'bukubesar' && <TabBukuBesar outletId={outletId} user={user} />}
      </div>
      
    </div>
  );
}