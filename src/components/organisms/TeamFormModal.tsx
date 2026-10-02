import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Wand2, Check, ChevronDown, X } from 'lucide-react';
import { Team, Player, Jersey, ChildProfile, Club } from '../../core/types/stats';
import { statsService } from '../../core/services/statsService';
import { generateId } from '../../core/utils/idUtils';
import { AITeamSetupModal } from './AITeamSetupModal';
import { COLOR_GROUPS } from '../molecules/ColorPicker';
import { QuickClubModal } from './QuickClubModal';
import { usePermissions } from '../../core/contexts/PermissionsContext';

interface TeamFormModalProps {
  team: Team | null;
  clubs: Club[];
  onClose: () => void;
  onSave: () => void;
  refreshClubs: () => void;
}

const STEPS = ['Info Tim', 'Warna Seragam', 'Pemain'];
const AGE_GROUPS = ['KU 8', 'KU 10', 'KU 12', 'KU 14', 'KU 16', 'KU 18', 'Senior'];
const SWATCHES = COLOR_GROUPS.flatMap(g => g.colors);

const inputCls = 'w-full p-3.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all';
const labelCls = 'block text-sm font-bold text-[#1A1A1A] dark:text-white mb-1';
const hintCls = 'text-xs text-zinc-500 dark:text-zinc-400 mb-2';

const JerseyPicker: React.FC<{ title: string; hint: string; theme: Jersey['theme']; value: Jersey; onChange: (j: Jersey) => void; initial: string }> = ({ title, hint, theme, value, onChange, initial }) => (
  <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50">
    <div className="flex items-center gap-4 mb-3">
      <div
        className="w-14 h-14 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xl font-black shrink-0 shadow-sm"
        style={{ backgroundColor: value.color, color: value.theme === 'gelap' ? '#fff' : '#111' }}
      >
        {initial}
      </div>
      <div>
        <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">{title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint} · <span className="font-semibold">{value.name}</span></p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {SWATCHES.filter(c => c.theme === theme).map(c => (
        <button
          key={c.value}
          type="button"
          title={c.name}
          aria-label={c.name}
          onClick={() => onChange({ color: c.value, theme: c.theme, name: c.name })}
          className={`w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${value.color === c.value ? 'ring-2 ring-offset-2 ring-brand-navy dark:ring-brand-orange dark:ring-offset-zinc-900' : ''}`}
          style={{ backgroundColor: c.value }}
        >
          {value.color === c.value && <Check size={14} className={c.theme === 'gelap' ? 'text-white' : 'text-black'} />}
        </button>
      ))}
      <label className="h-9 px-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center gap-2 text-xs font-bold text-zinc-500 cursor-pointer">
        Warna lain
        <input
          type="color"
          className="w-5 h-5 border-none bg-transparent cursor-pointer"
          value={value.color.startsWith('#') ? value.color : '#000000'}
          onChange={e => onChange({ ...value, color: e.target.value })}
        />
      </label>
    </div>
  </div>
);

