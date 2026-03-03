import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Wallet, Users, Radar, Settings, Menu, X, LogOut, Bell } from 'lucide-react';

// IMPORT KOMPONEN SAYAP YANG UDAH JADI
import SayapFinance from './SayapFinance';
import SayapMesin from './SayapMesin';
import SayapHRD from './SayapHRD'; 

// MENU ITEMS CONSTANT - Prevent icon re-rendering
const MENU_ITEMS = [
  { 
    id: 'dashboard', 
    name: 'Dashboard', 
    iconName: 'LayoutDashboard',
    description: 'Dasbor Utama Manager'
  },
  { 
    id: 'finance', 
    name: 'Keuangan', 
    iconName: 'Wallet',
    description: 'Laba Rugi & Arus Kas'
  },
  { 
    id: 'hrd', 
    name: 'HRD', 
    iconName: 'Users',
    description: 'Manajemen SDM'
  },
  { 
    id: 'crm', 
    name: 'Customers', 
    iconName: 'Radar',
    description: 'Customer Relationship'
  },
  { 
    id: 'mesin', 
    name: 'System Settings', 
    iconName: 'Settings',
    description: 'Konfigurasi Sistem'
  },
];

// Helper: Render icon berdasarkan iconName
const renderIcon = (iconName) => {
  const iconProps = { size: 22, strokeWidth: 1.5 };
  const iconMap = {
    'LayoutDashboard': <LayoutDashboard {...iconProps} />,
    'Wallet': <Wallet {...iconProps} />,
    'Users': <Users {...iconProps} />,
    'Radar': <Radar {...iconProps} />,
    'Settings': <Settings {...iconProps} />,
  };
  return iconMap[iconName] || null;
};

export default function KamarManagerLayout({ user, onLogout }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [headerHeight, setHeaderHeight] = useState(64); // Track dynamic header height

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

  // Handle menu toggle dengan proper keyboard support
  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  // Handle global keyboard events (Escape to close menu, Tab for focus management)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    
    if (isMobileMenuOpen) {
      window.addEventListener('keydown', handleKeyPress);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isMobileMenuOpen]);

  // Lock scroll saat mobile menu terbuka
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isMobileMenuOpen]);

  const activeMenuName = MENU_ITEMS.find(m => m.id === activeTab)?.name || 'Dashboard';

  return (
    // Wrap utama dengan font Plus Jakarta Sans - Improved flex structure
    <div 
      className="min-h-screen w-full bg-[#F7F7F9] flex flex-col md:flex-row text-slate-800 overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      
      {/* 📱 TOP HEADER MOBILE - Improved spacing & accessibility */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 py-3 md:py-4 flex items-center justify-between md:hidden sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={isMobileMenuOpen}
            className="p-1.5 -ml-1 text-slate-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isMobileMenuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
          </button>
          <h1 className="text-base md:text-lg font-bold text-slate-800 tracking-tight truncate">{activeMenuName}</h1>
        </div>
        <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-sm shrink-0">
          {user?.nama?.charAt(0) || 'O'}
        </div>
      </div>

      {/* 🖥️ CONTROL TOWER (Sidebar) - Improved behavior */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[280px] md:w-[280px] bg-white md:border-r border-slate-200/60 transform transition-transform duration-400 cubic-bezier(0.4, 0, 0.2, 1) md:relative md:translate-x-0 flex flex-col shrink-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Header Control Tower */}
        <div className="px-6 py-6 md:px-8 md:py-8 flex items-center justify-between shrink-0 border-b border-slate-100 md:border-b-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]"></span>
              Nal's Control
            </h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">Hi, {user?.nama?.split(' ')[0] || 'Admin'}</p>
          </div>
          <button 
            className="md:hidden p-2 -mr-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Tutup panel navigasi"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* List Menu Sayap */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-1.5 py-4">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              aria-current={activeTab === item.id ? "page" : undefined}
              title={item.description}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-200 text-[15px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 group
                ${activeTab === item.id
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              <div className={`transition-transform duration-200 group-hover:scale-110 shrink-0 ${activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`}>
                {renderIcon(item.iconName)}
              </div>
              <span className="text-left">{item.name}</span>
            </button>
          ))}
        </nav>

        {/* Footer Sidebar (User & Logout) */}
        <div className="p-6 shrink-0 border-t border-slate-100">
           <button 
             onClick={() => {
               if (window.confirm(`Keluar dari sistem, ${user?.nama?.split(' ')[0] || 'Admin'}?`)) {
                 onLogout();
               }
             }}
             className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-2xl text-[15px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-rose-500"
           >
             <LogOut size={18} strokeWidth={1.5} /> Keluar Sistem
           </button>
        </div>
      </div>

      {/* ⬛ OVERLAY GELAP DI HP - Improved interaction */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Tutup menu"
        />
      )}

      {/* ⬜ KONTEN UTAMA - Improved height & layout */}
      <div className="flex-1 flex flex-col w-full md:w-auto overflow-hidden relative">
        
        {/* Top Header Desktop (Biar rapi kaya Dashboard beneran) */}
        <header className="hidden md:flex items-center justify-between px-8 lg:px-12 py-6 lg:py-8 shrink-0 z-10 border-b border-slate-200/40">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{activeMenuName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              className="p-3 bg-white text-slate-600 hover:text-slate-900 shadow-sm border border-slate-200/60 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 relative group"
              aria-label="Notifikasi"
            >
              <Bell size={20} strokeWidth={1.5} className="group-hover:rotate-12 transition-transform" />
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Area Render Sayap - Proper scrollable container */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 md:px-8 lg:px-12 py-4 md:py-6 lg:py-8 bg-[#F7F7F9]">
          <div className="bg-white rounded-3xl min-h-full border border-slate-200/60 shadow-sm shadow-slate-100 overflow-hidden">
            {renderContent()}
          </div>
        </main>

      </div>

    </div>
  );
}