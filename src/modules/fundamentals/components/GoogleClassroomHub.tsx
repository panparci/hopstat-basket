import React, { useState } from 'react';
import { 
  Video, 
  Send, 
  MessageSquare, 
  Star, 
  Clock, 
  CheckCircle2, 
  User, 
  Plus, 
  Sparkles,
  ExternalLink,
  MessageCircle,
  Award
} from 'lucide-react';
import { DrillSubmission, ClassroomQAThread, FundamentalDrill } from '../types';

interface GoogleClassroomHubProps {
  submissions: DrillSubmission[];
  qaThreads: ClassroomQAThread[];
  drillsLibrary: FundamentalDrill[];
  isCoach: boolean;
  onAddSubmission: (submission: { drillId: string; drillName: string; videoUrl: string; athleteNotes: string }) => Promise<void>;
  onAddCoachFeedback: (submissionId: string, feedback: { coachName: string; rating: number; comments: string; timestampNotes?: { time: string; note: string }[] }) => Promise<void>;
  onAddQAQuestion: (question: string, category: string, drillName?: string) => Promise<void>;
  onAddQAReply: (threadId: string, message: string) => Promise<void>;
}

export const GoogleClassroomHub: React.FC<GoogleClassroomHubProps> = ({
  submissions,
  qaThreads,
  drillsLibrary,
  isCoach,
  onAddSubmission,
  onAddCoachFeedback,
  onAddQAQuestion,
  onAddQAReply,
}) => {
  const [activeTab, setActiveTab] = useState<'submissions' | 'qa'>('submissions');
  
  // Submission Form Modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitDrillId, setSubmitDrillId] = useState(drillsLibrary[0]?.id || '');
  const [submitVideoUrl, setSubmitVideoUrl] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');

  // Coach Feedback state
  const [reviewingSubId, setReviewingSubId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [tsTime, setTsTime] = useState('');
  const [tsNote, setTsNote] = useState('');
  const [tsNotesList, setTsNotesList] = useState<{ time: string; note: string }[]>([]);

  // Q&A state
  const [showQAModal, setShowQAModal] = useState(false);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaCategory, setQaCategory] = useState('Ball Handling Technique');
  const [qaDrillName, setQaDrillName] = useState('');
  const [replyInputs, setReplyInputs] = useState<{ [threadId: string]: string }>({});

  const handleCreateSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitVideoUrl.trim()) return;
    const drill = drillsLibrary.find(d => d.id === submitDrillId);
    await onAddSubmission({
      drillId: submitDrillId,
      drillName: drill?.name || 'Drill Fundamental',
      videoUrl: submitVideoUrl,
      athleteNotes: submitNotes,
    });
    setSubmitVideoUrl('');
    setSubmitNotes('');
    setShowSubmitModal(false);
  };

  const handleSaveCoachFeedback = async (subId: string) => {
    if (!feedbackComments.trim()) return;
    await onAddCoachFeedback(subId, {
      coachName: 'Coach Head',
      rating: feedbackRating,
      comments: feedbackComments,
      timestampNotes: tsNotesList,
    });
    setReviewingSubId(null);
    setFeedbackComments('');
    setTsNotesList([]);
  };

  const handleAddTimestampNote = () => {
    if (!tsTime.trim() || !tsNote.trim()) return;
    setTsNotesList([...tsNotesList, { time: tsTime, note: tsNote }]);
    setTsTime('');
    setTsNote('');
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaQuestion.trim()) return;
    await onAddQAQuestion(qaQuestion, qaCategory, qaDrillName || undefined);
    setQaQuestion('');
    setShowQAModal(false);
  };

  const handleSendReply = async (threadId: string) => {
    const text = replyInputs[threadId];
    if (!text || !text.trim()) return;
    await onAddQAReply(threadId, text);
    setReplyInputs({ ...replyInputs, [threadId]: '' });
  };

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-white">
      {/* Google Classroom Hub Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 border border-slate-700 dark:border-zinc-800 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl text-white">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
            EVALUASI & DISKUSI PELATIH
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            SETOR REKAMAN DRILL & DISKUSI TEKNIK
          </h2>
          <p className="text-xs text-zinc-300 dark:text-zinc-400">
            Kirimkan video latihan Anda untuk direview oleh Coach dengan catatan timestamp dan evaluasi rating.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'submissions' ? (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Setor Video Latihan</span>
            </button>
          ) : (
            <button
              onClick={() => setShowQAModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Buat Pertanyaan Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs Header */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('submissions')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'submissions'
              ? 'bg-amber-500 text-zinc-950 font-black shadow-md'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Setoran Video Athlete ({submissions.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('qa')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'qa'
              ? 'bg-amber-500 text-zinc-950 font-black shadow-md'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Forum Tanya Jawab ({qaThreads.length})</span>
        </button>
      </div>

      {/* TAB 1: SUBMISSIONS LIST */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 space-y-4 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
            >
              {/* Submission Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-black flex items-center justify-center text-sm border border-amber-500/30">
                    {sub.athleteName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">{sub.athleteName}</h3>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                      Drill: <strong className="text-amber-600 dark:text-amber-400">{sub.drillName}</strong> • {new Date(sub.submittedAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      sub.status === 'reviewed'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {sub.status === 'reviewed' ? '✓ Sudah Direview Coach' : '⏳ Menunggu Review'}
                  </span>
                  <a
                    href={sub.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-zinc-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Buka Video</span>
                  </a>
                </div>
              </div>

              {/* Athlete Notes */}
              <div className="bg-slate-50 dark:bg-zinc-950/70 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-1">
                  Catatan Athlete:
                </span>
                <p>{sub.athleteNotes}</p>
              </div>

              {/* Coach Review Result (If Reviewed) */}
              {sub.coachFeedback && (
                <div className="bg-gradient-to-r from-amber-500/10 via-slate-50 to-white dark:via-zinc-900 dark:to-zinc-950 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span className="font-black text-xs uppercase text-amber-700 dark:text-amber-400">
                        Evaluasi Coach: {sub.coachFeedback.coachName}
                      </span>
                    </div>

                    {/* Star Rating Display */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= (sub.coachFeedback?.rating || 0)
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300 dark:text-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed font-medium">
                    "{sub.coachFeedback.comments}"
                  </p>

                  {/* Timestamped Critique Notes */}
                  {sub.coachFeedback.timestampNotes && sub.coachFeedback.timestampNotes.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
                      <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 block">
                        Catatan Detik & Timestamps:
                      </span>
                      {sub.coachFeedback.timestampNotes.map((ts, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-700 dark:text-zinc-300">
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-mono font-bold shrink-0">
                            {ts.time}
                          </span>
                          <span>{ts.note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Coach Review Action Panel */}
              {isCoach && (
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                  {reviewingSubId === sub.id ? (
                    <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                      <h4 className="font-black text-xs uppercase text-amber-600 dark:text-amber-400">
                        Beri Evaluasi & Review Video
                      </h4>

                      {/* Star Rating Select */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-zinc-400">Rating Performa:</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              type="button"
                              key={s}
                              onClick={() => setFeedbackRating(s)}
                              className="cursor-pointer"
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  s <= feedbackRating ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-zinc-700'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Feedback Comment */}
                      <textarea
                        placeholder="Tulis kritik & saran teknik untuk atlet ini..."
                        value={feedbackComments}
                        onChange={(e) => setFeedbackComments(e.target.value)}
                        className="w-full p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                        rows={2}
                      />

                      {/* Timestamped Notes Inputs */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 block">
                          Tambah Catatan Timestamp Video (Contoh: 00:15 - Posisi siku kurang tinggi)
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="00:15"
                            value={tsTime}
                            onChange={(e) => setTsTime(e.target.value)}
                            className="w-20 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-amber-600 dark:text-amber-400 text-center"
                          />
                          <input
                            type="text"
                            placeholder="Catatan teknik pada detik ini..."
                            value={tsNote}
                            onChange={(e) => setTsNote(e.target.value)}
                            className="flex-1 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={handleAddTimestampNote}
                            className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-zinc-800 text-amber-700 dark:text-amber-400 text-xs font-bold hover:bg-slate-300 dark:hover:bg-zinc-700"
                          >
                            + Tambah
                          </button>
                        </div>

                        {tsNotesList.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {tsNotesList.map((n, i) => (
                              <span key={i} className="text-[10px] px-2 py-1 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono">
                                ⏱️ {n.time}: {n.note}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setReviewingSubId(null)}
                          className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 text-xs font-bold"
                        >
                          Batal
                        </button>
                        <button
                          onClick={() => handleSaveCoachFeedback(sub.id)}
                          className="px-4 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-black text-xs uppercase"
                        >
                          Simpan Evaluasi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setReviewingSubId(sub.id);
                        setFeedbackRating(sub.coachFeedback?.rating || 5);
                        setFeedbackComments(sub.coachFeedback?.comments || '');
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-black hover:bg-amber-500 hover:text-zinc-950 transition-all cursor-pointer"
                    >
                      {sub.coachFeedback ? 'Edit Review Coach' : '+ Beri Review Coach'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: FORUM TANYA JAWAB (CLASSROOM DISCUSSION) */}
      {activeTab === 'qa' && (
        <div className="space-y-4">
          {qaThreads.map((thread) => (
            <div
              key={thread.id}
              className="bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 space-y-4 shadow-sm"
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 font-black flex items-center justify-center text-sm border border-orange-500/30 shrink-0">
                    {thread.athleteName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">{thread.athleteName}</h3>
                      <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded font-mono border border-slate-200 dark:border-zinc-700">
                        {thread.category}
                      </span>
                    </div>
                    {thread.drillName && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                        Terkait Drill: {thread.drillName}
                      </span>
                    )}
                    <p className="text-xs text-slate-700 dark:text-zinc-200 mt-2 font-medium leading-relaxed">
                      "{thread.question}"
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono shrink-0">
                  {new Date(thread.createdAt).toLocaleDateString('id-ID')}
                </span>
              </div>

              {/* Thread Replies */}
              <div className="space-y-2 pl-4 sm:pl-8 border-l-2 border-slate-200 dark:border-zinc-800">
                {thread.replies?.map((rep) => (
                  <div
                    key={rep.id}
                    className={`p-3 rounded-2xl text-xs space-y-1 ${
                      rep.authorRole === 'coach'
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-100'
                        : 'bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[11px] flex items-center gap-1.5">
                        {rep.authorRole === 'coach' && <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                        {rep.authorName} ({rep.authorRole.toUpperCase()})
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">
                        {new Date(rep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p>{rep.message}</p>
                  </div>
                ))}

                {/* Reply Input */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Tulis balasan atau penjelasan teknik..."
                    value={replyInputs[thread.id] || ''}
                    onChange={(e) => setReplyInputs({ ...replyInputs, [thread.id]: e.target.value })}
                    className="flex-1 p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendReply(thread.id);
                    }}
                  />
                  <button
                    onClick={() => handleSendReply(thread.id)}
                    className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUBMIT VIDEO MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="font-black text-lg text-slate-900 dark:text-white">Setor Video Rekaman Drill</h3>
            <form onSubmit={handleCreateSubmission} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">Pilih Drill Fundamental</label>
                <select
                  value={submitDrillId}
                  onChange={(e) => setSubmitDrillId(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                >
                  {drillsLibrary.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">Link Video YouTube / Loom / Drive</label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={submitVideoUrl}
                  onChange={(e) => setSubmitVideoUrl(e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">Catatan Latihan & Pertanyaan untuk Coach</label>
                <textarea
                  placeholder="Sebutkan hal yang ingin dievaluasi (misal: footwork, release tembakan)..."
                  value={submitNotes}
                  onChange={(e) => setSubmitNotes(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 text-zinc-950 font-black text-xs uppercase rounded-xl"
                >
                  Kirim Setoran Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE QUESTION MODAL */}
      {showQAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="font-black text-lg text-slate-900 dark:text-white">Tanya Jawab Teknik Basket</h3>
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">Kategori Topik</label>
                <input
                  type="text"
                  value={qaCategory}
                  onChange={(e) => setQaCategory(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">Pertanyaan Anda</label>
                <textarea
                  placeholder="Tuliskan pertanyaan teknik basket secara detail..."
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQAModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 text-zinc-950 font-black text-xs uppercase rounded-xl"
                >
                  Kirim Pertanyaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