export const TeamFormModal: React.FC<TeamFormModalProps> = ({ team, clubs, onClose, onSave, refreshClubs }) => {
  const { user } = usePermissions();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(team?.name || '');
  const [clubId, setClubId] = useState(team?.clubId || '');
  const [ageGroup, setAgeGroup] = useState(team?.ageGroup || '');
  const [logoUrl, setLogoUrl] = useState(team?.logoUrl || '');
  const [roster, setRoster] = useState<Player[]>(team?.roster || []);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [lightJersey, setLightJersey] = useState<Jersey>(team?.lightJersey || { color: '#ffffff', theme: 'terang', name: 'Putih' });
  const [darkJersey, setDarkJersey] = useState<Jersey>(team?.darkJersey || { color: 'var(--color-brand-navy)', theme: 'gelap', name: 'Navy' });
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [showQuickClubModal, setShowQuickClubModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    statsService.getProfiles().then(setProfiles);
  }, []);

  const inTeam = (p: ChildProfile) =>
    !!team && [p.mainTeamId, p.schoolTeamId, p.academyTeamId, p.loanTeamId].includes(team.id);
  const childrenInTeam = profiles.filter(inTeam);
  const manualPlayers = roster.map((p, i) => ({ p, i })).filter(({ p }) => !childrenInTeam.some(c => c.id === p.id));
  const initial = (name.trim()[0] || 'T').toUpperCase();
  const isLast = step === STEPS.length - 1 || !!team;

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await Promise.all(childrenInTeam.map(p => statsService.updateProfile(p)));
      const newTeam: Team = {
        id: team?.id || generateId('team'),
        name: name.trim(),
        clubId,
        logoUrl,
        ageGroup,
        roster: roster.filter(p => p.name.trim() || p.jersey.trim()),
        lightJersey,
        darkJersey,
        defaultColor: darkJersey.color,
        defaultTheme: darkJersey.theme,
        createdBy: team?.createdBy || user?.id
      };
      await (team ? statsService.updateTeam(newTeam) : statsService.addTeam(newTeam));
      onSave();
    } finally {
      setSaving(false);
    }
  };

  const updatePlayer = (index: number, field: keyof Player, value: any) =>
    setRoster(r => r.map((p, i) => (i === index ? { ...p, [field]: value } : p)));

  const updateProfile = (id: string, patch: Partial<ChildProfile>) =>
    setProfiles(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const addPlayer = () => {
    const id = generateId('p');
    setRoster(r => [...r, { id, name: '', jersey: '', isActive: true }]);
  };

  const handleAIExtract = (extracted: Partial<Player>[]) =>
    setRoster(r => [
      ...r,
      ...extracted.map((p, i) => ({ id: generateId('p'), name: p.name || `Pemain ${p.jersey || i + 1}`, jersey: p.jersey || '', isActive: true }))
    ]);

  const aliasField = (value: string[] | undefined, onChange: (v: string[]) => void) => (
    <input
      type="text"
      value={value?.join(', ') || ''}
      onChange={e => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
      className={inputCls}
      placeholder="Contoh: Ailin, Alin"
    />
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl p-6 relative shadow-2xl border border-zinc-100 dark:border-zinc-800 my-8 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between mb-1 shrink-0">
          <h2 className="text-2xl font-display font-black uppercase text-[#1A1A1A] dark:text-white">{team ? 'Ubah Tim' : 'Buat Tim Baru'}</h2>
          <button onClick={onClose} aria-label="Tutup" className="p-2 -mr-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"><X size={20} /></button>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 shrink-0">
          {team ? 'Pilih bagian yang ingin diubah, lalu simpan.' : 'Isi 3 langkah singkat. Hanya nama tim yang wajib — sisanya bisa dilengkapi nanti.'}
        </p>

        <ol className="flex gap-2 mb-6 shrink-0">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <button
                type="button"
                disabled={!name.trim() && i > 0}
                onClick={() => setStep(i)}
                className="w-full text-left disabled:cursor-not-allowed cursor-pointer"
              >
                <span className={`block h-1.5 rounded-full mb-2 ${i <= step ? 'bg-brand-navy dark:bg-brand-orange' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                <span className={`text-xs font-bold ${i === step ? 'text-[#1A1A1A] dark:text-white' : 'text-zinc-400'}`}>
                  {i + 1}. {label}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="flex-1 overflow-y-auto pr-1">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className={labelCls}>Nama tim <span className="text-red-500">*</span></label>
                <p className={hintCls}>Nama yang akan muncul di papan skor dan statistik.</p>
                <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Contoh: Garuda KU 12" />
              </div>

              <div>
                <label className={labelCls}>Kategori umur</label>
                <p className={hintCls}>KU = Kelompok Umur. Pilih yang sesuai, atau ketik sendiri.</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {AGE_GROUPS.map(ku => (
                    <button
                      key={ku}
                      type="button"
                      onClick={() => setAgeGroup(ageGroup === ku ? '' : ku)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${ageGroup === ku ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-white border-transparent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                    >
                      {ku}
                    </button>
                  ))}
                </div>
                <input type="text" value={ageGroup} onChange={e => setAgeGroup(e.target.value)} className={inputCls} placeholder="Atau ketik, misalnya: KU 11" />
              </div>

              <div>
                <label className={labelCls}>Klub atau sekolah <span className="font-normal text-zinc-400">(opsional)</span></label>
                <p className={hintCls}>Kosongkan kalau tim ini tidak berada di bawah klub/sekolah.</p>
                <div className="flex gap-2">
                  <select value={clubId} onChange={e => setClubId(e.target.value)} className={`flex-1 ${inputCls}`}>
                    <option value="">Tidak ada (tim mandiri)</option>
                    {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuickClubModal(true)}
                    className="px-4 bg-zinc-100 dark:bg-zinc-800 text-brand-navy dark:text-brand-orange rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus size={16} /> Klub baru
                  </button>
                </div>
              </div>

              <details className="group">
                <summary className="text-xs font-bold text-zinc-500 cursor-pointer list-none flex items-center gap-1">
                  <ChevronDown size={14} className="group-open:rotate-180 transition-transform" /> Logo tim (opsional)
                </summary>
                <p className={`${hintCls} mt-2`}>Tempel link gambar logo, misalnya dari Google Drive atau Instagram.</p>
                <input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className={inputCls} placeholder="https://..." />
              </details>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Tim basket biasanya punya <b>2 seragam</b>: satu warna terang dan satu warna gelap. Warna ini dipakai supaya tim mudah dibedakan saat mencatat pertandingan.
              </p>
              <JerseyPicker title="Seragam terang" hint="Biasanya dipakai saat main di kandang" theme="terang" value={lightJersey} onChange={setLightJersey} initial={initial} />
              <JerseyPicker title="Seragam gelap" hint="Biasanya dipakai saat tandang" theme="gelap" value={darkJersey} onChange={setDarkJersey} initial={initial} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Masukkan nomor punggung dan nama pemain. <b>Boleh dilewati</b> — pemain bisa ditambahkan kapan saja.
              </p>

              {childrenInTeam.map(p => (
                <div key={p.id} className="rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/20 p-2">
                  <div className="flex gap-2 items-center">
                    <div className="w-14 p-3 bg-white dark:bg-zinc-900 rounded-xl text-center text-sm font-bold">{p.jerseyNumber || '?'}</div>
                    <div className="flex-1 p-3 bg-white dark:bg-zinc-900 rounded-xl text-sm font-bold flex items-center justify-between gap-2">
                      {p.name}
                      <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black uppercase">Profil atlet</span>
                    </div>
                    <button type="button" onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="p-3 text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl cursor-pointer" aria-label="Detail">
                      <ChevronDown size={16} className={expanded === p.id ? 'rotate-180' : ''} />
                    </button>
                  </div>
                  {expanded === p.id && (
                    <div className="p-3 space-y-3">
                      <div>
                        <label className={labelCls}>Nama di punggung jersey</label>
                        <input type="text" value={p.displayName || ''} onChange={e => updateProfile(p.id, { displayName: e.target.value })} className={inputCls} placeholder="Contoh: Jordan" />
                      </div>
                      <div>
                        <label className={labelCls}>Nama panggilan untuk perintah suara</label>
                        <p className={hintCls}>Pisahkan dengan koma. Membantu fitur rekam suara mengenali pemain.</p>
                        {aliasField(p.voiceAliases, v => updateProfile(p.id, { voiceAliases: v }))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {manualPlayers.map(({ p, i }) => (
                <div key={p.id} className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-2">
                  <div className="flex gap-2 items-center">
                    <input type="text" inputMode="numeric" value={p.jersey} onChange={e => updatePlayer(i, 'jersey', e.target.value)} className="w-16 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center text-sm font-bold outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange" placeholder="No." aria-label="Nomor punggung" />
                    <input type="text" value={p.name} onChange={e => updatePlayer(i, 'name', e.target.value)} className="flex-1 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange" placeholder="Nama pemain" aria-label="Nama pemain" />
                    <button type="button" onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="p-3 text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer" aria-label="Detail pemain">
                      <ChevronDown size={16} className={expanded === p.id ? 'rotate-180' : ''} />
                    </button>
                    <button type="button" onClick={() => setRoster(r => r.filter((_, j) => j !== i))} className="p-3 text-zinc-400 hover:text-red-500 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer" aria-label="Hapus pemain">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {expanded === p.id && (
                    <div className="p-3 space-y-3">
                      <div>
                        <label className={labelCls}>Nama di punggung jersey</label>
                        <input type="text" value={p.displayName || ''} onChange={e => updatePlayer(i, 'displayName', e.target.value)} className={inputCls} placeholder="Contoh: Jordan" />
                      </div>
                      <div>
                        <label className={labelCls}>Nama panggilan untuk perintah suara</label>
                        <p className={hintCls}>Pisahkan dengan koma. Membantu fitur rekam suara mengenali pemain.</p>
                        {aliasField(p.voiceAliases, v => updatePlayer(i, 'voiceAliases', v))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {roster.length === 0 && childrenInTeam.length === 0 && (
                <div className="text-center p-6 text-sm text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  Belum ada pemain.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addPlayer} className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-brand-navy dark:text-brand-orange text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700">
                  <Plus size={14} /> Tambah pemain
                </button>
                <button type="button" onClick={() => setIsAIModalOpen(true)} className="px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40">
                  <Wand2 size={14} /> Isi otomatis dari foto daftar pemain
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 shrink-0">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="w-1/3 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            {step === 0 ? 'Batal' : 'Kembali'}
          </button>
          <button
            type="button"
            onClick={() => (isLast ? handleSave() : setStep(step + 1))}
            disabled={!name.trim() || saving}
            className="w-2/3 py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-white rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-sm cursor-pointer"
          >
            {saving ? 'Menyimpan...' : isLast ? (team ? 'Simpan Perubahan' : 'Simpan Tim') : 'Lanjut'}
          </button>
        </div>
      </div>

      <AITeamSetupModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onExtract={handleAIExtract} />

      <QuickClubModal
        isOpen={showQuickClubModal}
        onClose={() => setShowQuickClubModal(false)}
        onSuccess={newClub => {
          setClubId(newClub.id);
          refreshClubs();
        }}
      />
    </div>
  );
};
