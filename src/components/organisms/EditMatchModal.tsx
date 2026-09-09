import React, { useState, useEffect } from 'react';
import { Trophy, Hash, RefreshCcw, Users, Save } from 'lucide-react';
import { Match, RecordingMode } from '../../core/types/stats';
import { statsService } from '../../core/services/statsService';
import { BaseModal } from '../atoms/BaseModal';
import { CompetitionGrade, COMPETITION_GRADE_LABELS } from '../../core/config/competition';
import { DIVISIONS, getDivision, mapLegacyToDivisionCode } from '../../entities/division/model/divisions';

interface EditMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  onSuccess: (updatedMatch: Match) => void;
  onRestart?: () => void;
  onReloadRoster?: () => void;
  isReloading?: boolean;
  sidePanel?: boolean;
  onEditTeam?: (teamId: string) => void;
}

export const EditMatchModal: React.FC<EditMatchModalProps> = ({ 
  isOpen, 
  onClose, 
  match, 
  onSuccess,
  onRestart,
  onReloadRoster,
  isReloading,
  sidePanel = false,
  onEditTeam
}) => {
  const [name, setName] = useState(match.name || '');
  const [eventName, setEventName] = useState(match.eventName || '');
  const [date, setDate] = useState(match.date || '');
  const [venue, setVenue] = useState(match.venue || '');
  const [videoUrl, setVideoUrl] = useState(match.videoUrl || '');
  const [matchKU, setMatchKU] = useState<number | undefined>(match.matchKU);
  const [selectedDivisionCode, setSelectedDivisionCode] = useState<string>('');
  const [competitionGrade, setCompetitionGrade] = useState<CompetitionGrade>(match.competitionGrade || CompetitionGrade.LOCAL_FRIENDLY);
  const [matchLevel, setMatchLevel] = useState<'club'|'academy'|'school'|'mixed'>(match.matchLevel || 'club');
  const [isOfficiated, setIsOfficiated] = useState<boolean>(match.isOfficiated || false);
  const [ourColor, setOurColor] = useState(match.ourColor || 'var(--color-brand-navy)');
  const [ourTheme, setOurTheme] = useState(match.ourTheme || 'gelap');
  const [theirColor, setTheirColor] = useState(match.theirColor || 'var(--color-brand-orange)');
  const [theirTheme, setTheirTheme] = useState(match.theirTheme || 'terang');
  const [matchId, setMatchId] = useState(match.matchId || '');
  const [recordingMode, setRecordingMode] = useState<RecordingMode>(match.recordingMode || 'detailed');
  const [clockMode, setClockMode] = useState<'stop' | 'running'>(match.clockMode || 'stop');
  const [stopClockOnMadeBasket, setStopClockOnMadeBasket] = useState<'fiba' | 'always' | 'never'>(match.stopClockOnMadeBasket || 'fiba');
  const [matchContext, setMatchContext] = useState<Match['matchContext']>(match.matchContext || {
    format: 'single',
    stage: 'friendly',
    importance: 'low',
    purpose: 'development',
    opponentLevel: 'same'
  });
  const [activeTab, setActiveTab] = useState<'info' | 'config' | 'jersey' | 'context' | 'actions'>('info');
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(match.name || '');
      setEventName(match.eventName || '');
      setDate(match.date || '');
      setVenue(match.venue || '');
      setVideoUrl(match.videoUrl || '');
      setMatchKU(match.matchKU || match.ageCategory);
      if (match.divisionCode) {
        setSelectedDivisionCode(match.divisionCode);
      } else if (match.ageGroup) {
        const mappedCode = mapLegacyToDivisionCode(match.ageGroup);
        setSelectedDivisionCode(mappedCode || '');
      } else {
        setSelectedDivisionCode('');
      }
      setCompetitionGrade(match.competitionGrade || CompetitionGrade.LOCAL_FRIENDLY);
      setMatchLevel(match.matchLevel || 'club');
      setIsOfficiated(match.isOfficiated || false);
      setOurColor(match.ourColor || 'var(--color-brand-navy)');
      setOurTheme(match.ourTheme || 'gelap');
      setTheirColor(match.theirColor || 'var(--color-brand-orange)');
      setTheirTheme(match.theirTheme || 'terang');
      setMatchId(match.matchId || '');
      setRecordingMode(match.recordingMode || 'detailed');
      setClockMode(match.clockMode || 'stop');
      setStopClockOnMadeBasket(match.stopClockOnMadeBasket || 'fiba');
      setMatchContext(match.matchContext || {
        format: 'single',
        stage: 'friendly',
        importance: 'low',
        purpose: 'development',
        opponentLevel: 'same'
      });
      setActiveTab('info');
      setShowRestartConfirm(false);
    }
  }, [isOpen, match]);

  const handleSave = async () => {
    const division = getDivision(selectedDivisionCode);
    const calculatedKU = division ? division.ageCategory : matchKU;
    const calculatedAgeGroup = division ? division.label : (matchKU ? `KU-${matchKU}` : (match.ageGroup || ''));

    const updatedMatch: Match = {
      ...match,
      name,
      eventName,
      date,
      venue,
      videoUrl: videoUrl || undefined,
      ourColor,
      ourTheme,
      theirColor,
      theirTheme,
      matchId,
      matchKU: calculatedKU,
      ageCategory: calculatedKU,
      ageGroup: calculatedAgeGroup,
      divisionCode: selectedDivisionCode || undefined,
      competitionGrade,
      recordingMode,
      clockMode,
      stopClockOnMadeBasket,
      matchContext,
      matchLevel,
      isOfficiated
    };
    await statsService.updateMatch(updatedMatch);
    onSuccess(updatedMatch);
    onClose();
  };

  const renderTabButton = (id: typeof activeTab, label: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
        activeTab === id 
          ? 'border-brand-navy dark:border-brand-orange text-brand-navy dark:text-brand-orange' 
          : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Konfigurasi"
      icon={<Trophy className="text-brand-navy dark:text-brand-orange" size={20} />}
      sidePanel={true}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col h-full">
        {/* Tabs Header */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 mb-6">
          {renderTabButton('info', 'Info')}
          {renderTabButton('config', 'Mode')}
          {renderTabButton('jersey', 'Jersey')}
          {renderTabButton('context', 'Context')}
          {renderTabButton('actions', 'Aksi')}
        </div>

        <div className="flex-1 space-y-6">
          {activeTab === 'info' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Match ID</label>
                  <input 
                    type="text" 
                    value={matchId}
                    onChange={e => setMatchId(e.target.value)}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Nama Event</label>
                  <input 
                    type="text" 
                    value={eventName}
                    onChange={e => setEventName(e.target.value)}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Nama Match</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
                />
              </div>

               <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Tanggal</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Lokasi</label>
                  <input 
                    type="text" 
                    value={venue}
                    onChange={e => setVenue(e.target.value)}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Link Video (YouTube)</label>
                <input 
                  type="text" 
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Kategori Umur Match (KU) / Divisi</label>
                <select 
                  value={selectedDivisionCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedDivisionCode(val);
                    const div = getDivision(val);
                    setMatchKU(div ? div.ageCategory : undefined);
                  }}
                  className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
                >
                  <option value="">Tidak Ditentukan</option>
                  {DIVISIONS.map(div => (
                    <option key={div.code} value={div.code}>
                      {div.label} ({div.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Level Kompetisi</label>
                <select 
                  value={competitionGrade}
                  onChange={(e) => setCompetitionGrade(e.target.value as CompetitionGrade)}
                  className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
                >
                  {Object.values(CompetitionGrade).map(grade => (
                    <option key={grade} value={grade}>{COMPETITION_GRADE_LABELS[grade]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Level Pertandingan</label>
                <select 
                  value={matchLevel}
                  onChange={(e) => setMatchLevel(e.target.value as any)}
                  className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
                >
                  <option value="club">Club (Klub Umum)</option>
                  <option value="academy">Academy (Akademi)</option>
                  <option value="school">School (Sekolah)</option>
                  <option value="mixed">Mixed (Campuran/Lainnya)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide block">Wasit & Aturan Resmi</label>
                  <span className="text-[10px] text-zinc-400 font-semibold">Aktifkan jika pertandingan dipimpin wasit & aturan resmi</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOfficiated(!isOfficiated)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isOfficiated ? 'bg-brand-orange' : 'bg-zinc-200 dark:bg-zinc-850'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isOfficiated ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Mode Perekaman</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRecordingMode('lite')}
                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
                      recordingMode === 'lite' 
                        ? 'border-brand-navy dark:border-brand-orange bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200'
                    }`}
                  >
                    <span className="font-bold text-sm">Lite</span>
                    <span className="text-xs text-zinc-500">Hanya data utama</span>
                  </button>
                  <button
                    onClick={() => setRecordingMode('detailed')}
                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
                      recordingMode === 'detailed' 
                        ? 'border-brand-navy dark:border-brand-orange bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200'
                    }`}
                  >
                    <span className="font-bold text-sm">Detailed</span>
                    <span className="text-xs text-zinc-500">Lengkap dengan konteks</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Tipe Jam (Clock)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setClockMode('running')}
                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
                      clockMode === 'running' 
                        ? 'border-brand-navy dark:border-brand-orange bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200'
                    }`}
                  >
                    <span className="font-bold text-sm">Continuous</span>
                    <span className="text-xs text-zinc-500">Jam tetap berjalan</span>
                  </button>
                  <button
                    onClick={() => setClockMode('stop')}
                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
                      clockMode === 'stop' 
                        ? 'border-brand-navy dark:border-brand-orange bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200'
                    }`}
                  >
                    <span className="font-bold text-sm">Stop Clock</span>
                    <span className="text-xs text-zinc-500">Jam berhenti saat mati</span>
                  </button>
                </div>
              </div>

              {clockMode === 'stop' && (
                <div className="space-y-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700/50 animate-in fade-in duration-200">
                  <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Aturan Stop Clock Bola Masuk</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setStopClockOnMadeBasket('fiba')}
                      className={`p-2 rounded-xl border-2 text-center flex flex-col items-center justify-center transition-all ${
                        stopClockOnMadeBasket === 'fiba'
                          ? 'border-brand-navy dark:border-brand-orange bg-white dark:bg-zinc-900 font-bold'
                          : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-500'
                      }`}
                    >
                      <span className="text-xs">FIBA Standard</span>
                      <span className="text-[9px] text-zinc-400 mt-0.5">2 mnt terakhir Q4/OT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStopClockOnMadeBasket('always')}
                      className={`p-2 rounded-xl border-2 text-center flex flex-col items-center justify-center transition-all ${
                        stopClockOnMadeBasket === 'always'
                          ? 'border-brand-navy dark:border-brand-orange bg-white dark:bg-zinc-900 font-bold'
                          : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-500'
                      }`}
                    >
                      <span className="text-xs">Selalu Berhenti</span>
                      <span className="text-[9px] text-zinc-400 mt-0.5">Setiap bola masuk</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStopClockOnMadeBasket('never')}
                      className={`p-2 rounded-xl border-2 text-center flex flex-col items-center justify-center transition-all ${
                        stopClockOnMadeBasket === 'never'
                          ? 'border-brand-navy dark:border-brand-orange bg-white dark:bg-zinc-900 font-bold'
                          : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-500'
                      }`}
                    >
                      <span className="text-xs">Tidak Berhenti</span>
                      <span className="text-[9px] text-zinc-400 mt-0.5">Untuk junior/mini</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'jersey' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Warna Kostum</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Tim Kita</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={ourColor}
                        onChange={e => setOurColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                      <select 
                        value={ourTheme}
                        onChange={e => setOurTheme(e.target.value as any)}
                        className="flex-1 p-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-lg"
                      >
                        <option value="gelap">Gelap</option>
                        <option value="terang">Terang</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Tim Lawan</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={theirColor}
                        onChange={e => setTheirColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                      <select 
                        value={theirTheme}
                        onChange={e => setTheirTheme(e.target.value as any)}
                        className="flex-1 p-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-lg"
                      >
                        <option value="gelap">Gelap</option>
                        <option value="terang">Terang</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'context' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">AI Context Layer</h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Format Kompetisi</label>
                    <select 
                      value={matchContext?.format}
                      onChange={(e) => setMatchContext(prev => ({ ...prev!, format: e.target.value as any }))}
                      className="w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl outline-none font-bold text-sm"
                    >
                      <option value="single">Single Match / Friendly</option>
                      <option value="tournament">Tournament / Cup</option>
                      <option value="league">League / Round Robin</option>
                      <option value="playoff">Playoff Series</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Tahap (Stage)</label>
                    <select 
                      value={matchContext?.stage}
                      onChange={(e) => setMatchContext(prev => ({ ...prev!, stage: e.target.value as any }))}
                      className="w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl outline-none font-bold text-sm"
                    >
                      <option value="friendly">Friendly / Sparring</option>
                      <option value="group">Group Stage / Regular</option>
                      <option value="quarterfinal">Perempat Final</option>
                      <option value="semifinal">Semifinal</option>
                      <option value="final">Final / Championship</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Tingkat Tekanan (Stakes)</label>
                    <select 
                      value={matchContext?.importance}
                      onChange={(e) => setMatchContext(prev => ({ ...prev!, importance: e.target.value as any }))}
                      className="w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl outline-none font-bold text-sm"
                    >
                      <option value="low">Low Stakes (Latihan)</option>
                      <option value="medium">Medium Stakes (Penyisihan)</option>
                      <option value="high">High Stakes (Semi/Final)</option>
                      <option value="elimination">Elimination (Kalah = Keluar)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Tujuan (Purpose)</label>
                    <select 
                      value={matchContext?.purpose}
                      onChange={(e) => setMatchContext(prev => ({ ...prev!, purpose: e.target.value as any }))}
                      className="w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl outline-none font-bold text-sm"
                    >
                      <option value="development">Development (Skill)</option>
                      <option value="evaluation">Evaluation (Seleksi)</option>
                      <option value="competitive">Competitive (Menang)</option>
                      <option value="experimental">Experimental (Strategi)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Level Lawan</label>
                    <select 
                      value={matchContext?.opponentLevel}
                      onChange={(e) => setMatchContext(prev => ({ ...prev!, opponentLevel: e.target.value as any }))}
                      className="w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl outline-none font-bold text-sm"
                    >
                      <option value="weaker">Lebih Lemah (Weaker)</option>
                      <option value="same">Setara (Same Level)</option>
                      <option value="stronger">Lebih Kuat (Stronger)</option>
                      <option value="unknown">Tidak Diketahui</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Aksi Pertandingan</h3>
                
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => onReloadRoster?.()}
                    disabled={isReloading}
                    className="flex items-center justify-center gap-3 p-5 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 rounded-2xl border border-zinc-200 dark:border-zinc-700 font-black italic uppercase tracking-wider text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all disabled:opacity-50 animate-in fade-in"
                  >
                    <Users size={18} className={isReloading ? 'animate-spin' : ''} /> {isReloading ? 'Reloading...' : 'Reload Roster'}
                  </button>
                  {match.teamId && onEditTeam && (
                    <button 
                      onClick={() => {
                        onEditTeam(match.teamId!);
                        onClose();
                      }}
                      className="flex items-center justify-center gap-3 p-5 bg-blue-50 dark:bg-blue-900/10 text-brand-navy dark:text-brand-orange rounded-2xl border border-blue-100 dark:border-blue-900/20 font-black italic uppercase tracking-wider text-sm hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all animate-in fade-in"
                    >
                      <Users size={18} /> Edit Roster Tim Kita
                    </button>
                  )}
                  {match.opponentTeamId && onEditTeam && (
                    <button 
                      onClick={() => {
                        onEditTeam(match.opponentTeamId!);
                        onClose();
                      }}
                      className="flex items-center justify-center gap-3 p-5 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/20 font-black italic uppercase tracking-wider text-sm hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-all animate-in fade-in"
                    >
                      <Users size={18} /> Edit Roster Tim Lawan
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-6 border-t border-zinc-100 dark:border-zinc-800 mt-6">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-black uppercase tracking-wider text-xs transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Batal
          </button>
          <button 
            onClick={handleSave}
            className="flex-[2] py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-black uppercase tracking-wider text-xs transition-all shadow-lg hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
          >
            <Save size={14} /> Update Match
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
