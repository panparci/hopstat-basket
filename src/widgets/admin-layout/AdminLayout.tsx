import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Outlet, Navigate } from 'react-router-dom';
import { 
  Menu, X, ChevronLeft, ChevronRight, LogOut, Home, 
  FileCheck, UserPlus, Users, Inbox, ClipboardList, Layout, Bot, UserCheck, Shield, Lock, Bell, Contact, Trophy, Video, Target, Database, AlertCircle
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
        { label: 'Tim & Atlet', path: '/profiles', icon: Users },
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
        { label: 'Master Data & Golden Record', path: '/admin/master-data', icon: Database },
        { label: 'Pisahkan Laga Profil', path: '/admin/match-exclusions', icon: AlertCircle },
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

  // Keep full admin chrome in the mobile WebView — stripping it left pages without nav.
  // Expo Stack header is hidden for /admin* in hopstat-mobile web.tsx instead.

  const isAdmin = can('manage_users');

  // If NOT Admin, render page with standard AppShell (Standard consumer layout wrapper)
  if (!isAdmin) {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }

  // Desktop rail may collapse; mobile drawer is always expanded (collapsed+white active = unreadable labels).
  const SidebarContent = ({ mode }: { mode: 'rail' | 'drawer' }) => {
    const railCollapsed = mode === 'rail' && isCollapsed;
    return (
      <div className="flex flex-col h-full bg-[#1C2B35] text-slate-100 select-none border-r border-white/10">
        <div className={`pt-safe flex items-center justify-between h-16 border-b border-white/10 shrink-0 ${railCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          {!railCollapsed ? (
            <>
              <Link to="/admin" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-amber-300" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-black text-white uppercase tracking-wider block leading-none truncate">
                    HOOP<span className="text-amber-300">STATS</span>
                  </span>
                  <span className="text-[8px] bg-amber-300 text-slate-950 font-black px-1.5 py-0.5 rounded uppercase mt-0.5 inline-block tracking-wider">
                    SUPERADMIN
                  </span>
                </div>
              </Link>
              {mode === 'rail' ? (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="hidden md:flex p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/15"
                  title="Minimize Navigation Bar"
                >
                  <ChevronLeft size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="p-2 rounded-xl bg-white/10 text-white"
                  aria-label="Tutup menu"
                >
                  <X size={18} />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1.5 rounded-xl bg-amber-300 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-md flex items-center justify-center"
              title="Expand Navigation Bar"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 scrollbar-none">
          {!railCollapsed && (
            <div className="text-[10px] font-black uppercase text-amber-300/80 tracking-wider px-3 mb-2">
              Modul Utama
            </div>
          )}
          {menuGroups.map((group, groupIndex) => {
            const Icon = group.icon;
            const isGroupActive = activeGroupIndex === groupIndex;
            const targetPath = group.items.some((i) => isItemActive(i.path))
              ? location.pathname
              : group.items[0]?.path || '/admin';

            const shortName =
              group.id === 'utama' ? 'UTAMA'
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
                className={`flex relative transition-colors ${
                  railCollapsed
                    ? 'flex-col items-center justify-center py-2.5 px-1 rounded-2xl text-center gap-1 min-h-[58px]'
                    : 'items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold'
                } ${
                  isGroupActive
                    ? 'bg-amber-300 text-slate-950 font-black shadow-md'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
                title={group.title}
              >
                <Icon
                  size={18}
                  className={`flex-shrink-0 ${isGroupActive ? 'text-slate-950' : 'text-slate-200'}`}
                />
                {railCollapsed ? (
                  <span className={`text-[9px] font-extrabold uppercase tracking-tight text-center leading-none scale-95 ${
                    isGroupActive ? 'text-slate-950' : 'text-slate-200'
                  }`}>
                    {shortName}
                  </span>
                ) : (
                  <span className="flex-1 truncate uppercase tracking-wider">{group.title}</span>
                )}

                {!railCollapsed && group.badgeCount && group.badgeCount > 0 ? (
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    isGroupActive ? 'bg-slate-950 text-amber-300' : 'bg-amber-400 text-slate-950'
                  }`}>
                    {group.badgeCount}
                  </span>
                ) : null}

                {railCollapsed && group.badgeCount && group.badgeCount > 0 ? (
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-900" />
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="p-2.5 space-y-1 border-t border-white/10 pb-safe">
          {!railCollapsed && (
            <div className="px-3.5 py-2 mb-1 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-[9px] font-black uppercase tracking-wider text-amber-300/80">Akun</div>
              <div className="text-xs font-bold text-white truncate mt-0.5">{user.name}</div>
              <div className="text-[10px] text-slate-300/80 truncate">{user.email}</div>
            </div>
          )}
          <Link
            to="/"
            onClick={() => setIsMobileOpen(false)}
            className={`flex transition-colors ${
              railCollapsed
                ? 'flex-col items-center justify-center p-2 rounded-2xl text-center gap-1'
                : 'items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold'
            } ${
              location.pathname === '/'
                ? 'bg-white/15 text-white'
                : 'text-slate-200 hover:text-white hover:bg-white/10'
            } uppercase tracking-wider`}
            title="Beranda Publik"
          >
            <Home size={16} />
            {railCollapsed ? (
              <span className="text-[8px] font-bold text-center leading-none">BERANDA</span>
            ) : (
              <span>Beranda Publik</span>
            )}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex transition-colors ${
              railCollapsed
                ? 'flex-col items-center justify-center p-2 rounded-2xl text-center gap-1'
                : 'items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold'
            } text-red-300 hover:text-white hover:bg-red-500/20 cursor-pointer uppercase tracking-wider`}
            title="Keluar"
          >
            <LogOut size={16} />
            {railCollapsed ? (
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
    <div className="min-h-[100dvh] max-w-[100vw] overflow-x-hidden bg-[#FAF9F5] dark:bg-[#121920] text-zinc-900 dark:text-zinc-100 flex md:bg-gradient-to-br md:from-[#1E2D38] md:via-[#283C4A] md:to-[#1C3A42] md:p-3">
      {/* Sidebar Desktop */}
      <aside
        className={`hidden md:flex md:flex-col h-[calc(100dvh-1.5rem)] flex-shrink-0 transition-all duration-300 rounded-2xl overflow-hidden border border-white/10 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <SidebarContent mode="rail" />
      </aside>

      {/* Main Panel — solid fullscreen on phone (no floating card / no “ngambang”) */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 h-[100dvh] md:h-[calc(100dvh-1.5rem)] overflow-hidden">
        <header className="bg-[#1C2B35] z-30 shrink-0 border-b border-white/10 pt-safe">
          {/* Phone: title only — Menu tab + drawer hold hamburger/akun (no floating chrome) */}
          <div className="h-12 md:h-14 px-3 sm:px-6 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-amber-300/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/30">
                <Shield size={14} />
              </div>
              <span className="text-xs font-black text-white uppercase tracking-wider truncate">
                {menuGroups[activeGroupIndex]?.title || 'HoopStats Admin'}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-300 text-slate-950 text-[10px] font-black rounded-full uppercase tracking-wider shadow-sm">
                <Shield size={12} /> Mode Superadmin
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAvatarOpen(!isAvatarOpen)}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 p-1.5 rounded-full transition-all cursor-pointer text-white"
                  aria-label="Akun admin"
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
                      className="absolute right-0 top-11 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 space-y-3 z-50 text-left"
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
                          type="button"
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

          {/* Level 2 tabs — intentional horizontal scroll */}
          <div className="px-3 sm:px-6 flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none border-t border-white/10">
            {menuGroups[activeGroupIndex]?.items.map((item, itemIndex) => {
              const active = isItemActive(item.path);
              const badgeValue = getBadgeValue(item.badgeKey);
              return (
                <Link
                  key={itemIndex}
                  to={item.path}
                  className={`py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-2 whitespace-nowrap transition-colors border-b-2 shrink-0 ${
                    active
                      ? 'text-amber-300 font-extrabold border-amber-300'
                      : 'text-slate-200/80 hover:text-white font-semibold border-transparent'
                  }`}
                >
                  <span>{item.label}</span>
                  {badgeValue !== undefined && (
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-full ${
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

        {/* Tab bar clearance matches native app (~62px + home indicator), not a huge empty void */}
        <main className="flex-1 min-h-0 bg-[#EEF1F5] dark:bg-[#121920] px-3 pt-3 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden relative md:rounded-[32px] md:bg-[#FAF9F5] md:border md:border-white/30 md:dark:border-zinc-800/80 md:shadow-2xl md:mb-2 md:mr-2 pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Native-style bottom tabs (same idea as mobile Home/Teams/Games bar) */}
      {/* Same navy as admin header/sidebar — amber active (not consumer white tabs) */}
      <nav
        data-hoopstat-admin-nav="1"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#1C2B35]/98 backdrop-blur-md border-t border-white/10 pb-safe"
      >
        <div className="flex h-[62px] items-stretch justify-around px-1 pt-1">
          {([
            { label: 'Admin', icon: Layout, go: () => navigate('/admin'), on: location.pathname === '/admin' },
            {
              label: 'Klaim',
              icon: FileCheck,
              go: () => navigate('/admin/claims'),
              on: location.pathname.startsWith('/admin/claims') || location.pathname.startsWith('/admin/applications'),
              badge: pendingClaimsCount + pendingAppsCount,
            },
            { label: 'Drill', icon: Target, go: () => navigate('/fundamentals'), on: location.pathname.startsWith('/fundamentals') },
            { label: 'Order', icon: Inbox, go: () => navigate('/services/admin'), on: location.pathname.startsWith('/services') },
            { label: 'Menu', icon: Menu, go: () => setIsMobileOpen(true), on: isMobileOpen },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            const badge = 'badge' in tab ? tab.badge : 0;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={tab.go}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                  tab.on ? 'text-amber-300 font-semibold' : 'text-slate-400'
                }`}
              >
                <Icon size={22} strokeWidth={tab.on ? 2.4 : 2} />
                <span className="text-[11px] leading-none uppercase tracking-tight">{tab.label}</span>
                {!!badge && badge > 0 && (
                  <span className="absolute top-1 right-[18%] min-w-[16px] h-4 px-1 rounded-full bg-amber-300 text-slate-950 text-[9px] font-black flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 w-[min(20rem,88vw)] z-50 md:hidden flex flex-col h-full shadow-2xl overflow-hidden"
            >
              <SidebarContent mode="drawer" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
