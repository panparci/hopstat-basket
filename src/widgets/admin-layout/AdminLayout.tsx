import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Outlet, Navigate } from 'react-router-dom';
import { 
  Menu, X, ChevronLeft, ChevronRight, LogOut, Home, 
  FileCheck, UserPlus, Users, Inbox, ClipboardList, Layout, Bot, UserCheck, Shield, Lock, Bell, Contact, Trophy, Video, Target, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePermissions } from '../../core/contexts/PermissionsContext';
import { authService } from '../../services/authService';
import { claimService } from '../../services/claimService';
import { applicationService } from '../../services/applicationService';
import { AppShell } from '../app-shell/AppShell';

interface MenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
  badgeKey?: 'claims' | 'applications';
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, can } = usePermissions();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('hoopstats_admin_sidebar_collapsed');
    return saved === 'true';
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [pendingAppsCount, setPendingAppsCount] = useState(0);

  // Grouped Top Tab Categories (Level 1 Modules)
  const menuGroups: (MenuGroup & { id: string; icon: React.ComponentType<any>; badgeCount?: number })[] = [
    {
      id: 'utama',
      title: 'Utama & Dashboard',
      icon: Layout,
      items: [
        { label: 'Beranda Publik', path: '/', icon: Home },
        { label: 'Dashboard Control', path: '/admin', icon: Layout },
        { label: 'Pertandingan', path: '/games', icon: Trophy },
        { label: 'Statistik', path: '/stats', icon: ClipboardList }
      ]
    },
    {
      id: 'operasional',
      title: 'Operasional & Verifikasi',
      icon: FileCheck,
      badgeCount: pendingClaimsCount + pendingAppsCount,
      items: [
        { label: 'Klaim Profil Atlet', path: '/admin/claims', icon: FileCheck, badgeKey: 'claims' },
        { label: 'Persetujuan Peran', path: '/admin/applications', icon: UserPlus, badgeKey: 'applications' },
        { label: 'Kurasi Tim & Organisasi', path: '/admin/curations', icon: Database },
        { label: 'CRM Prospek', path: '/admin/crm', icon: Users },
        { label: 'Direktori Atlet', path: '/admin/athletes', icon: Contact },
        { label: 'Manajemen Games', path: '/admin/games', icon: Trophy }
      ]
    },
    {
      id: 'layanan',
      title: 'Layanan & Tugas',
      icon: Inbox,
      items: [
        { label: 'Permintaan Statistik', path: '/services/admin', icon: Inbox },
        { label: 'Penugasan Statistician', path: '/services/tasks', icon: ClipboardList },
        { label: 'Workspace QA / Coach', path: '/workspace', icon: FileCheck }
      ]
    },
    {
      id: 'konten',
      title: 'Konten & AI Engine',
      icon: Target,
      items: [
        { label: 'Library Fundamental', path: '/fundamentals', icon: Target },
        { label: 'Galeri Talenta', path: '/gallery', icon: Video },
        { label: 'CMS Landing Page', path: '/admin/cms', icon: Layout },
        { label: 'Editor Prompt AI', path: '/admin/prompt-editor', icon: Bot }
      ]
    },
    {
      id: 'akses',
      title: 'Akses & Keamanan',
      icon: Shield,
      items: [
        { label: 'Manajemen Pengguna', path: '/admin/users', icon: UserCheck },
        { label: 'Peran & Matriks RBAC', path: '/admin/roles', icon: Shield }
      ]
    }
  ];

  // Helper to check active state
  const isItemActive = (path: string) => {
    if (path === '/admin/roles') {
      return location.pathname === '/admin/roles' || location.pathname === '/admin/rbac';
    }
    return location.pathname === path;
  };

  // Find active group index based on route
  const getActiveGroupIndexForPath = (path: string) => {
    for (let i = 0; i < menuGroups.length; i++) {
      if (menuGroups[i].items.some(item => isItemActive(item.path))) {
        return i;
      }
    }
    return 0;
  };

  const [activeGroupIndex, setActiveGroupIndex] = useState(() => getActiveGroupIndexForPath(location.pathname));

  // Sync active group index when path changes
  useEffect(() => {
    const matchIndex = getActiveGroupIndexForPath(location.pathname);
    setActiveGroupIndex(matchIndex);
  }, [location.pathname]);

  // Fetch pending badges
  useEffect(() => {
    if (!user || !can('approve_applications')) return;

    const fetchBadges = async () => {
      try {
        const claims = await claimService.getClaims();
        const pendingClaims = claims.filter(c => c.status === 'pending');
        setPendingClaimsCount(pendingClaims.length);

        const apps = await applicationService.getApplications('pending');
        setPendingAppsCount(apps.length);
      } catch (err) {
        console.error('Failed to load badges inside AdminLayout', err);
      }
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [user]);

  // Handle auto-collapse sidebar on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // run on mount
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdowns on route changes
  useEffect(() => {
    setIsMobileOpen(false);
    setIsAvatarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('hoopstats_admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    await authService.logout();
    window.location.assign('/');
  };

  // Helper for badges
  const getBadgeValue = (key?: 'claims' | 'applications') => {
    if (key === 'claims') return pendingClaimsCount > 0 ? pendingClaimsCount : undefined;
    if (key === 'applications') return pendingAppsCount > 0 ? pendingAppsCount : undefined;
    return undefined;
  };

  // Generate Breadcrumbs
  const getBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((part, index) => {
      const fullPath = '/' + parts.slice(0, index + 1).join('/');
      let label = part;
      
      if (fullPath === '/admin') label = 'Dashboard';
      else if (fullPath === '/fundamentals') label = 'Library Fundamental';
      else if (fullPath === '/admin/crm') label = 'CRM Prospek';
      else if (fullPath === '/admin/cms') label = 'CMS Landing Page';
      else if (fullPath === '/admin/prompt-editor') label = 'Editor Prompt AI';
      else if (fullPath === '/admin/roles' || fullPath === '/admin/rbac') label = 'Peran & Hak Akses';
      else if (fullPath === '/admin/users') label = 'Manajemen Pengguna';
      else if (fullPath === '/admin/applications') label = 'Persetujuan Peran';
      else if (fullPath === '/admin/claims') label = 'Klaim Atlet';
      else if (fullPath === '/admin/athletes') label = 'Atlet';
      else if (fullPath === '/services') label = 'Layanan';
      else if (fullPath === '/services/admin') label = 'Permintaan Statistik';
      else if (fullPath === '/services/tasks') label = 'Tugas Statistik';
      
      if (label === part) {
        label = part.charAt(0).toUpperCase() + part.slice(1);
      }
      
      return { label, path: fullPath };
    });
  };

  const breadcrumbs = getBreadcrumbs();
  const pageTitle = breadcrumbs[breadcrumbs.length - 1]?.label || 'HoopStats Admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = can('manage_users');

  // If NOT Admin, render page with standard AppShell (Standard consumer layout wrapper)
  if (!isAdmin) {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }

  // Sidebar Component for Desktop & Drawer Mobile
  const SidebarContent = () => {
    return (
      <div className="flex flex-col h-full bg-[#243440]/90 dark:bg-[#182630]/95 backdrop-blur-md text-slate-100 select-none border-r border-white/10">
        {/* Brand Logo Header & Toggle Button in Navigation Bar itself */}
        <div className={`p-4 flex items-center justify-between h-16 border-b border-white/10 ${isCollapsed ? 'justify-center px-2' : ''}`}>
          {!isCollapsed ? (
            <>
              <Link to="/admin" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center shrink-0 shadow-sm">
                  <svg className="w-5 h-5 text-white fill-white shrink-0" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" />
                    <path d="M6.2 6.2 C 9.5 9.5, 9.5 14.5, 6.2 17.8" fill="none" />
                    <path d="M17.8 6.2 C 14.5 9.5, 14.5 14.5, 17.8 17.8" fill="none" />
                    <path d="M2 12 H 22" fill="none" />
                    <path d="M12 2 V 22" fill="none" />
                  </svg>
                </div>
                <div>
                  <span className="text-base font-black text-white uppercase tracking-wider block leading-none">
                    HOOP<span className="text-amber-300">STATS</span>
                  </span>
                  <span className="text-[8px] bg-amber-300 text-slate-950 font-black px-1.5 py-0.2 rounded uppercase mt-0.5 inline-block tracking-wider">
                    SUPERADMIN
                  </span>
                </div>
              </Link>

              {/* Auto Hide Button inside Navigation Bar */}
              <button
                onClick={toggleSidebar}
                className="hidden md:flex p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/15"
                title="Minimize Navigation Bar"
              >
                <ChevronLeft size={16} />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-xl bg-amber-300 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-md flex items-center justify-center"
                title="Expand Navigation Bar"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Level 1 Primary Sidebar Navigation Only */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-3 space-y-2 scrollbar-none">
          {!isCollapsed && (
            <div className="text-[10px] font-black uppercase text-amber-300/80 tracking-wider px-3 mb-2">
              Modul Utama
            </div>
          )}
          {menuGroups.map((group, groupIndex) => {
            const Icon = group.icon;
            const isGroupActive = activeGroupIndex === groupIndex;
            // Target path: if user is on a path in this group, stay on that path; otherwise target first item
            const targetPath = group.items.some(i => isItemActive(i.path))
              ? location.pathname
              : group.items[0]?.path || '/admin';

            const shortName = group.id === 'utama' ? 'UTAMA' 
              : group.id === 'operasional' ? 'OPERASI' 
              : group.id === 'layanan' ? 'LAYANAN' 
              : group.id === 'konten' ? 'KONTEN' 
              : 'AKSES';

            return (
              <Link
                key={group.id}
                to={targetPath}
                onClick={() => {
                  setActiveGroupIndex(groupIndex);
                  setIsMobileOpen(false);
                }}
                className={`flex transition-all relative ${
                  isCollapsed
                    ? 'flex-col items-center justify-center py-2.5 px-1 rounded-[16px] text-center gap-1 min-h-[58px]'
                    : 'items-center gap-3 px-3.5 py-3 rounded-[18px] text-xs font-bold'
                } ${
                  isGroupActive
                    ? 'bg-white text-[#2B889B] dark:bg-zinc-800 dark:text-teal-400 font-black shadow-lg scale-[1.02]'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
                title={group.title}
              >
                <Icon size={18} className={`flex-shrink-0 ${isGroupActive ? 'text-[#2B889B] dark:text-teal-400' : 'text-slate-200'}`} />
                
                {/* Minimized label text underneath icon when collapsed */}
                {isCollapsed ? (
                  <span className="text-[9px] font-extrabold uppercase tracking-tight text-center leading-none text-slate-200 scale-95">
                    {shortName}
                  </span>
                ) : (
                  <span className="flex-1 truncate uppercase tracking-wider">{group.title}</span>
                )}

                {!isCollapsed && group.badgeCount && group.badgeCount > 0 ? (
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    isGroupActive ? 'bg-[#2B889B] text-white' : 'bg-amber-400 text-slate-950'
                  }`}>
                    {group.badgeCount}
                  </span>
                ) : null}

                {isCollapsed && group.badgeCount && group.badgeCount > 0 ? (
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-900" />
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* Footer info/controls */}
        <div className="p-2.5 space-y-1 border-t border-white/10">
          <Link
            to="/"
            className={`flex transition-all ${
              isCollapsed
                ? 'flex-col items-center justify-center p-2 rounded-[16px] text-center gap-1'
                : 'items-center gap-3 px-3.5 py-2.5 rounded-[18px] text-xs font-bold'
            } text-slate-200 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-wider`}
            title="Beranda Publik"
          >
            <Home size={16} />
            {isCollapsed ? (
              <span className="text-[8px] font-bold text-center leading-none">BERANDA</span>
            ) : (
              <span>Beranda Publik</span>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className={`w-full flex transition-all ${
              isCollapsed
                ? 'flex-col items-center justify-center p-2 rounded-[16px] text-center gap-1'
                : 'items-center gap-3 px-3.5 py-2.5 rounded-[18px] text-xs font-bold'
            } text-red-300 hover:text-white hover:bg-red-500/20 transition-colors cursor-pointer uppercase tracking-wider`}
            title="Keluar"
          >
            <LogOut size={16} />
            {isCollapsed ? (
              <span className="text-[8px] font-bold text-center leading-none">KELUAR</span>
            ) : (
              <span>Keluar</span>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E2D38] via-[#283C4A] to-[#1C3A42] text-zinc-900 dark:text-zinc-100 flex overflow-hidden p-0 sm:p-2 md:p-3">
      {/* Sidebar Desktop */}
      <aside 
        className={`hidden md:flex md:flex-col h-[calc(100vh-1.5rem)] flex-shrink-0 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col h-screen md:h-[calc(100vh-1.5rem)] overflow-hidden">
        {/* Header Bar */}
        <header className="bg-[#243440]/80 dark:bg-[#182630]/90 backdrop-blur-md z-30 shrink-0 border-b border-white/10">
          <div className="h-14 px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileOpen(true)}
                className="md:hidden p-2 rounded-full bg-white/10 text-white cursor-pointer"
              >
                <Menu size={18} />
              </button>

              {/* Module Brand / Context indicator */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-300/20 text-amber-300 flex items-center justify-center font-black text-xs border border-amber-300/30">
                  <Shield size={14} />
                </div>
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  {menuGroups[activeGroupIndex]?.title || 'HoopStats Admin'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Superadmin pill tag */}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-amber-300 text-slate-950 text-[10px] font-black rounded-full uppercase tracking-wider shadow-sm">
                <Shield size={12} /> Mode Superadmin
              </span>

              {/* Profile Avatar */}
              <div className="relative">
                <button
                  onClick={() => setIsAvatarOpen(!isAvatarOpen)}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 p-1.5 rounded-full transition-all cursor-pointer text-white"
                >
                  <div className="w-7 h-7 rounded-full bg-amber-300 text-slate-950 font-black flex items-center justify-center text-xs">
                    {user.name.charAt(0)}
                  </div>
                </button>

                <AnimatePresence>
                  {isAvatarOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-11 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 space-y-3 z-50 text-left"
                    >
                      <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Akun Admin</div>
                        <div className="text-sm font-black text-zinc-950 dark:text-white mt-1 leading-tight">{user.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5 truncate">{user.email}</div>
                      </div>
                      <div className="space-y-1">
                        <Link
                          to="/fundamentals"
                          onClick={() => setIsAvatarOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <Target size={14} className="text-amber-500" />
                          Library Fundamental
                        </Link>
                        <Link
                          to="/"
                          onClick={() => setIsAvatarOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <Home size={14} />
                          Kembali ke Beranda
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left cursor-pointer"
                        >
                          <LogOut size={14} />
                          Keluar dari Sistem
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Level 2 Submenu Horizontal Text Tabs Navigation */}
          <div className="px-4 sm:px-6 flex items-center gap-6 overflow-x-auto scrollbar-none border-t border-white/10 pt-1">
            {menuGroups[activeGroupIndex]?.items.map((item, itemIndex) => {
              const active = isItemActive(item.path);
              const badgeValue = getBadgeValue(item.badgeKey);

              return (
                <Link
                  key={itemIndex}
                  to={item.path}
                  className={`py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                    active
                      ? 'text-amber-300 font-extrabold border-amber-300'
                      : 'text-slate-200/80 hover:text-white font-semibold border-transparent'
                  }`}
                >
                  <span>{item.label}</span>
                  {badgeValue !== undefined && (
                    <span className={`px-1.5 py-0.2 text-[9px] font-black rounded-full ${
                      active ? 'bg-amber-300 text-slate-950' : 'bg-white/20 text-white'
                    }`}>
                      {badgeValue}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </header>

        {/* Floating Rounded Canvas Container */}
        <main className="flex-1 bg-[#FAF9F5] dark:bg-[#121920] rounded-t-[28px] md:rounded-[32px] p-4 sm:p-6 md:p-8 overflow-y-auto shadow-2xl border border-white/30 dark:border-zinc-800/80 relative mb-0 md:mb-2 mr-0 md:mr-2">
          <Outlet />
        </main>
      </div>

      {/* Admin Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#3D5A6C]/95 dark:bg-[#1C2B35]/95 backdrop-blur-md border-t border-white/15 flex justify-around items-center h-16 z-40 px-2 md:hidden text-white shadow-2xl">
        <button
          onClick={() => navigate('/admin')}
          className={`flex flex-col items-center justify-center w-14 h-12 cursor-pointer transition-colors ${
            location.pathname === '/admin' ? 'text-amber-300 font-black' : 'text-slate-200 hover:text-white'
          }`}
        >
          <Layout size={18} />
          <span className="text-[9px] mt-1 font-bold uppercase tracking-tight">Admin</span>
        </button>

        <button
          onClick={() => navigate('/admin/claims')}
          className={`flex flex-col items-center justify-center w-14 h-12 relative cursor-pointer transition-colors ${
            location.pathname.startsWith('/admin/claims') || location.pathname.startsWith('/admin/applications') 
              ? 'text-amber-300 font-black' 
              : 'text-slate-200 hover:text-white'
          }`}
        >
          <FileCheck size={18} />
          <span className="text-[9px] mt-1 font-bold uppercase tracking-tight">Klaim</span>
          {(pendingClaimsCount + pendingAppsCount) > 0 && (
            <span className="absolute top-1 right-1 bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
              {pendingClaimsCount + pendingAppsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/fundamentals')}
          className={`flex flex-col items-center justify-center w-14 h-12 cursor-pointer transition-colors ${
            location.pathname.startsWith('/fundamentals') ? 'text-amber-300 font-black' : 'text-slate-200 hover:text-white'
          }`}
        >
          <Target size={18} />
          <span className="text-[9px] mt-1 font-bold uppercase tracking-tight">Drill</span>
        </button>

        <button
          onClick={() => navigate('/services/admin')}
          className={`flex flex-col items-center justify-center w-14 h-12 cursor-pointer transition-colors ${
            location.pathname.startsWith('/services') ? 'text-amber-300 font-black' : 'text-slate-200 hover:text-white'
          }`}
        >
          <Inbox size={18} />
          <span className="text-[9px] mt-1 font-bold uppercase tracking-tight">Order</span>
        </button>

        <button
          onClick={() => setIsMobileOpen(true)}
          className={`flex flex-col items-center justify-center w-14 h-12 cursor-pointer transition-colors ${
            isMobileOpen ? 'text-amber-300 font-black' : 'text-slate-200 hover:text-white'
          }`}
        >
          <Menu size={18} />
          <span className="text-[9px] mt-1 font-bold uppercase tracking-tight">Menu</span>
        </button>
      </nav>

      {/* Mobile Sidebar Overlay Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 w-72 bg-[#3D5A6C] dark:bg-[#1C2B35] z-50 md:hidden flex flex-col h-full shadow-2xl"
            >
              <div className="absolute top-4 right-4 z-50">
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
