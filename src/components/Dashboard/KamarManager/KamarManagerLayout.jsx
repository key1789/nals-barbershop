import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, Users, Radar, Settings, Menu, X, LogOut } from 'lucide-react';

// Nanti file-file ini dibikin beneran, sekarang pake dummy text dulu di bawah
// import SayapDashboard from './SayapDashboard';
// import SayapFinance from './SayapFinance';
// import SayapHRD from './SayapHRD';
// import SayapCRM from './SayapCRM';
import SayapMesin from './SayapMesin';

export default function KamarManagerLayout({ user, onLogout }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // State untuk ngatur Sayap mana yang aktif

  // Daftar 5 Sayap (Menu Kamar 3)
  const menuItems = [
    { id: 'dashboard', name: 'Mata Dewa', icon: <LayoutDashboard size={20} /> },
    { id: 'finance', name: 'Keuangan & Kas', icon: <Wallet size={20} /> },
    { id: 'hrd', name: 'Polisi Ruko (HRD)', icon: <Users size={20} /> },
    { id: 'crm', name: 'Radar Konsumen', icon: <Radar size={20} /> },
    { id: 'mesin', name: 'Ruang Mesin', icon: <Settings size={20} /> },
  ];

  // Fungsi Render Konten Tengah Berdasarkan Tab Aktif
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <div className="p-8 text-slate-500 font-bold">🛠️ Area Sayap Mata Dewa (Belum Dibikin)</div>;
      case 'finance':
        return <div className="p-8 text-slate-500 font-bold">💰 Area Keuangan & Kas (Belum Dibikin)</div>;
      case 'hrd':
        return <div className="p-8 text-slate-500 font-bold">👮 Area HRD & KPI (Belum Dibikin)</div>;
      case 'crm':
        return <div className="p-8 text-slate-500 font-bold">🎯 Area Radar CRM (Belum Dibikin)</div>;
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

  return (
    <div className="min-h-[100dvh] bg-gray-50 md:flex">
      
      {/* 📱 HEADER MOBILE */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between md:hidden shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label={isMobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="text-lg font-bold text-blue-400">Control Tower</h1>
        </div>
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
          {user?.nama?.charAt(0) || 'OW'}
        </div>
      </div>

      {/* 🖥️ SIDEBAR (Kiri) */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 hidden md:block">
          <h2 className="text-2xl font-bold text-blue-400">Nal's Control</h2>
          <p className="text-slate-400 text-sm">Hi, {user?.nama}</p>
        </div>

        <ul className="space-y-2 px-4 mt-6 md:mt-0 flex-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white font-semibold shadow-lg border-l-4 border-blue-300 md:border-l-0 md:border-b-4'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                aria-current={activeTab === item.id ? 'page' : undefined}
                aria-label={item.name}
              >
                {item.icon}
                {item.name}
              </button>
            </li>
          ))}
        </ul>

        {/* Tombol Logout di Bawah Sidebar */}
        <div className="p-4 border-t border-slate-800 sticky bottom-0 bg-slate-900 z-10">
           <button 
             onClick={onLogout}
             className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400"
             aria-label="Logout"
           >
             <LogOut size={18} /> Logout
           </button>
        </div>
      </div>

      {/* ⬛ OVERLAY GELAP DI HP */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Tutup menu overlay"
        />
      )}

      {/* ⬜ AREA KONTEN TENGAH */}
      <div className="flex-1 overflow-y-auto h-[100dvh] pb-8 md:pb-0">
        {renderContent()}
      </div>

    </div>
  );
}