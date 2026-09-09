import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { 
  Home, Calendar, BarChart2, User, UsersRound, Brain, Youtube, 
  FileText, Users, ClipboardList, Menu, X, LogOut, Sun, Moon,
  ChevronDown, Trophy, UserCircle, Bell, Award, Target,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePermissions } from '../../core/contexts/PermissionsContext';
import { authService } from '../../services/authService';
import { claimService } from '../../services/claimService';
import { useTheme } from '../../core/hooks/useTheme';
import { BottomNav } from '../../components/atoms/BottomNav';
import { Avatar } from '../../shared/ui/Avatar';

export interface NavItemType {
  path: string;
  icon: React.ComponentType<any>;
  label: string;
  permission: any; // Using dynamic check or string
}

export const CONSUMER_NAV_ITEMS: NavItemType[] = [
  { path: '/', icon: Home, label: 'Beranda', permission: 'view_home' },
  { path: '/gallery', icon: Users, label: 'Katalog Talenta', permission: 'view_gallery' },
  { path: '/games', icon: Calendar, label: 'Pertandingan', permission: 'view_matches' },
  { path: '/stats', icon: BarChart2, label: 'Statistik', permission: 'view_own_stats' },
  { path: '/fundamentals', icon: Target, label: 'Latihan & Drill', permission: 'view_home' },
  { path: '/profiles', icon: User, label: 'Atlet Saya', permission: 'manage_profiles' },
  { path: '/services', icon: Youtube, label: 'Pesan Statistik', permission: 'request_stats' },
  { path: '/workspace', icon: ClipboardList, label: 'Ruang Kerja', permission: 'do_stat_tasks' },
];

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, can, loading } = usePermissions();
  const { theme, toggleTheme } = useTheme();

  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [claimBadge, setClaimBadge] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('hoopstats_consumer_sidebar_collapsed');
    return saved === 'true';
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchClaimBadge = async () => {
    try {
      const activeUser = await authService.getCurrentUser();
      if (!activeUser) return;
      
      const userClaims = await claimService.getClaims();
      const myClaims = userClaims.filter(c => c.claimantAccountId === activeUser.id);
      
      let unread = 0;
      myClaims.forEach(claim => {
        const lastSeen = localStorage.getItem(`claim_seen_${claim.id}`);
        if (!lastSeen || claim.updatedAt > parseInt(lastSeen, 10)) {
          if (claim.status !== 'pending') {
            unread++;
          }
        }
      });
      setClaimBadge(unread);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClaimBadge();
    
    const handleClaimsRead = () => {
      setClaimBadge(0);
    };
    window.addEventListener('claims_read', handleClaimsRead);
    return () => {
      window.removeEventListener('claims_read', handleClaimsRead);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAvatarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1E2D38]">
        <div className="w-8 h-8 border-4 border-amber-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await authService.logout();
    window.location.assign('/');
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Filter allowed items based on permission
  const allowedItems = CONSUMER_NAV_ITEMS.filter(item => {
    if (item.path === '/workspace') {
      return can('do_stat_tasks') || can('do_qa_review') || can('do_coach_analysis');
    }
    return can(item.permission);
  });

  // Level 2 Subtabs configuration for Level 1 modules
  const getSubTabs = () => {
    if (location.pathname.startsWith('/profiles')) {
      return [
        { label: 'Profil Atlet Saya', path: '/profiles' },
        { label: 'Tim Saya', path: '/profiles?tab=teams' },
        { label: 'Status Klaim', path: '/profiles?tab=claim' },
      ];
    }
    if (location.pathname.startsWith('/stats') || location.pathname.startsWith('/ai-coach')) {
      return [
        { label: 'Statistik Atlet', path: '/stats' },
        { label: 'Rekan Tim', path: '/stats?tab=teammates' },
        { label: 'AI Coach Analysis', path: '/stats?tab=aicoach' },
      ];
    }
    if (location.pathname.startsWith('/workspace')) {
      return [
        { label: 'Penugasan Recording', path: '/workspace' },
        { label: 'Review QA', path: '/workspace?tab=qa' },
        { label: 'Analisis Pelatih', path: '/workspace?tab=coach' },
      ];
    }
    return [];
  };

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('hoopstats_consumer_sidebar_collapsed', String(next));
      return next;
    });
  };

  const currentSubTabs = getSubTabs();
  const currentNav = allowedItems.find(item => isActive(item.path));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E2D38] via-[#283C4A] to-[#1C3A42] text-zinc-900 dark:text-zinc-100 flex font-sans p-0 sm:p-2 md:p-3 overflow-hidden">
      
      {/* SIDEBAR FOR DESKTOP & TABLET */}
      <aside className={`hidden md:flex flex-col h-[calc(100vh-1.5rem)] flex-shrink-0 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-60'
      } select-none z-40 text-slate-100 bg-[#243440]/90 dark:bg-[#182630]/95 backdrop-blur-md rounded-2xl border border-white/10 mr-1`}>
        {/* Brand Header with Auto Hide Toggle */}
        <div className={`p-4 flex items-center justify-between h-16 border-b border-white/10 ${isCollapsed ? 'justify-center px-2' : ''}`}>
          {!isCollapsed ? (
            <>
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center shrink-0 shadow-sm">
                  <svg className="w-5 h-5 text-white fill-white shrink-0" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" />
                    <path d="M6.2 6.2 C 9.5 9.5, 9.5 14.5, 6.2 17.8" fill="none" />
                    <path d="M17.8 6.2 C 14.5 9.5, 14.5 14.5, 17.8 17.8" fill="none" />
                    <path d="M2 12 H 22" fill="none" />
                    <path d="M12 2 V 22" fill="none" />
                  </svg>
                </div>
                <span className="text-base font-black text-white uppercase tracking-wider">
                  HOOP<span className="text-amber-300">STATS</span>
                </span>
              </Link>
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/15"
                title="Minimize Navigation Bar"
              >
                <ChevronLeft size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-xl bg-amber-300 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-md flex items-center justify-center"
              title="Expand Navigation Bar"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-3 space-y-2 scrollbar-none">
          {allowedItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const hasBadge = item.label === 'Klaim Saya' && claimBadge > 0;

            const shortLabel = item.label === 'Beranda' ? 'BERANDA'
              : item.label === 'Atlet Saya' ? 'ATLET'
              : item.label === 'Statistik' ? 'STATS'
              : item.label === 'Pertandingan' ? 'GAMES'
              : item.label === 'Katalog Talenta' ? 'KATALOG'
              : item.label === 'Latihan & Drill' ? 'DRILL'
              : item.label === 'Pesanan Saya' ? 'PESANAN'
              : item.label === 'Workspace' ? 'WORK'
              : item.label.toUpperCase();

            return (
              <Link
                key={index}
                to={item.path}
                className={`flex transition-all relative ${
                  isCollapsed
                    ? 'flex-col items-center justify-center py-2.5 px-1 rounded-[16px] text-center gap-1 min-h-[58px]'
                    : 'items-center gap-3 px-3.5 py-3 rounded-[18px] text-xs font-bold'
                } ${
                  active
                    ? 'bg-white text-[#2B889B] dark:bg-zinc-800 dark:text-teal-400 font-extrabold shadow-lg scale-[1.02]'
                    : 'text-slate-200/90 hover:text-white hover:bg-white/10 font-medium'
                }`}
                title={item.label}
              >
                <Icon size={18} className={`flex-shrink-0 ${active ? 'text-[#2B889B] dark:text-teal-400' : 'text-slate-200'}`} />
                
                {isCollapsed ? (
                  <span className="text-[9px] font-extrabold uppercase tracking-tight text-center leading-none text-slate-200 scale-95">
                    {shortLabel}
                  </span>
                ) : (
                  <span className="truncate text-xs uppercase tracking-wider">{item.label}</span>
                )}

                {hasBadge && (
                  <span className={isCollapsed ? 'absolute top-1 right-1 bg-amber-400 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center' : 'ml-auto bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full'}>
                    {claimBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-2.5 space-y-1 border-t border-white/10">
          <button
            onClick={handleLogout}
            className={`w-full flex transition-all ${
              isCollapsed
                ? 'flex-col items-center justify-center p-2 rounded-[16px] text-center gap-1'
                : 'items-center gap-3 px-3.5 py-2.5 rounded-[18px] text-xs font-bold'
            } text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer uppercase tracking-wider`}
            title="Keluar"
          >
            <LogOut size={16} className="text-slate-300" />
            {isCollapsed ? (
              <span className="text-[8px] font-bold text-center leading-none">KELUAR</span>
            ) : (
              <span>Keluar</span>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SPACE & HEADER */}
      <div className="flex-1 flex flex-col min-w-0 h-screen md:h-[calc(100vh-1.5rem)] overflow-hidden">
        
        {/* DESKTOP/TABLET UPPER HEADER */}
        <header className="hidden md:flex flex-col bg-[#243440]/80 dark:bg-[#182630]/90 backdrop-blur-md z-30 shrink-0 border-b border-white/10">
          <div className="h-14 px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-300 uppercase tracking-widest">
                  {currentNav?.label || 'HOOPSTATS'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme} 
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer border border-white/15"
                title="Ganti Tema"
              >
                {theme === 'dark' ? <Sun size={16} className="text-amber-300" /> : <Moon size={16} className="text-white" />}
              </button>

              {/* Notification Bell */}
              <button className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors relative border border-white/15" title="Notifikasi">
                <Bell size={16} className="text-white" />
                {claimBadge > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-400 border-2 border-[#3D5A6C] rounded-full animate-pulse" />
                )}
              </button>

              {/* User Profile Pill */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsAvatarOpen(!isAvatarOpen)}
                  className="flex items-center gap-2.5 bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-1.5 rounded-full transition-all cursor-pointer text-left text-white"
                >
                  <Avatar name={user.name} photoUrl={user.avatar} size="sm" />
                  <span className="text-xs font-bold hidden lg:inline max-w-[120px] truncate">{user.name}</span>
                  <ChevronDown size={14} className="text-slate-300 hidden lg:block" />
                </button>

                <AnimatePresence>
                  {isAvatarOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-12 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 space-y-3 z-50 text-left"
                    >
                      <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Akun Pengguna</div>
                        <div className="text-sm font-black text-zinc-950 dark:text-white mt-1 leading-tight">{user.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5 truncate">{user.email}</div>
                        <div className="inline-block mt-1.5 px-2 py-0.5 text-[9px] font-bold bg-[#2B889B]/10 text-[#2B889B] dark:text-teal-400 rounded uppercase">
                          {user.role}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Link
                          to="/profiles"
                          onClick={() => setIsAvatarOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <UserCircle size={14} className="text-[#2B889B]" />
                          Profil Akun
                        </Link>
                        {can('manage_users') && (
                          <>
                            <Link
                              to="/admin"
                              onClick={() => setIsAvatarOpen(false)}
                              className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                            >
                              <Award size={14} className="text-amber-500" />
                              Dashboard Admin
                            </Link>
                            <Link
                              to="/fundamentals"
                              onClick={() => setIsAvatarOpen(false)}
                              className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                            >
                              <Target size={14} className="text-amber-500" />
                              Library Fundamental
                            </Link>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setIsAvatarOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left cursor-pointer"
                        >
                          <LogOut size={14} className="text-red-500" />
                          Keluar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Level 2 Submenu Horizontal Text Tabs Navigation (Only if subtabs exist) */}
          {currentSubTabs.length > 0 && (
            <div className="px-4 sm:px-6 flex items-center gap-6 overflow-x-auto scrollbar-none border-t border-white/10 pt-1">
              {currentSubTabs.map((tab, idx) => {
                const active = location.pathname + location.search === tab.path || (location.search === '' && tab.path === location.pathname);

                return (
                  <Link
                    key={idx}
                    to={tab.path}
                    className={`py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                      active
                        ? 'text-amber-300 font-extrabold border-amber-300'
                        : 'text-slate-200/80 hover:text-white font-semibold border-transparent'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </header>

        {/* EMBEDDED CURVED CANVAS CONTAINER */}
        <main className="flex-1 w-full bg-[#FAF9F5] dark:bg-[#121920] rounded-t-[28px] md:rounded-[32px] p-4 sm:p-6 md:p-8 overflow-y-auto shadow-2xl border border-white/30 dark:border-zinc-800/80 text-zinc-900 dark:text-zinc-100 relative mb-0 md:mb-2 mr-0 md:mr-2">
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="md:hidden">
        <BottomNav />
      </div>

    </div>
  );
};

export const AppShellLayout: React.FC = () => {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

