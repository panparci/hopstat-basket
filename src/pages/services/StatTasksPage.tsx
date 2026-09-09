import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/organisms/Layout';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { useNavigate } from 'react-router-dom';
import { requestService } from '../../services/requestService';
import { authService } from '../../services/authService';
import { StatServiceRequest, UserAccount } from '../../core/types/serviceRequests';
import { Play, ClipboardList, CheckCircle, Hand, LogOut, Inbox } from 'lucide-react';
import { usePermissions } from '../../core/contexts/PermissionsContext';

const RequestDetailsSummary: React.FC<{ task: StatServiceRequest }> = ({ task }) => {
  return (
    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {task.eventName && (
          <div>
            <span className="font-semibold block text-[10px] text-zinc-400 uppercase tracking-widest">Event</span>
            <span className="font-medium">{task.eventName}</span>
          </div>
        )}
        {task.matchDate && (
          <div>
            <span className="font-semibold block text-[10px] text-zinc-400 uppercase tracking-widest">Tanggal</span>
            <span className="font-medium">{new Date(task.matchDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        )}
        {task.venue && (
          <div>
            <span className="font-semibold block text-[10px] text-zinc-400 uppercase tracking-widest">Venue</span>
            <span className="font-medium">{task.venue}</span>
          </div>
        )}
        {task.ageCategory !== undefined && (
          <div>
            <span className="font-semibold block text-[10px] text-zinc-400 uppercase tracking-widest">Kategori Umur</span>
            <span className="font-medium">KU-{task.ageCategory}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div>
          <span className="font-semibold block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">{task.homeTeamName} Roster</span>
          {task.homeRoster && task.homeRoster.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {task.homeRoster.map((player, idx) => (
                <span key={idx} className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-medium font-mono">
                  #{player.jersey} {player.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="italic text-zinc-400">Roster kosong</span>
          )}
        </div>
        <div>
          <span className="font-semibold block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">{task.awayTeamName} Roster</span>
          {task.awayRoster && task.awayRoster.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {task.awayRoster.map((player, idx) => (
                <span key={idx} className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-medium font-mono">
                  #{player.jersey} {player.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="italic text-zinc-400">Roster kosong</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const StatTasksPage: React.FC = () => {
  const { can } = usePermissions();
  const [tasks, setTasks] = useState<StatServiceRequest[]>([]);
  const [availableTasks, setAvailableTasks] = useState<StatServiceRequest[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [user, setUser] = useState<UserAccount | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    if (currentUser && can('do_stat_tasks')) {
      setUserId(currentUser.id);
      const allRequests = await requestService.getAllRequests();
      
      const available = allRequests.filter(r => r.status === 'paid' && !r.assignedTo);
      setAvailableTasks(available.sort((a, b) => a.createdAt - b.createdAt));

      const myTasks = allRequests.filter(r => r.assignedTo === currentUser.id);
      
      // Sort priority: in_progress -> assigned -> completed -> reviewed
      const priority: Record<string, number> = { 'in_progress': 1, 'assigned': 2, 'completed': 3, 'reviewed': 4 };
      const sortedMyTasks = myTasks.sort((a, b) => {
        const pA = priority[a.status] || 99;
        const pB = priority[b.status] || 99;
        if (pA !== pB) return pA - pB;
        return b.createdAt - a.createdAt;
      });
      setTasks(sortedMyTasks);
    }
  };

  const handleClaim = async (task: StatServiceRequest) => {
    await requestService.assignStatistician(task.id, userId);
    const updatedTask = await requestService.getRequestById(task.id);
    if (updatedTask) {
      await requestService.createMatchFromRequest(updatedTask);
    }
    loadData();
  };

  const handleAction = async (task: StatServiceRequest) => {
    if (task.status === 'assigned' || task.status === 'in_progress') {
      if (task.status === 'assigned') {
        await requestService.updateRequestStatus(task.id, 'in_progress');
      }
      
      let matchId = task.matchId;
      if (!matchId) {
        matchId = await requestService.createMatchFromRequest(task);
      }
      navigate(`/track/${matchId}`);
    } else if (task.status === 'completed') {
       // already complete, wait for review
    }
  };

  const handleSubmitQA = async (task: StatServiceRequest) => {
    await requestService.updateRequestStatus(task.id, 'completed');
    loadData();
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/welcome');
  };

  const inProgressCount = tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned').length;
  const completedCount = tasks.filter(t => t.status === 'completed' || t.status === 'reviewed').length;

  return (
    <div className="space-y-6 pb-20 text-zinc-900 dark:text-zinc-100">
      {/* Top action header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-2xl">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Inbox Tugas Statistik</h1>
            <p className="text-xs text-zinc-500">Ambil tugas pencatatan statistik pertandingan atau kelola tugas aktif Anda.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Ringkasan Angka */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 flex flex-col items-center justify-center border-none shadow-sm text-center">
            <div className="text-3xl font-display font-black text-brand-navy dark:text-brand-orange">{availableTasks.length}</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Tersedia</div>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center border-none shadow-sm text-center">
            <div className="text-3xl font-display font-black text-blue-500">{inProgressCount}</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Dikerjakan</div>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center border-none shadow-sm text-center">
            <div className="text-3xl font-display font-black text-emerald-500">{completedCount}</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Selesai</div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Antrean Tersedia */}
          <div>
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-3">Tugas Tersedia (Klaim)</h2>
            {availableTasks.length === 0 ? (
              <Card className="p-8 text-center border-none shadow-sm flex flex-col items-center justify-center bg-white dark:bg-zinc-900 h-32">
                <Inbox size={24} className="text-zinc-400 mb-2" />
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Tidak ada tugas baru</p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {availableTasks.map(task => (
                  <Card key={task.id} className="p-4 sm:p-5 border-none shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-xs text-zinc-400 font-bold mb-1 flex items-center gap-2">
                          <span>{new Date(task.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                          {task.price === 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-900/30 uppercase tracking-widest scale-90 origin-left">
                              BACK-OFFICE
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-[#1A1A1A] dark:text-white uppercase text-lg">{task.homeTeamName} vs {task.awayTeamName}</h3>
                        <p className="text-xs text-zinc-500 font-mono mt-1 truncate max-w-[200px] sm:max-w-md">{task.youtubeUrl}</p>
                      </div>
                      <Button 
                        onClick={() => handleClaim(task)}
                        className="rounded-xl bg-brand-navy hover:bg-brand-navy/90 text-white dark:bg-brand-orange dark:text-brand-navy dark:hover:bg-brand-orange/90 font-bold text-sm px-6 whitespace-nowrap"
                      >
                        <Hand size={16} className="mr-2 inline" /> Klaim Tugas
                      </Button>
                    </div>
                    <RequestDetailsSummary task={task} />
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Tugas Saya */}
          <div>
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-3">Tugas Saya</h2>
            {tasks.length === 0 ? (
               <Card className="p-8 text-center border-none shadow-sm flex flex-col items-center justify-center bg-white dark:bg-zinc-900 h-32">
                 <ClipboardList size={24} className="text-zinc-400 mb-2" />
                 <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Belum ada tugas yang diklaim</p>
               </Card>
            ) : (
              <div className="grid gap-3">
                {tasks.map(task => (
                  <Card key={task.id} className="p-4 sm:p-5 border-none shadow-sm relative overflow-hidden group">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-sm uppercase tracking-widest ${
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-600' : 
                            task.status === 'completed' || task.status === 'reviewed' ? 'bg-emerald-100 text-emerald-600' : 
                            'bg-amber-100 text-amber-600'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                          {task.price === 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-900/30 uppercase tracking-widest">
                              BACK-OFFICE
                            </span>
                          )}
                          <span className="text-xs text-zinc-400 font-bold">{new Date(task.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <h3 className="font-bold text-[#1A1A1A] dark:text-white uppercase text-lg">{task.homeTeamName} vs {task.awayTeamName}</h3>
                        <p className="text-xs text-zinc-500 font-mono mt-1 truncate max-w-[200px] sm:max-w-md">{task.youtubeUrl}</p>
                      </div>

                      <div className="flex gap-2">
                        {(task.status === 'assigned' || task.status === 'in_progress') && (
                          <Button 
                            onClick={() => handleAction(task)}
                            className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm px-6"
                          >
                            <Play size={16} className="mr-2 inline" /> Lanjutkan
                          </Button>
                        )}
                        {(task.status === 'in_progress' || task.status === 'assigned') && (
                          <Button 
                            variant="ghost"
                            onClick={() => handleSubmitQA(task)}
                            className="rounded-xl border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 font-bold text-sm px-4"
                          >
                            Submit QA
                          </Button>
                        )}
                        
                        {(task.status === 'completed' || task.status === 'reviewed') && (
                          <div className="flex items-center gap-2 text-emerald-500 font-black text-sm uppercase px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                            <CheckCircle size={16} /> Menunggu Review
                          </div>
                        )}
                      </div>
                    </div>
                    <RequestDetailsSummary task={task} />
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
