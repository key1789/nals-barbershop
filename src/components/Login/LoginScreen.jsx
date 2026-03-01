import React, { useState } from 'react';
import { User, Lock, Key, ChevronLeft } from 'lucide-react'; // Ikon Scissors & Settings dihapus
import { supabase } from '../../supabaseClient';

// --- IMPORT LOGO LO DI SINI ---
// Pastikan nama file sesuai dengan yang lo taruh di folder src/assets/
import logoNals from '../../assets/logo-nals.png'; 

const LoginScreen = ({ onLoginSuccess }) => {
  const [view, setView] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  // STATE BARU: Buat ngitung jumlah ketukan rahasia
  const [secretTapCount, setSecretTapCount] = useState(0);

  // --- FUNGSI RAHASIA: JALUR NINJA ---
  const handleSecretTap = () => {
    // Kalau belum sampai 4 kali ketuk, tambahin hitungannya
    if (secretTapCount < 4) {
      setSecretTapCount(secretTapCount + 1);
      console.log(`Tap ke-${secretTapCount + 1}`); // Buat ngecek di console browser
    } else {
      // Kalau ini ketukan ke-5!
      console.log("Jurus Rahasia Aktif! 🥷");
      setView('activation'); // Langsung loncat ke layar masukin PIN
      setSecretTapCount(0); // Reset hitungan biar bisa dipake lagi nanti
    }
  };

  // 1. FUNGSI LOGIN (Handle Masuk)
  const handleLogin = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nama, role, outlet_id, gaji_pokok, hk_area_pic, photo_url')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        alert("Username atau Password Salah! ❌");
        return;
      }
      onLoginSuccess(data); 
    } catch (err) {
      alert("Gagal terhubung ke database.");
    }
  };

// 2. FUNGSI AKTIVASI (Handle PIN)
  const handleActivation = async () => {
    try {
      const { data, error } = await supabase
        .from('activation_codes')
        .select('*')
        .eq('code', pin)
        .eq('is_used', false)
        .single();

      if (error || !data) {
        alert("PIN Salah atau Sudah Kadaluwarsa! ❌");
        return;
      }

      // Bikin Token unik (Kombinasi ID Outlet + Waktu saat ini biar gak kembar)
      const tokenUnik = `TOKEN-${data.outlet_id}-${Date.now()}`;

      // 1. Simpan token ke HP Kasir
      localStorage.setItem('device_token', tokenUnik);
      
      // 2. Hanguskan PIN
      await supabase.from('activation_codes').update({ is_used: true }).eq('id', data.id);

      // 3. ✨ BARU: Catet token ini ke tabel 'device_tokens' di Supabase ✨
      await supabase.from('device_tokens').insert([
        { 
          outlet_id: data.outlet_id, 
          token_hash: tokenUnik // Lo punya kolom token_hash kan di tabel lo?
        }
      ]);
      
      alert("Perangkat Berhasil Diaktifkan & Tercatat di Server! ✅");
      setPin('');
      setView('login');
    } catch (err) {
      alert("Gagal mengaktifkan perangkat. Cek koneksi internetmu.");
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 flex items-center justify-center p-6 text-left font-sans">
      
      {/* ❌ TOMBOL GERIGI RAHASIA DIHAPUS DARI SINI ❌ */}

      <div className="w-full max-w-sm bg-white p-8 rounded-[40px] shadow-xl shadow-slate-200/60 space-y-8">
        
        {/* --- TAMPILAN 1: LOGIN --- */}
        {view === 'login' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              
              {/* --- AREA LOGO & SECRET TAP --- */}
              {/* Kita pasang onClick di wadah (container) logonya */}
              <div 
                onClick={handleSecretTap} 
                className="w-24 h-24 bg-white rounded-3xl mx-auto flex items-center justify-center shadow-lg border border-slate-100 cursor-pointer active:scale-95 transition-all overflow-hidden"
              >
                {/* Ganti Scissors dengan Gambar Logo */}
                <img src={logoNals} alt="Nal's Barbershop Logo" className="w-full h-full object-cover" />
              </div>

              <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-4 uppercase">Nal's Barbershop</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Akses Portal Karyawan</p>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-[24px] border border-slate-100 transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                <div className="flex items-center gap-3 mt-1 px-1">
                  <User size={18} className="text-slate-400" />
                  <input 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    className="bg-transparent outline-none text-sm font-bold w-full text-slate-800" 
                    placeholder="User ID" 
                  />
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-[24px] border border-slate-100 transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="flex items-center gap-3 mt-1 px-1">
                  <Lock size={18} className="text-slate-400" />
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="bg-transparent outline-none text-sm font-bold w-full text-slate-800" 
                    placeholder="••••••••" 
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()} 
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleLogin} 
              className="w-full bg-slate-900 text-white py-4 rounded-[24px] font-bold shadow-lg shadow-slate-200 active:scale-95 hover:bg-slate-800 transition-all"
            >
              Masuk Sekarang
            </button>
          </div>
        )}

        {/* --- TAMPILAN 2: OPSI MENU (Tombol Back doang) --- */}
        {view === 'menu' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <button onClick={() => setView('login')} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors">
              <ChevronLeft size={16}/> Kembali
            </button>
            
            {/* Menu Opsi Perangkat dihapus karena langsung loncat ke Aktivasi */}
            
          </div>
        )}

        {/* --- TAMPILAN 3: LAYAR PIN (Sekarang langsung loncat ke sini) --- */}
        {view === 'activation' && (
          <div className="space-y-6 text-center animate-in slide-in-from-right duration-300">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Aktivasi Kasir</h2>
            <p className="text-xs text-slate-500 font-medium">Masukkan 6 Digit PIN Manager</p>
            <input 
              type="number" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-5 bg-slate-50 rounded-[24px] border-2 border-dashed border-slate-300 focus:border-indigo-500 text-center text-3xl font-black tracking-[0.5em] outline-none transition-colors" 
              placeholder="000000" 
            />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setView('login')} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Batal</button>
              <button onClick={handleActivation} className="flex-[2] bg-indigo-600 text-white py-4 rounded-[24px] font-bold shadow-lg shadow-indigo-200 active:scale-95 hover:bg-indigo-700 transition-all">Aktifkan Sekarang</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginScreen;