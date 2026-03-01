import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, List, 
  Package, History, Wallet, LogOut, Scissors,
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { supabase } from '../../../supabaseClient'; 

// Import sub-komponen (Pastikan case-sensitive filenya sudah benar di folder)
import DashboardView from "./DashboardView";
import TransactionWizard from "./TransactionWizard";
import AntrianView from "./AntrianView";
import InventoryManager from "./InventoryManager";
import TransactionHistory from "./TransactionHistory";
import ClosingShift from "./ClosingShift";

const KamarKasir = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // State buat Sidebar Ciut
  const [queues, setQueues] = useState([]);
  const [services, setServices] = useState([]);
  const [capsters, setCapsters] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. FUNGSI AMBIL LAYANAN & PRODUK
  const fetchServices = async () => {
    try {
      const { data, error } = await supabase.from('products_services').select('*').eq('is_active', true);
      if (error) throw error;
      setServices(data || []);
    } catch (err) { console.error("Gagal ambil services:", err.message); }
  };

  // 2. FUNGSI AMBIL CAPSTER
  const fetchCapsters = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('outlet_id', user.outlet_id).ilike('role', '%capster%').eq('is_active', true);
      if (error) throw error;
      setCapsters(data || []);
    } catch (err) { console.error("Gagal ambil capster:", err.message); }
  };

  // 3. FUNGSI REFRESH ANTREAN
  const refreshData = async () => {
    // Kalau dia lagi narik data, jangan di-setLoading true terus-terusan 
    // biar layar FO gak kedap-kedip pas Realtime jalan.
    if(queues.length === 0) setLoading(true); 
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const startOfDay = today.toISOString();
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
      const endOfToday = endOfDay.toISOString();

      const { data: q, error } = await supabase
        .from('visits')
        .select(`*, customers(nama, inisial_panggilan, no_wa, tier, poin), users!capster_id(nama), visit_items(id, item_id, qty, harga_saat_ini, products_services(id, nama_item, tipe))`)
        .eq('outlet_id', user.outlet_id)
        .gte('transaction_date', startOfDay)
        .lte('transaction_date', endOfToday)
        .neq('status_layanan', 'Cancel')
        .order('no_antrean', { ascending: true });

      if (error) throw error;
      setQueues(q || []);
    } catch (err) { console.error("Gagal refresh data:", err); } 
    finally { setLoading(false); }
  };

  // 4. EFEK PERTAMA KALI RENDER (Narik Data Awal)
  useEffect(() => {
    if (user?.outlet_id) { 
      refreshData(); 
      fetchServices(); 
      fetchCapsters(); 
    }
  }, [user?.outlet_id]);

  // --- 📡 5. SENSOR REALTIME (SISTEM SARAF) 📡 ---
  useEffect(() => {
    if (!user?.outlet_id) return;

    // Kita kasih nama channel yang spesifik per ruko biar gak bentrok
    const channelName = `antrean-ruko-${user.outlet_id}`;

    // Bikin "Satelit Pengintai" khusus buat ngecekin tabel 'visits' (Antrean)
    const antreanSatelit = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Dengerin SEMUA pergerakan (Insert, Update, Delete)
          schema: 'public',
          table: 'visits',
          filter: `outlet_id=eq.${user.outlet_id}` // Cuma ngintip ruko cabang ini aja
        },
        (payload) => {
          console.log('🚨 Info Satelit: Ada perubahan data di meja Capster/Antrean!', payload);
          // Kalau ada capster mencet 'START' atau 'SELESAI', langsung tarik data terbaru
          // Layar FO bakal auto-update tanpa perlu disentuh.
          refreshData(); 
        }
      )
      .subscribe((status) => {
        // Biar kita tau kapan satelitnya beneran udah nyambung
        if (status === 'SUBSCRIBED') {
          console.log('✅ Satelit Realtime Berhasil Mengorbit!');
        }
      });

    // Bersihin satelit kalau kasirnya logout atau tutup browser (Peredam Kejut Strict Mode)
    return () => {
      antreanSatelit.unsubscribe().then(() => {
        supabase.removeChannel(antreanSatelit);
      });
    };
  }, [user?.outlet_id]);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-left font-sans text-slate-900">
      
      {/* SIDEBAR DENGAN ANIMASI COLLAPSE */}
      <div className={`print:hidden bg-slate-900 h-full flex flex-col p-4 text-white shrink-0 transition-all duration-300 relative ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        
        {/* Tombol Toggle Sidebar */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center border-2 border-white shadow-lg z-50 hover:scale-110 active:scale-95 transition-all"
        >
          {isSidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
        </button>

        <div className={`p-4 mb-6 bg-indigo-600 rounded-2xl flex items-center shadow-lg transition-all ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <Scissors size={20} className="shrink-0"/>
          {!isSidebarCollapsed && <span className="font-bold text-xs tracking-widest uppercase truncate">Nal's Barbershop</span>}
        </div>

        <div className="space-y-1 flex-1 overflow-y-auto no-scrollbar">
          <NavButton icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={ShoppingCart} label="Transaksi" active={activeTab === 'transaction'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('transaction')} />
          <NavButton icon={List} label="Antrean" active={activeTab === 'antrian'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('antrian')} />
          
          <div className={`my-4 border-t border-slate-800 transition-all ${isSidebarCollapsed ? 'mx-2' : 'mx-0'}`} />
          
          <NavButton icon={Package} label="Stok / Inventori" active={activeTab === 'inventory'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('inventory')} />
          <NavButton icon={History} label="Riwayat & Void" active={activeTab === 'history'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('history')} />
          <NavButton icon={Wallet} label="Tutup Shift" active={activeTab === 'closing'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('closing')} />
        </div>

        <button onClick={onLogout} className={`p-4 text-rose-400 hover:bg-rose-500/10 rounded-xl flex items-center mt-auto font-bold uppercase text-[10px] transition-all ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <LogOut size={20}/> 
          {!isSidebarCollapsed && <span>Logout</span>}
        </button>
      </div>

      {/* AREA KONTEN UTAMA */}
      <div className="flex-1 h-full overflow-hidden relative bg-white">
        {/* Loading Spinner cuma muncul pas pertama kali buka aplikasi aja */}
        {loading && queues.length === 0 && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
             <div className="flex flex-col items-center gap-2">
                <Scissors size={40} className="text-indigo-600 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sinkronisasi...</p>
             </div>
          </div>
        )}

        <div className="h-full w-full overflow-y-auto">
            {activeTab === 'dashboard' && <DashboardView user={user} queues={queues} services={services} capsters={capsters} />}
            {activeTab === 'transaction' && <TransactionWizard user={user} services={services} capsters={capsters} onComplete={() => { setActiveTab('antrian'); refreshData(); }} />}
            {activeTab === 'antrian' && <AntrianView user={user} queues={queues} services={services} onRefresh={refreshData} />}
            {activeTab === 'inventory' && <InventoryManager user={user} services={services} onRefresh={refreshData} />}
            {activeTab === 'history' && <TransactionHistory user={user} onRefresh={refreshData} />}
            {activeTab === 'closing' && <ClosingShift user={user} queues={queues} onLogout={onLogout} />}
        </div>
      </div>
    </div>
  );
};

const NavButton = ({ icon: Icon, label, active, onClick, collapsed }) => (
  <button 
    onClick={onClick} 
    title={collapsed ? label : ""}
    className={`w-full flex items-center rounded-xl transition-all duration-200 py-3 ${active ? 'bg-indigo-600 text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800'} ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}
  >
    <Icon size={20} className="shrink-0"/> 
    {!collapsed && <span className="text-[11px] font-black uppercase tracking-wider truncate">{label}</span>}
  </button>
);

export default KamarKasir;