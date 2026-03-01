import React from 'react';
import { LogOut } from 'lucide-react';
// IMPORT KAMAR 1, 2, 3 (Sudah Disesuaikan)
import KamarKasir from "./KamarKasir/KamarKasir"; 
import KamarCapsterMobile from "./KamarCapster/index.jsx";
import KamarManagerLayout from "./KamarManager/KamarManagerLayout";

const Dashboard = ({ user, isDeviceRegistered, onLogout }) => {
  
  // ==========================================
  // 🟢 LOGIKA 1: DEVICE TERDAFTAR (TABLET KASIR / RUKO)
  // ==========================================
  if (isDeviceRegistered) {
    return <KamarKasir user={user} onLogout={onLogout} />;
  }

  // ==========================================
  // 🔵 LOGIKA 2: DEVICE TIDAK TERDAFTAR (HP PRIBADI / LAPTOP)
  // ==========================================
  
  // A & B: JALUR PEGAWAI (CAPSTER & FO) MASUK MOBILE APP
  if (user.role === 'Capster' || user.role === 'FO') {
    // Kita lempar props 'role' ke dalam, biar di dalam nanti 
    // tab Antrean disembunyikan khusus buat FO.
    return <KamarCapsterMobile user={user} onLogout={onLogout} />;
  }

  // C: JALUR MANAGER / OWNER (Kamar 3 - Back Office)
  if (['Manager', 'Owner', 'Admin'].includes(user.role)) {
    return <KamarManagerLayout user={user} onLogout={onLogout} />;
  }

  // ==========================================
  // 🔴 3. FALLBACK DARURAT (Role Tidak Dikenali)
  // ==========================================
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100">
      <p className="font-bold mb-4 uppercase tracking-widest text-rose-500">System Error: Role Tidak Valid</p>
      <button onClick={onLogout} className="px-6 py-2 bg-slate-800 rounded-full font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
        <LogOut size={18} /> Logout
      </button>
    </div>
  );
};

export default Dashboard;