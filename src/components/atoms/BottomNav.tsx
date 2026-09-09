import React, { useState, useEffect } from 'react';
import { Home, Calendar, User, BarChart2, UsersRound, Brain, Youtube, ClipboardList, Menu, X, Settings, LogOut, Users, FileText, UserCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService';
import { claimService } from '../../services/claimService';
import { motion, AnimatePresence } from 'motion/react';
import { usePermissions } from '../../core/contexts/PermissionsContext';
import { Permission } from '../../core/config/permissions';
import { CONSUMER_NAV_ITEMS } from '../../widgets/app-shell/AppShell';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, can, loading } = usePermissions();
  const [showMore, setShowMore] = useState(false);
  const [claimBadge, setClaimBadge] = useState(0);

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

  if (loading || !user || can('manage_users')) return null;

  const handleLogout = async () => {
    await authService.logout();
    navigate('/welcome');
  };

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label, onClick }: { path: string, icon: any, label: string, onClick?: () => void }) => {
    const active = isActive(path) && !showMore && !onClick;
    const isMoreActive = showMore && onClick;
    
    const handleTap = () => {
      if (onClick) {
        onClick();
      } else {
        setShowMore(false);
        navigate(path);
      }
    };

    return (
      <button 
        onClick={handleTap}
        className="flex flex-col items-center justify-center w-16 h-12 relative flex-shrink-0 cursor-pointer animate-none"
      >
        <Icon 
          size={20} 
          className={`mb-0.5 transition-colors ${active || isMoreActive ? 'text-brand-navy dark:text-brand-orange' : 'text-zinc-400 dark:text-zinc-500'}`} 
          fill={(active || isMoreActive) ? "currentColor" : "none"}
          strokeWidth={(active || isMoreActive) ? 2.5 : 2}
        />
        <span className={`text-[10px] font-bold tracking-tight uppercase ${active || isMoreActive ? 'text-brand-navy dark:text-brand-orange' : 'text-zinc-400 dark:text-zinc-500'}`}>
          {label}
        </span>
      </button>
    );
  };

  const MoreItem = ({ path, icon: Icon, label, onClick, className = '' }: { path: string, icon: any, label: string, onClick?: () => void, className?: string }) => {
    const active = isActive(path);
    const handleTap = () => {
      setShowMore(false);
      if (onClick) {
        onClick();
      } else {
        navigate(path);
      }
    };

    const hasBadge = label === 'Klaim Saya' && claimBadge > 0;

    return (
      <button 
        onClick={handleTap}
        className={`w-full flex items-center justify-between p-4 rounded-xl mb-2 transition-colors cursor-pointer text-left ${active ? 'bg-brand-navy text-brand-orange dark:bg-brand-orange dark:text-brand-navy' : 'bg-[#F4F4F5] dark:bg-zinc-800/50 text-[#1A1A1A] dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'} ${className}`}
      >
        <div className="flex items-center gap-3">
          <Icon size={20} strokeWidth={active ? 2.5 : 2} />
          <span className="font-bold text-sm">{label}</span>
        </div>
        {hasBadge && (
          <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full animate-pulse">
            {claimBadge}
          </span>
        )}
      </button>
    );
  };

  // Build items based on Persona using single source of truth CONSUMER_NAV_ITEMS
  const allowedItems = CONSUMER_NAV_ITEMS.filter(item => {
    if (item.path === '/workspace') {
      return can('do_stat_tasks') || can('do_qa_review') || can('do_coach_analysis');
    }
    return can(item.permission);
  });

  let bottomItems: { path: string; icon: any; label: string; onClick?: () => void }[] = [];
  let sheetItems: { path: string; icon: any; label: string; onClick?: () => void }[] = [];
  let sheetTitle = "Menu Lainnya";

  if (allowedItems.length > 4) {
    // If we have more than 4 items, show first 4 on bar and rest on sheet (customer persona)
    bottomItems = allowedItems.slice(0, 4);
    sheetItems = allowedItems.slice(4);
    sheetTitle = "Lainnya";
  } else {
    bottomItems = allowedItems;
    sheetItems = [];
    sheetTitle = user.role === 'scout' ? "Akun" : "Menu";
  }

  return (
    <>
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMore(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-16 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-3xl p-6 z-[45] shadow-2xl border-t border-zinc-100 dark:border-zinc-800 max-w-md mx-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display font-black italic text-lg uppercase tracking-tight text-[#1A1A1A] dark:text-white">{sheetTitle}</h3>
                <button onClick={() => setShowMore(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
              <div className="flex flex-col">
                {sheetItems.map(item => (
                  <MoreItem 
                    key={item.path} 
                    path={item.path} 
                    icon={item.icon} 
                    label={item.label} 
                  />
                ))}
                
                <MoreItem 
                  path="#" 
                  icon={LogOut} 
                  label="Keluar / Logout" 
                  onClick={handleLogout} 
                  className="mt-2 text-red-600 dark:text-red-400 font-extrabold"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-zinc-100 dark:border-zinc-800 flex justify-around items-center h-16 pb-safe transition-colors z-50 px-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] md:hidden">
        {bottomItems.map(item => (
          <NavItem 
            key={item.path} 
            path={item.path} 
            icon={item.icon} 
            label={item.label} 
          />
        ))}

        {user.role === 'scout' ? (
          <NavItem 
            path="#" 
            icon={UserCircle} 
            label="Akun" 
            onClick={() => setShowMore(!showMore)} 
          />
        ) : sheetItems.length > 0 ? (
          <div className="relative">
            <NavItem 
              path="#" 
              icon={Menu} 
              label="Lainnya" 
              onClick={() => setShowMore(!showMore)} 
            />
            {claimBadge > 0 && (
              <span className="absolute top-1 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
        ) : (
          <NavItem 
            path="#" 
            icon={LogOut} 
            label="Keluar" 
            onClick={handleLogout} 
          />
        )}
      </nav>
    </>
  );
};
