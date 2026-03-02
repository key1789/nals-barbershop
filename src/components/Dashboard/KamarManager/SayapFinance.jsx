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
    <div className="p-2 md:p-6 max-w-6xl mx-auto relative text-slate-900 animate-in fade-in duration-500">
      
      {/* HEADER SAYAP */}
      <div className="mb-8 px-2 md:px-0 flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600 shadow-sm border border-emerald-100/50">
            <Wallet size={26} strokeWidth={1.5} />
          </div>
          Brankas Keuangan
        </h1>
        <p className="text-[15px] font-medium text-slate-500 md:ml-[52px]">
          Pusat Kendali Laba Rugi & Arus Kas
        </p>
      </div>
      
      {/* TABS MENU NAVIGATION (Gaya Pill Airbnb) */}
      <div className="flex overflow-x-auto gap-3 pb-4 mb-6 no-scrollbar px-2 md:px-0">
        
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full whitespace-nowrap text-[14px] font-semibold transition-all focus:outline-none
            ${activeTab === 'dashboard' 
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
              : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <LineChart size={18} strokeWidth={1.5} className={activeTab === 'dashboard' ? 'text-emerald-400' : ''}/> 
          Dashboard Keuangan
        </button>

        <button 
          onClick={() => setActiveTab('pettycash')} 
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full whitespace-nowrap text-[14px] font-semibold transition-all focus:outline-none
            ${activeTab === 'pettycash' 
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
              : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <Receipt size={18} strokeWidth={1.5} className={activeTab === 'pettycash' ? 'text-amber-400' : ''}/> 
          Petty Cash Transaction
        </button>

        <button 
          onClick={() => setActiveTab('bukubesar')} 
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full whitespace-nowrap text-[14px] font-semibold transition-all focus:outline-none
            ${activeTab === 'bukubesar' 
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
              : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <LockKeyhole size={18} strokeWidth={1.5} className={activeTab === 'bukubesar' ? 'text-rose-400' : ''}/> 
          Management Expenses
        </button>

        <button 
          onClick={() => setActiveTab('closing')} 
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full whitespace-nowrap text-[14px] font-semibold transition-all focus:outline-none
            ${activeTab === 'closing' 
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
              : 'bg-white border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <Vault size={18} strokeWidth={1.5} className={activeTab === 'closing' ? 'text-indigo-400' : ''}/> 
          Daily Closing
        </button>

      </div>

      {/* RENDER KOMPONEN */}
      <div className="mt-2 animate-in fade-in duration-300">
        {activeTab === 'dashboard' && <TabDashboardKeuangan outletId={outletId} user={user} />}
        {activeTab === 'pettycash' && <TabPettyCash outletId={outletId} user={user} />} {/* <--- INI UDAH NYALA */}
        {activeTab === 'closing' && <TabClosingKasir outletId={outletId} user={user} />}
        {activeTab === 'bukubesar' && <TabBukuBesar outletId={outletId} user={user} />}
      </div>
      
    </div>
  );
}