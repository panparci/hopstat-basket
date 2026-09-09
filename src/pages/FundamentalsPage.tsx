import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Sparkles, 
  BookOpen, 
  GraduationCap, 
  Plus, 
  UserCheck, 
  Flame, 
  Award,
  Layers,
  Settings,
  Video,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import { 
  FundamentalDrill, 
  AthleteProfile, 
  WorkoutScheduleDay, 
  DrillSubmission, 
  ClassroomQAThread,
  PlayingPosition,
  SkillLevel,
  FacilityAccess
} from '../modules/fundamentals/types';
import { fundamentalService } from '../modules/fundamentals/services/fundamentalService';
import { FreeleticsWorkoutView } from '../modules/fundamentals/components/FreeleticsWorkoutView';
import { DrillLibraryView } from '../modules/fundamentals/components/DrillLibraryView';
import { GoogleClassroomHub } from '../modules/fundamentals/components/GoogleClassroomHub';
import { AIScheduleGeneratorModal } from '../modules/fundamentals/components/AIScheduleGeneratorModal';
import { AdminDrillConfigModal } from '../modules/fundamentals/components/AdminDrillConfigModal';
import { DrillExcelUploadModal } from '../modules/fundamentals/components/DrillExcelUploadModal';
import { downloadDrillExcelTemplate } from '../modules/fundamentals/services/drillExcelService';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { usePermissions } from '../core/contexts/PermissionsContext';

