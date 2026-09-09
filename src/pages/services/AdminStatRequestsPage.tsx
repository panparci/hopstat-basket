import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/organisms/Layout';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { useNavigate } from 'react-router-dom';
import { requestService } from '../../services/requestService';
import { authService } from '../../services/authService';
import { StatServiceRequest, UserAccount, PaymentRecord } from '../../core/types/serviceRequests';
import { Users, ClipboardList, CheckCircle, Wallet, Settings, Activity, Clock, LogOut, Inbox } from 'lucide-react';
import { BottomNav } from '../../components/atoms/BottomNav';
import { Can } from '../../core/contexts/PermissionsContext';

export const AdminStatRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<StatServiceRequest[]>([]);
  const [statisticians, setStatisticians] = useState<UserAccount[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserAccount | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    const allReqs = await requestService.getAllRequests();
    const stats = await authService.getAllUsersByRole('statistician');
    const pays = await requestService.getAllPayments();
    
    setRequests(allReqs.sort((a, b) => b.createdAt - a.createdAt));
    setStatisticians(stats);
    setPayments(pays);
    setLoading(false);
  };

  const handleAssign = async (requestId: string, statId: string) => {
    await requestService.assignStatistician(requestId, statId);
    const req = await requestService.getRequestById(requestId);
    if (req) {
      await requestService.createMatchFromRequest(req);
    }
    loadData();
  };

  const handleMarkReviewed = async (requestId: string) => {
    await requestService.updateRequestStatus(requestId, 'reviewed');
    loadData();
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/welcome');
  };

  const totalRevenue = payments.reduce((sum, p) => sum + (p.status === 'success' ? p.amount : 0), 0);
  
  const reqMasuk = requests.filter(r => r.status === 'pending' || r.status === 'awaiting_payment').length;
  const reqMenungguAssignment = requests.filter(r => r.status === 'paid').length;
  const reqDikerjakan = requests.filter(r => r.status === 'assigned' || r.status === 'in_progress').length;
  const reqSelesai = requests.filter(r => r.status === 'completed' || r.status === 'reviewed').length;

  const groupedRequests = {
    'Menunggu Assignment (Sudah Bayar)': requests.filter(r => r.status === 'paid'),
    'Menunggu Review QA': requests.filter(r => r.status === 'completed'),
    'Sedang Dikerjakan': requests.filter(r => r.status === 'assigned' || r.status === 'in_progress'),
    'Request Baru (Belum Bayar)': requests.filter(r => r.status === 'pending' || r.status === 'awaiting_payment'),
    'Selesai & Direview': requests.filter(r => r.status === 'reviewed'),
  };

  return (
    <div className="space-y-6 pb-20 text-zinc-900 dark:text-zinc-100">
      {/* Top action header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-2xl">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Ops Console - Request Layanan</h1>
            <p className="text-xs text-zinc-500">Kelola assignment statistik dan pemrosesan lembar skor pertandingan.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Ringkasan Operasional */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-4 flex flex-col items-center justify-center border-none shadow-sm text-center col-span-2 sm:col-span-1 bg-brand-navy dark:bg-zinc-900 text-white">
            <Wallet size={20} className="text-brand-orange mb-2" />
            <div className="text-xl font-display font-black text-brand-orange">Rp {(totalRevenue / 1000)}k</div>
            <div className="text-xs font-bold uppercase tracking-widest mt-1 opacity-80">Total Pendapatan</div>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center border-none shadow-sm text-center">
            <div className="text-2xl font-display font-black text-[#1A1A1A] dark:text-white">{reqMasuk}</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Request Baru</div>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center border-none shadow-sm text-center">
            <div className="text-2xl font-display font-black text-amber-500">{reqMenungguAssignment}</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Perlu Assign</div>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center border-none shadow-sm text-center">
            <div className="text-2xl font-display font-black text-blue-500">{reqDikerjakan}</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Dikerjakan</div>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center border-none shadow-sm text-center">
            <div className="text-2xl font-display font-black text-emerald-500">{reqSelesai}</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Selesai</div>
          </Card>
        </div>

        {requests.length === 0 ? (
          <Card className="p-8 border-none shadow-sm flex flex-col items-center justify-center text-center bg-white dark:bg-zinc-900 h-64">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <Inbox size={32} className="text-zinc-400" />
            </div>
            <h3 className="font-display font-black text-xl text-zinc-900 dark:text-white mb-2">Belum Ada Request Masuk</h3>
            <p className="text-sm text-zinc-500 max-w-sm">Saat ada customer yang meminta review statistik, request mereka akan muncul di sini.</p>
          </Card>
        ) : (
          <div className="space-y-8">
          {Object.entries(groupedRequests).map(([groupName, groupRequests]) => {
            if (groupRequests.length === 0) return null;
            return (
              <div key={groupName}>
                <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  {groupName === 'Menunggu Assignment (Sudah Bayar)' || groupName === 'Menunggu Review QA' ? (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  ) : null}
                  {groupName} ({groupRequests.length})
                </h2>
                
                <div className="grid gap-3">
                  {groupRequests.map(req => (
                    <Card key={req.id} className="p-4 sm:p-5 border-none shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-sm uppercase tracking-widest ${
                            req.status === 'paid' ? 'bg-amber-100 text-amber-600' : 
                            req.status === 'completed' ? 'bg-blue-100 text-blue-600' :
                            req.status === 'reviewed' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {req.status.replace('_', ' ')}
                          </span>
                          {req.price === 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-900/30 uppercase tracking-widest">
                              BACK-OFFICE
                            </span>
                          )}
                          <span className="text-xs text-zinc-400 font-bold">{new Date(req.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                        <h3 className="font-bold text-zinc-900 dark:text-white uppercase text-lg">{req.homeTeamName} vs {req.awayTeamName}</h3>
                        <p className="text-xs text-zinc-500 font-mono truncate max-w-[200px] sm:max-w-md">{req.youtubeUrl}</p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {req.status === 'awaiting_payment' && (
                          <Can permission="approve_applications">
                            <Button
                              onClick={() => requestService.confirmPayment(req.id).then(loadData)}
                              className="w-full sm:w-auto rounded-xl bg-brand-navy text-white font-bold text-sm px-6"
                            >
                              Konfirmasi Bayar
                            </Button>
                          </Can>
                        )}

                        {req.status === 'paid' && (
                          <Can permission="assign_stat_tasks" fallback={
                            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl border border-amber-100 dark:border-amber-800 font-bold">
                              Menunggu Tugas (Perlu Admin)
                            </div>
                          }>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <select 
                                className="w-full sm:w-auto bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm p-2 font-bold text-amber-700 dark:text-amber-400 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                                onChange={(e) => handleAssign(req.id, e.target.value)}
                                defaultValue=""
                              >
                                <option value="" disabled>Assign Statistician...</option>
                                {statisticians.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          </Can>
                        )}

                        {(req.status === 'assigned' || req.status === 'in_progress') && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                            <Activity size={16} className="text-blue-500" />
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                              PIC: {statisticians.find(s => s.id === req.assignedTo)?.name || 'Unknown'}
                            </span>
                          </div>
                        )}
                        
                        {req.status === 'completed' && (
                          <Can permission="approve_applications" fallback={
                            <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/20 px-3 py-2 rounded-xl border border-blue-100 dark:border-blue-800 font-bold">
                              Menunggu Review Admin
                            </div>
                          }>
                            <Button 
                              onClick={() => handleMarkReviewed(req.id)}
                              className="w-full sm:w-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm px-6"
                            >
                              <CheckCircle size={16} className="mr-2 inline" /> Tandai Reviewed
                            </Button>
                          </Can>
                        )}

                        {req.status === 'reviewed' && (
                          <div className="flex items-center gap-2 px-4 py-2 text-emerald-500 font-black text-xs uppercase">
                            <CheckCircle size={16} /> Selesai
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
};
