import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, Users, Radar, Settings, Menu, X, LogOut, Bell } from 'lucide-react';

// IMPORT KOMPONEN SAYAP YANG UDAH JADI
import SayapFinance from './SayapFinance';
import SayapMesin from './SayapMesin';
import SayapHRD from './SayapHRD'; 

export default function KamarManagerLayout({ user, onLogout }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Icon dibikin strokeWidth={1.5} biar tipis dan elegan ala Airbnb
  const menuItems = [
    { id: 'dashboard', name: 'Mata Dewa', icon: <LayoutDashboard size={22} strokeWidth={1.5} /> },
    { id: 'finance', name: 'Keuangan & Kas', icon: <Wallet size={22} strokeWidth={1.5} /> },
    { id: 'hrd', name: 'HRD', icon: <Users size={22} strokeWidth={1.5} /> },
    { id: 'crm', name: 'Radar Konsumen', icon: <Radar size={22} strokeWidth={1.5} /> },
    { id: 'mesin', name: 'System Settings', icon: <Settings size={22} strokeWidth={1.5} /> },
  ];

  // Render Sayap Asli (Udah dicolokin ke komponen beneran)
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <div className="p-8 text-slate-500 font-medium text-center mt-10">🛠️ Area Sayap Mata Dewa (Belum Dibikin)</div>;
      case 'finance':
        return <SayapFinance user={user} outletId={user?.outlet_id} />;
      case 'hrd':
        return <SayapHRD user={user} outletId={user?.outlet_id} />; 
      case 'crm':
        return <div className="p-8 text-slate-500 font-medium text-center mt-10">🎯 Area Radar CRM (Belum Dibikin)</div>;
      case 'mesin':
        return <SayapMesin user={user} />;
      default:
        return <div>Pilih Menu</div>;
    }
  };

  // Lock scroll saat mobile menu terbuka
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const activeMenuName = menuItems.find(m => m.id === activeTab)?.name || 'Dashboard';

  return (
    // Wrap utama dengan font Plus Jakarta Sans
    <div 
      className="min-h-[100dvh] bg-[#F7F7F9] flex flex-col md:flex-row text-slate-800"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      
      {/* 📱 TOP HEADER MOBILE */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 p-4 flex items-center justify-between md:hidden sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1 -ml-1 text-slate-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
          </button>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">{activeMenuName}</h1>
        </div>
        <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-sm">
          {user?.nama?.charAt(0) || 'O'}
        </div>
      </div>

      {/* 🖥️ CONTROL TOWER (Sidebar) */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[280px] bg-white md:border-r border-slate-200/60 transform transition-transform duration-400 cubic-bezier(0.4, 0, 0.2, 1) md:relative md:translate-x-0 flex flex-col shrink-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Header Control Tower */}
        <div className="p-6 md:p-8 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]"></span>
              Nal's Control
            </h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">Hi, {user?.nama?.split(' ')[0] || 'Admin'}</p>
          </div>
          {/* Tambahan tombol silang di mobile biar gampang di-close */}
          <button 
            className="md:hidden p-2 -mr-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* List Menu Sayap */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-1.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false); // Otomatis tutup menu di HP pas di klik
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-200 text-[15px] font-semibold focus:outline-none group
                ${activeTab === item.id
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              <div className={`transition-transform duration-200 group-hover:scale-110 ${activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`}>
                {item.icon}
              </div>
              {item.name}
            </button>
          ))}
        </div>

        {/* Footer Sidebar (User & Logout) */}
        <div className="p-6 shrink-0 mt-auto">
           <button 
             onClick={onLogout}
             className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-2xl text-[15px] font-semibold transition-all focus:outline-none"
           >
             <LogOut size={18} strokeWidth={1.5} /> Keluar Sistem
           </button>
        </div>
      </div>

      {/* ⬛ OVERLAY GELAP DI HP */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ⬜ KONTEN UTAMA */}
      <div className="flex-1 flex flex-col h-[calc(100dvh-64px)] md:h-[100dvh] overflow-hidden relative">
        
        {/* Top Header Desktop (Biar rapi kaya Dashboard beneran) */}
        <header className="hidden md:flex items-center justify-between px-10 py-8 shrink-0 z-10">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{activeMenuName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-3 bg-white text-slate-600 hover:text-slate-900 shadow-sm border border-slate-200/60 rounded-full transition-all relative group">
              <Bell size={20} strokeWidth={1.5} className="group-hover:rotate-12 transition-transform" />
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Area Render Sayap - Punya frame "ngambang" ala Airbnb */}
        <main className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 pt-4 md:pt-0">
          <div className="bg-white rounded-3xl min-h-full border border-slate-200/60 shadow-sm shadow-slate-100 overflow-hidden">
            {renderContent()}
          </div>
        </main>

      </div>

    </div>
  );
}