export const FundamentalsPage: React.FC = () => {
  const { user } = usePermissions();
  const isAdminUser = user?.role === 'admin' || user?.role === 'coach';

  const [activeTab, setActiveTab] = useState<'workout' | 'library' | 'classroom'>('workout');
  
  // State
  const [drills, setDrills] = useState<FundamentalDrill[]>([]);
  const [schedule, setSchedule] = useState<WorkoutScheduleDay[]>([]);
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [submissions, setSubmissions] = useState<DrillSubmission[]>([]);
  const [qaThreads, setQaThreads] = useState<ClassroomQAThread[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showUploadExcelModal, setShowUploadExcelModal] = useState(false);
  const [editingDrill, setEditingDrill] = useState<FundamentalDrill | null>(null);
  const [isCoachView, setIsCoachView] = useState(true);

  useEffect(() => {
    if (isAdminUser) {
      setIsCoachView(true);
    }
  }, [isAdminUser]);

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const fetchedDrills = await fundamentalService.getDrills();
      const fetchedProfile = await fundamentalService.getAthleteProfile();
      const fetchedSchedule = await fundamentalService.getWorkoutSchedule('current-athlete');
      const fetchedSubmissions = await fundamentalService.getSubmissions();
      const fetchedQA = await fundamentalService.getQAThreads();

      setDrills(fetchedDrills);
      setProfile(fetchedProfile);
      setSubmissions(fetchedSubmissions);
      setQaThreads(fetchedQA);

      if (fetchedSchedule && fetchedSchedule.length > 0) {
        setSchedule(fetchedSchedule);
      } else {
        // Generate default schedule on first visit
        const defaultSched = await fundamentalService.generateAISchedule('PG', 'menengah', 'half_court', 4);
        setSchedule(defaultSched);
        await fundamentalService.saveWorkoutSchedule('current-athlete', defaultSched);
      }
    } catch (err) {
      console.error('Error loading fundamentals data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDrillCompletion = async (dayId: string, drillId: string) => {
    const updated = await fundamentalService.toggleDrillCompletion('current-athlete', dayId, drillId);
    setSchedule(updated);
  };

  const handleGenerateAISchedule = async (
    position: PlayingPosition,
    skillLevel: SkillLevel,
    facility: FacilityAccess,
    goalDays: number
  ) => {
    const newSchedule = await fundamentalService.generateAISchedule(position, skillLevel, facility, goalDays);
    setSchedule(newSchedule);
    await fundamentalService.saveWorkoutSchedule('current-athlete', newSchedule);

    const newProfile: AthleteProfile = {
      id: 'current-athlete',
      name: 'Pemain Basket',
      position,
      skillLevel,
      facilityAccess: facility,
      weeklyGoalDays: goalDays,
      createdAt: new Date().toISOString(),
    };
    setProfile(newProfile);
    await fundamentalService.saveAthleteProfile(newProfile);
  };

  const handleSaveDrill = async (drill: FundamentalDrill) => {
    const updated = await fundamentalService.saveDrill(drill);
    setDrills(updated);
  };

  const handleBulkImportDrills = async (importedDrills: FundamentalDrill[], mode: 'append' | 'replace') => {
    const updated = await fundamentalService.bulkImportDrills(importedDrills, mode);
    setDrills(updated);
  };

  const handleDeleteDrill = async (drillId: string) => {
    const updated = await fundamentalService.deleteDrill(drillId);
    setDrills(updated);
  };

  const handleResetDrills = async () => {
    const updated = await fundamentalService.resetDefaultDrills();
    setDrills(updated);
  };

  const handleAddSubmission = async (sub: { drillId: string; drillName: string; videoUrl: string; athleteNotes: string }) => {
    const updated = await fundamentalService.addSubmission({
      ...sub,
      athleteId: 'current-athlete',
      athleteName: profile?.name || 'Pemain Basket',
    });
    setSubmissions(updated);
  };

  const handleAddCoachFeedback = async (submissionId: string, feedback: { coachName: string; rating: number; comments: string; timestampNotes?: { time: string; note: string }[] }) => {
    const updated = await fundamentalService.addCoachFeedback(submissionId, feedback);
    setSubmissions(updated);
  };

  const handleAddQAQuestion = async (question: string, category: string, drillName?: string) => {
    const updated = await fundamentalService.addQAQuestion(profile?.name || 'Pemain Basket', question, category, drillName);
    setQaThreads(updated);
  };

  const handleAddQAReply = async (threadId: string, message: string) => {
    const role = isCoachView ? 'coach' : 'athlete';
    const name = isCoachView ? 'Coach Head' : (profile?.name || 'Pemain Basket');
    const updated = await fundamentalService.addQAReply(threadId, name, role, message);
    setQaThreads(updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Memuat Modul Basketball Fundamentals...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Top Header & Role Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm dark:shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-amber-500 text-zinc-950 rounded-xl sm:rounded-2xl font-black shadow-lg shadow-amber-500/20 shrink-0">
            <Target className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                FUNDAMENTAL BASKETBALL
              </span>
              {isCoachView && (
                <span className="text-[10px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Mode Admin / Coach
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-2xl font-black uppercase text-slate-900 dark:text-white tracking-tight">
              LATIHAN FUNDAMENTAL BASKET
            </h1>
          </div>
        </div>

        {/* Action Controls: Coach/Admin Mode Toggle & Quick Add Video Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowUploadExcelModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            title="Upload Katalog Drill via Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Upload Excel</span>
          </button>

          <button
            onClick={() => {
              setEditingDrill(null);
              setShowAdminModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Edit / Tambah Video</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shrink-0">
            <button
              onClick={() => setIsCoachView(false)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isCoachView ? 'bg-amber-500 text-zinc-950 font-black shadow-md' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🏀 Atlet
            </button>
            <button
              onClick={() => setIsCoachView(true)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isCoachView ? 'bg-amber-500 text-zinc-950 font-black shadow-md' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              📋 Coach / Admin
            </button>
          </div>
        </div>
      </div>

      {/* Primary Tab Navigation - Mobile Friendly */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-1 rounded-xl sm:rounded-2xl gap-1 shadow-sm">
        <button
          onClick={() => setActiveTab('workout')}
          className={`flex-1 py-2.5 sm:py-3 text-xs font-black rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'workout'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Program Latihan</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`flex-1 py-2.5 sm:py-3 text-xs font-black rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'library'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Katalog Video ({drills.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('classroom')}
          className={`flex-1 py-2.5 sm:py-3 text-xs font-black rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'classroom'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Setor Video & Diskusi</span>
        </button>
      </div>

      {/* Main Tab Content Display */}
      {activeTab === 'workout' && (
        <FreeleticsWorkoutView
          schedule={schedule}
          drillsLibrary={drills}
          profile={profile}
          onOpenAIScheduleModal={() => setShowAIModal(true)}
          onToggleDrillCompletion={handleToggleDrillCompletion}
        />
      )}

      {activeTab === 'library' && (
        <DrillLibraryView
          drills={drills}
          isAdminOrCoach={isCoachView}
          onOpenAddModal={() => {
            setEditingDrill(null);
            setShowAdminModal(true);
          }}
          onOpenEditModal={(drill) => {
            setEditingDrill(drill);
            setShowAdminModal(true);
          }}
          onDeleteDrill={handleDeleteDrill}
          onResetDrills={handleResetDrills}
          onOpenUploadExcelModal={() => setShowUploadExcelModal(true)}
        />
      )}

      {activeTab === 'classroom' && (
        <GoogleClassroomHub
          submissions={submissions}
          qaThreads={qaThreads}
          drillsLibrary={drills}
          isCoach={isCoachView}
          onAddSubmission={handleAddSubmission}
          onAddCoachFeedback={handleAddCoachFeedback}
          onAddQAQuestion={handleAddQAQuestion}
          onAddQAReply={handleAddQAReply}
        />
      )}

      {/* AI Schedule Generator Modal */}
      {showAIModal && (
        <AIScheduleGeneratorModal
          onClose={() => setShowAIModal(false)}
          onGenerate={handleGenerateAISchedule}
          currentProfile={profile}
        />
      )}

      {/* Admin Drill Config Modal */}
      {showAdminModal && (
        <AdminDrillConfigModal
          drill={editingDrill}
          onClose={() => {
            setShowAdminModal(false);
            setEditingDrill(null);
          }}
          onSave={handleSaveDrill}
        />
      )}

      {/* Upload Drill Catalog Excel Modal */}
      {showUploadExcelModal && (
        <DrillExcelUploadModal
          onClose={() => setShowUploadExcelModal(false)}
          onImport={handleBulkImportDrills}
        />
      )}
    </div>
  );
};
