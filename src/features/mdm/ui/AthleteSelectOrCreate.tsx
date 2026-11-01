import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Star } from 'lucide-react';
import { initDB } from '../../../lib/db';
import { ChildProfile } from '../../../entities/athlete/model/types';
import { generateId } from '../../../core/utils/idUtils';
import { areNamesSimilar } from '../../merge-player/model/mergeService';
import { getCurrentKU } from '../../../core/utils/ageCalculator';

interface Props {
  valueName: string;
  valueId?: string;
  jersey?: string;
  onPick: (p: { id: string; name: string; jersey?: string; isNew?: boolean }) => void;
  placeholder?: string;
}

/** Search existing profiles first; propose a new unclaimed profile only if none fit. */
export const AthleteSelectOrCreate: React.FC<Props> = ({ valueName, valueId, jersey, onPick, placeholder = 'Cari atau ketik nama pemain' }) => {
  const [q, setQ] = useState(valueName);
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [aliasHits, setAliasHits] = useState<Array<{ alias: string; canonicalId: string }>>([]);

  useEffect(() => {
    initDB().then(async (db) => {
      const list = (await db.getAll('profiles')) as ChildProfile[];
      setProfiles(list.filter((p) => !p.archived && !p.mergedIntoId));
      try {
        const aliases = await db.getAll('master_aliases');
        setAliasHits(
          (aliases || [])
            .filter((a: any) => a.entityType === 'athlete')
            .map((a: any) => ({ alias: a.aliasText, canonicalId: a.canonicalId }))
        );
      } catch {
        // store may not exist yet on first boot
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setQ(valueName);
  }, [valueName]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const byId = new Map<string, ChildProfile>();
    for (const p of profiles) {
      if (
        p.name.toLowerCase().includes(needle) ||
        p.displayName?.toLowerCase().includes(needle) ||
        (p.aliases || []).some((a) => a.toLowerCase().includes(needle)) ||
        areNamesSimilar(p.name, q)
      ) {
        byId.set(p.id, p);
      }
    }
    for (const a of aliasHits) {
      if (a.alias.toLowerCase().includes(needle) && !byId.has(a.canonicalId)) {
        const p = profiles.find((x) => x.id === a.canonicalId);
        if (p) byId.set(p.id, p);
      }
    }
    return Array.from(byId.values()).slice(0, 8);
  }, [q, profiles, aliasHits]);

  const exact = hits.find((p) => p.name.trim().toLowerCase() === q.trim().toLowerCase());

  const proposeNew = async () => {
    const name = q.trim();
    if (!name) return;
    const db = await initDB();
    const id = generateId('profile');
    const profile: ChildProfile = {
      id,
      name,
      jerseyNumber: jersey,
      claimStatus: 'unclaimed',
      isDiscoverable: true,
      aliases: [],
      transferHistory: [],
      links: [],
    };
    await db.put('profiles', profile);
    setProfiles((prev) => [...prev, profile]);
    onPick({ id, name, jersey, isNew: true });
    setOpen(false);
  };

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            onPick({ id: valueId || '', name: e.target.value, jersey });
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange"
          aria-label="Nama pemain"
        />
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {hits.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
              onClick={() => {
                onPick({ id: p.id, name: p.name, jersey: p.jerseyNumber || jersey });
                setQ(p.name);
                setOpen(false);
              }}
            >
              <span className="flex-1 text-sm font-semibold text-zinc-900 dark:text-white">{p.name}</span>
              {p.claimStatus === 'verified' && <Star size={12} className="text-amber-500" />}
              <span className="text-[10px] font-bold text-zinc-400 uppercase">{getCurrentKU(p.birthDate) || 'KU-?'}</span>
            </button>
          ))}
          {!exact && (
            <button type="button" onClick={proposeNew} className="w-full text-left px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800 text-brand-navy dark:text-brand-orange text-sm font-bold flex items-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <Plus size={14} /> Ajukan pemain baru: “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
};
