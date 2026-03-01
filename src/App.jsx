import React, { useState, useEffect } from 'react';
import LoginScreen from './components/Login/LoginScreen';
import Dashboard from './components/Dashboard/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [isDeviceRegistered, setIsDeviceRegistered] = useState(false);

  useEffect(() => {
    // 1. Cek token perangkat (Apakah ini HP Kasir Resmi / Ruko?)
    const token = localStorage.getItem('device_token');
    setIsDeviceRegistered(!!token);

    // 2. Cek apakah user udah pernah login sebelumnya (Anti-amnesia)
    const savedUser = localStorage.getItem('active_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser)); 
    }
    
    setLoading(false); 
  }, []);

  // Pas sukses login dari LoginScreen
  const handleLoginSuccess = (userData) => {
    localStorage.setItem('active_user', JSON.stringify(userData)); 
    setUser(userData);
    
    // Cek ulang token (siapa tau dia baru aja masukin PIN Aktivasi)
    const token = localStorage.getItem('device_token');
    setIsDeviceRegistered(!!token);
  };

  // Pas pencet Logout
  const handleLogout = () => {
    localStorage.removeItem('active_user'); 
    setUser(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen font-bold text-slate-500">Mengecek Akses...</div>;
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Dashboard 
      user={user} 
      isDeviceRegistered={isDeviceRegistered} 
      onLogout={handleLogout} 
    />
  );
}

export default App;