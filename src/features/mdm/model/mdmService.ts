import { initDB } from '../../../lib/db';
import { 
  MasterEntityType, 
  MasterEntityItem, 
  DuplicateCandidatePair, 
  MasterAlias, 
  MasterProposal, 
  MergeActionPayload, 
  EntityTypeConfig,
  MasterRecordStatus 
} from './types';
import { calculateSimilarity, isAcronymOrAbbrMatch, normalizeText } from './fuzzyMatcher';
import { generateId } from '../../../core/utils/idUtils';
import { Organization } from '../../../entities/organization/model/types';
import { Team, ChildProfile, Series, Match, MatchRoster } from '../../../core/types/stats';

export const ENTITY_CONFIGS: Record<MasterEntityType, EntityTypeConfig> = {
  club: {
    type: 'club',
    label: 'Klub Basket',
    pluralLabel: 'Klub-Klub Basket',
    iconName: 'Shield',
    description: 'Master klub binaan resmi basket berjenjang.',
    placeholder: 'Cari atau ajukan nama klub... (cth: Sahabat, Falcons)',
    contextFieldLabel: 'Kota Domisili',
    hasCity: true,
    hasAgeGroup: false,
    hasParentOrg: false,
  },
  training_squad: {
    type: 'training_squad',
    label: 'Tim Latihan Klub',
    pluralLabel: 'Tim-Tim Latihan',
    iconName: 'Users',
    description: 'Kelompok umur latihan reguler di dalam klub/sekolah.',
    placeholder: 'Cari tim latihan... (cth: Falcons U10 Reguler, Satria Muda KU12)',
    contextFieldLabel: 'Kategori KU',
    hasCity: false,
    hasAgeGroup: true,
    hasParentOrg: true,
  },
  competition_team: {
    type: 'competition_team',
    label: 'Tim Tanding Kompetisi',
    pluralLabel: 'Tim-Tim Tanding',
    iconName: 'Trophy',
    description: 'Tim kontingen yang didaftarkan khusus pada event turnamen.',
    placeholder: 'Cari tim tanding... (cth: Falcons White KU10, Bima Sakti Merah)',
    contextFieldLabel: 'Event & KU',
    hasCity: false,
    hasAgeGroup: true,
    hasParentOrg: true,
  },
  athlete: {
    type: 'athlete',
    label: 'Profil Atlet',
    pluralLabel: 'Daftar Atlet',
    iconName: 'UserCheck',
    description: 'Master identitas anak/atlet yang tercatat bertanding.',
    placeholder: 'Cari atlet... (cth: Kenzo Rafif, Ryan Ardiansyah)',
    contextFieldLabel: 'Tahun Lahir / KU',
    hasCity: false,
    hasAgeGroup: true,
    hasParentOrg: true,
  },
  school: {
    type: 'school',
    label: 'Sekolah',
    pluralLabel: 'Sekolah-Sekolah',
    iconName: 'GraduationCap',
    description: 'Master institusi pendidikan formal (SD, SMP, SMA, Kampus).',
    placeholder: 'Cari sekolah... (cth: SMA Kolese Kanisius, SMPN 1)',
    contextFieldLabel: 'Kota & Jenjang',
    hasCity: true,
    hasAgeGroup: false,
    hasParentOrg: false,
  },
  academy: {
    type: 'academy',
    label: 'Akademi Basket',
    pluralLabel: 'Akademi-Akademi',
    iconName: 'Award',
    description: 'Program clinic & kursus privat/berbayar basket.',
    placeholder: 'Cari akademi... (cth: DBL Academy, Rockstar Gym)',
    contextFieldLabel: 'Kota Cabang',
    hasCity: true,
    hasAgeGroup: false,
    hasParentOrg: false,
  },
  tournament: {
    type: 'tournament',
    label: 'Event Turnamen',
    pluralLabel: 'Event-Event Turnamen',
    iconName: 'Calendar',
    description: 'Golden record kejuaraan, liga, atau turnamen resmi.',
    placeholder: 'Cari event turnamen... (cth: Kejurkot Jakpus 2026)',
    contextFieldLabel: 'Kota & Tahun',
    hasCity: true,
    hasAgeGroup: false,
    hasParentOrg: false,
  }
};

export const mdmService = {
  getEntityConfigs(): EntityTypeConfig[] {
    return Object.values(ENTITY_CONFIGS);
  },

  getEntityConfig(type: MasterEntityType): EntityTypeConfig {
    return ENTITY_CONFIGS[type] || ENTITY_CONFIGS.club;
  },

  /**
   * Mengambil semua alias yang terdaftar untuk entitas tertentu atau canonicalId tertentu
   */
  async getAliases(canonicalId?: string): Promise<MasterAlias[]> {
    const db = await initDB();
    if (canonicalId) {
      return db.getAllFromIndex('master_aliases', 'by-canonical', canonicalId);
    }
    return db.getAll('master_aliases');
  },

  /**
   * Menambahkan alias baru ke Golden Record
   */
  async addAlias(canonicalId: string, entityType: MasterEntityType, aliasText: string): Promise<MasterAlias> {
    const db = await initDB();
    const cleanText = aliasText.trim();
    const newAlias: MasterAlias = {
      id: `als_${generateId()}`,
      entityType,
      canonicalId,
      aliasText: cleanText,
      normalizedText: normalizeText(cleanText),
      source: 'admin_merged',
      createdAt: new Date().toISOString()
    };
    await db.put('master_aliases', newAlias);
    return newAlias;
  },

  /**
   * Menghapus alias
   */
  async deleteAlias(aliasId: string): Promise<void> {
    const db = await initDB();
    await db.delete('master_aliases', aliasId);
  },

  /**
   * Mengambil seluruh entity items dalam bentuk unified MasterEntityItem
   */
  async listEntities(
    type: MasterEntityType, 
    options?: { status?: MasterRecordStatus; search?: string }
  ): Promise<MasterEntityItem[]> {
    const db = await initDB();
    const aliases = await this.getAliases();
    const aliasesByCanonical: Record<string, string[]> = {};
    aliases.forEach(a => {
      if (!aliasesByCanonical[a.canonicalId]) aliasesByCanonical[a.canonicalId] = [];
      aliasesByCanonical[a.canonicalId].push(a.aliasText);
    });

    // Ambil matches dan rosters untuk hitung transaksi terkait
    const allMatches = await db.getAll('matches');
    const allRosters = await db.getAll('match_rosters');

    const result: MasterEntityItem[] = [];

    if (type === 'club' || type === 'school' || type === 'academy') {
      const orgs: Organization[] = await db.getAll('organizations');
      const filteredOrgs = orgs.filter(o => o.type === type);

      for (const org of filteredOrgs) {
        // Transaksi matches di mana tim terafiliasi dengan org ini
        const txCount = allMatches.filter(m => m.teamId?.includes(org.id) || m.opponentTeamId?.includes(org.id)).length;
        
        let status: MasterRecordStatus = 'canonical';
        if (org.status === 'pending') status = 'pending';
        else if (org.status === 'merged') status = 'merged';

        result.push({
          id: org.id,
          entityType: type,
          name: org.name,
          city: org.city,
          province: org.province,
          status,
          canonicalId: org.mergedIntoId,
          aliases: aliasesByCanonical[org.id] || [],
          transactionCount: txCount,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt
        });
      }
    } else if (type === 'training_squad') {
      const teams: Team[] = await db.getAll('teams');
      // Tim latihan biasanya tidak terikat dengan event series khusus atau merupakan roster klub
      const orgs = await db.getAll('organizations');
      const orgMap = new Map(orgs.map(o => [o.id, o.name]));

      for (const t of teams) {
        const isSquad = !t.name.toLowerCase().includes('tanding') && !t.name.toLowerCase().includes('cup');
        if (!isSquad && teams.length > 2) continue;

        let status: MasterRecordStatus = 'canonical';
        if (t.status === 'pending') status = 'pending';
        else if (t.status === 'merged' || t.mergedIntoId) status = 'merged';

        const txCount = allMatches.filter(m => m.teamId === t.id || m.opponentTeamId === t.id).length;

        result.push({
          id: t.id,
          entityType: 'training_squad',
          name: t.name,
          ageGroup: t.ageGroup || t.divisionCode || 'KU-Umum',
          parentOrgId: t.organizationId || t.clubId,
          parentOrgName: t.organizationId ? orgMap.get(t.organizationId) : undefined,
          status,
          canonicalId: t.mergedIntoId,
          aliases: aliasesByCanonical[t.id] || [],
          transactionCount: txCount,
          rosterCount: t.roster?.length || 0,
          createdAt: t.createdAt
        });
      }
    } else if (type === 'competition_team') {
      const teams: Team[] = await db.getAll('teams');
      const orgs = await db.getAll('organizations');
      const orgMap = new Map(orgs.map(o => [o.id, o.name]));

      for (const t of teams) {
        let status: MasterRecordStatus = 'canonical';
        if (t.status === 'pending') status = 'pending';
        else if (t.status === 'merged' || t.mergedIntoId) status = 'merged';

        const txCount = allMatches.filter(m => m.teamId === t.id || m.opponentTeamId === t.id).length;

        result.push({
          id: t.id,
          entityType: 'competition_team',
          name: t.name,
          ageGroup: t.ageGroup || t.divisionCode || 'KU-16',
          parentOrgId: t.organizationId || t.clubId,
          parentOrgName: t.organizationId ? orgMap.get(t.organizationId) : undefined,
          status,
          canonicalId: t.mergedIntoId,
          aliases: aliasesByCanonical[t.id] || [],
          transactionCount: txCount,
          rosterCount: t.roster?.length || 0,
          createdAt: t.createdAt
        });
      }
    } else if (type === 'athlete') {
      const profiles: ChildProfile[] = await db.getAll('profiles');
      for (const p of profiles) {
        const txCount = allRosters.filter(r => r.profileId === p.id).length;
        
        let status: MasterRecordStatus = 'canonical';
        if (p.archived) status = 'merged';
        else if ((p as any).status === 'pending') status = 'pending';

        result.push({
          id: p.id,
          entityType: 'athlete',
          name: p.name,
          ageGroup: p.birthDate ? `Lahir: ${p.birthDate}` : 'KU N/A',
          status,
          canonicalId: (p as any).mergedIntoId,
          aliases: aliasesByCanonical[p.id] || [],
          transactionCount: txCount,
          createdAt: (p as any).createdAt
        });
      }
    } else if (type === 'tournament') {
      const seriesList: Series[] = await db.getAll('series');
      for (const s of seriesList) {
        const txCount = allMatches.filter(m => m.seriesId === s.id || m.eventName?.toLowerCase() === s.name.toLowerCase()).length;
        
        let status: MasterRecordStatus = 'canonical';
        if ((s as any).status === 'pending') status = 'pending';
        else if ((s as any).status === 'merged') status = 'merged';

        result.push({
          id: s.id,
          entityType: 'tournament',
          name: s.name,
          city: (s as any).city || 'Jakarta',
          status,
          canonicalId: (s as any).mergedIntoId,
          aliases: aliasesByCanonical[s.id] || [],
          transactionCount: txCount,
          createdAt: s.startDate
        });
      }
    }

    // Filter by options
    let filtered = result;
    if (options?.status) {
      filtered = filtered.filter(i => i.status === options.status);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(i => 
        i.name.toLowerCase().includes(q) ||
        (i.city && i.city.toLowerCase().includes(q)) ||
        (i.ageGroup && i.ageGroup.toLowerCase().includes(q)) ||
        i.aliases.some(a => a.toLowerCase().includes(q))
      );
    }

    return filtered;
  },

  /**
   * Select-or-Create Search Engine (dengan deteksi Alias & Kemiripan)
   */
  async searchSelectOrCreate(
    type: MasterEntityType,
    query: string,
    context?: Record<string, any>
  ): Promise<{
    canonicalMatches: MasterEntityItem[];
    aliasMatches: { alias: MasterAlias; canonicalItem: MasterEntityItem }[];
    similarSuggestions: { item: MasterEntityItem; similarity: number; reason: string }[];
    canProposeNew: boolean;
  }> {
    const q = query.trim();
    if (!q) {
      const canonicals = await this.listEntities(type, { status: 'canonical' });
      return {
        canonicalMatches: canonicals.slice(0, 10),
        aliasMatches: [],
        similarSuggestions: [],
        canProposeNew: false
      };
    }

    const allItems = await this.listEntities(type);
    const aliases = await this.getAliases();
    const itemMap = new Map<string, MasterEntityItem>(allItems.map(i => [i.id, i]));

    // 1. Direct Canonical Matches
    const canonicalMatches = allItems.filter(item => 
      item.status === 'canonical' && 
      (normalizeText(item.name).includes(normalizeText(q)) || normalizeText(q).includes(normalizeText(item.name)))
    );

    // 2. Alias Matches
    const aliasMatches: { alias: MasterAlias; canonicalItem: MasterEntityItem }[] = [];
    const normQ = normalizeText(q);
    aliases.forEach(a => {
      if (a.entityType === type && (a.normalizedText.includes(normQ) || normQ.includes(a.normalizedText))) {
        const canonical = itemMap.get(a.canonicalId);
        if (canonical && canonical.status === 'canonical') {
          aliasMatches.push({ alias: a, canonicalItem: canonical });
        }
      }
    });

    // 3. Similar Suggestions (Fuzzy Matching)
    const similarSuggestions: { item: MasterEntityItem; similarity: number; reason: string }[] = [];
    allItems.forEach(item => {
      if (item.status === 'merged') return;
      if (canonicalMatches.some(m => m.id === item.id)) return;

      const score = calculateSimilarity(item.name, q);
      const isAcronym = isAcronymOrAbbrMatch(item.name, q);

      let finalScore = score;
      const reasons: string[] = [];

      if (score >= 60) {
        reasons.push(`Nama mirip (${score}%)`);
      }
      if (isAcronym) {
        finalScore = Math.max(finalScore, 78);
        reasons.push('Pola singkatan/kata kunci awal cocok');
      }

      // Context bonus: e.g. same city or age group
      if (context?.city && item.city && normalizeText(context.city) === normalizeText(item.city)) {
        finalScore = Math.min(100, finalScore + 10);
        reasons.push(`Kota sama (${item.city})`);
      }

      // 4. Special Athlete KU Logic
      if (type === 'athlete' && context?.targetKU && item.ageGroup) {
        // ageGroup for athletes in this mock stores "Lahir: YYYY-MM-DD" or similar
        const birthYearMatch = item.ageGroup.match(/(\d{4})/);
        if (birthYearMatch) {
          const birthYear = parseInt(birthYearMatch[1]);
          const matchYear = context.matchYear || new Date().getFullYear();
          const athleteKU = matchYear - birthYear;
          
          if (athleteKU === context.targetKU) {
            finalScore = Math.min(100, finalScore + 15);
            reasons.push(`KU Cocok (Lahir ${birthYear} -> KU-${athleteKU})`);
          } else if (athleteKU < context.targetKU) {
            finalScore = Math.min(100, finalScore + 5);
            reasons.push(`KU Memenuhi Syarat (Playing Up dari KU-${athleteKU})`);
          } else {
            // Overage: Significant penalty
            finalScore = Math.max(0, finalScore - 40);
            reasons.push(`Overage (KU-${athleteKU} tidak boleh main di KU-${context.targetKU})`);
          }
        }
      }

      if (finalScore >= 65) {
        similarSuggestions.push({
          item,
          similarity: finalScore,
          reason: reasons.join(' • ')
        });
      }
    });

    similarSuggestions.sort((a, b) => b.similarity - a.similarity);

    return {
      canonicalMatches,
      aliasMatches,
      similarSuggestions: similarSuggestions.slice(0, 5),
      canProposeNew: q.length >= 3 && canonicalMatches.length === 0
    };
  },

  /**
   * Mengajukan rekaman baru (Pending Proposal)
   */
  async proposeNewRecord(
    type: MasterEntityType,
    name: string,
    context?: Record<string, any>
  ): Promise<MasterEntityItem> {
    const db = await initDB();
    const cleanName = name.trim();
    const newId = `${type.slice(0, 3)}_${generateId()}`;

    // Cari kemiripan saat mengajukan
    const check = await this.searchSelectOrCreate(type, cleanName, context);
    const suggestedMatches = check.similarSuggestions.map(s => ({
      canonicalId: s.item.id,
      name: s.item.name,
      similarity: s.similarity,
      reason: s.reason
    }));

    // Simpan proposal
    const proposal: MasterProposal = {
      id: `prop_${generateId()}`,
      entityType: type,
      proposedName: cleanName,
      contextData: context,
      suggestedMatches,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.put('master_proposals', proposal);

    // Simpan di store target dengan status 'pending'
    if (type === 'club' || type === 'school' || type === 'academy') {
      const org: Organization = {
        id: newId,
        name: cleanName,
        type: type,
        city: context?.city || 'Jakarta',
        province: context?.province || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.put('organizations', org);
    } else if (type === 'training_squad' || type === 'competition_team') {
      const team: Team = {
        id: newId,
        name: cleanName,
        organizationId: context?.parentOrgId,
        clubId: context?.parentOrgId,
        ageGroup: context?.ageGroup || 'KU-14',
        divisionCode: context?.ageGroup || 'KU-14',
        roster: [],
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await db.put('teams', team);
    } else if (type === 'athlete') {
      const profile: ChildProfile = {
        id: generateId('profile'),
        name: cleanName,
        birthDate: context?.birthDate || undefined,
        isDiscoverable: true,
        claimStatus: 'unclaimed',
        aliases: [],
        links: [],
        transferHistory: [],
      };
      (profile as any).status = 'pending';
      (profile as any).createdAt = new Date().toISOString();
      await db.put('profiles', profile);
      // Use the real profile id for the returned item
      (proposal as any)._createdEntityId = profile.id;
      return {
        id: profile.id,
        entityType: type,
        name: cleanName,
        city: context?.city,
        ageGroup: context?.ageGroup,
        status: 'pending',
        aliases: [],
        transactionCount: 0,
        createdAt: new Date().toISOString()
      };
    } else if (type === 'tournament') {
      const series: Series = {
        id: newId,
        name: cleanName,
        description: 'Usulan turnamen baru',
        startDate: new Date().toISOString().split('T')[0]
      };
      (series as any).status = 'pending';
      (series as any).city = context?.city || 'Jakarta';
      await db.put('series', series);
    }

    return {
      id: newId,
      entityType: type,
      name: cleanName,
      city: context?.city,
      ageGroup: context?.ageGroup,
      status: 'pending',
      aliases: [],
      transactionCount: 0,
      createdAt: new Date().toISOString()
    };
  },

  /**
   * Menemukan pasangan kandidat duplikat otomatis di seluruh database
   */
  async getDuplicateCandidates(type: MasterEntityType): Promise<DuplicateCandidatePair[]> {
    const allItems = await this.listEntities(type);
    const activeItems = allItems.filter(i => i.status !== 'merged');
    const duplicates: DuplicateCandidatePair[] = [];

    for (let i = 0; i < activeItems.length; i++) {
      for (let j = i + 1; j < activeItems.length; j++) {
        const itemA = activeItems[i];
        const itemB = activeItems[j];

        // Hitung similarity
        const nameSim = calculateSimilarity(itemA.name, itemB.name);
        const isAcronym = isAcronymOrAbbrMatch(itemA.name, itemB.name);

        let finalSim = nameSim;
        const reasons: string[] = [];

        if (nameSim >= 65) {
          reasons.push(`Nama mirip ${nameSim}%`);
        }
        if (isAcronym) {
          finalSim = Math.max(finalSim, 80);
          reasons.push('Singkatan / Akronim cocok');
        }

        // Cek konteks kota
        if (itemA.city && itemB.city) {
          if (normalizeText(itemA.city) === normalizeText(itemB.city)) {
            finalSim = Math.min(100, finalSim + 10);
            reasons.push(`Domisili kota sama (${itemA.city})`);
          } else {
            // Kota berbeda mengurangi kemungkinan duplikat
            finalSim = Math.max(0, finalSim - 25);
          }
        }

        // Cek kategori KU untuk tim atau atlet
        if (itemA.ageGroup && itemB.ageGroup && itemA.ageGroup === itemB.ageGroup) {
          reasons.push(`Kategori kelompok umur identik (${itemA.ageGroup})`);
        }

        if (finalSim >= 68) {
          // Tentukan mana yang menjadi canonicalTarget (yang sudah berstatus canonical atau memiliki transaksi lebih banyak)
          const aIsBetter = (itemA.status === 'canonical' && itemB.status !== 'canonical') ||
                            (itemA.transactionCount >= itemB.transactionCount);
          
          const canonicalTarget = aIsBetter ? itemA : itemB;
          const sourceItem = aIsBetter ? itemB : itemA;

          duplicates.push({
            id: `dup_${sourceItem.id}_${canonicalTarget.id}`,
            entityType: type,
            sourceItem,
            canonicalTarget,
            similarityScore: finalSim,
            matchReasons: reasons,
            detectedAt: new Date().toISOString()
          });
        }
      }
    }

    return duplicates.sort((a, b) => b.similarityScore - a.similarityScore);
  },

  /**
   * Menjadikan sebuah item sebagai Golden Record resmi (Canonical)
   */
  async promoteToCanonical(type: MasterEntityType, id: string, updatedName?: string): Promise<void> {
    const db = await initDB();

    if (type === 'club' || type === 'school' || type === 'academy') {
      const org = await db.get('organizations', id);
      if (org) {
        const oldName = org.name;
        org.status = 'verified';
        if (updatedName && updatedName.trim()) {
          org.name = updatedName.trim();
          if (oldName !== org.name) {
            await this.addAlias(id, type, oldName);
          }
        }
        await db.put('organizations', org);
      }
    } else if (type === 'training_squad' || type === 'competition_team') {
      const team = await db.get('teams', id);
      if (team) {
        team.status = 'active';
        if (updatedName && updatedName.trim()) team.name = updatedName.trim();
        await db.put('teams', team);
      }
    } else if (type === 'athlete') {
      const profile = await db.get('profiles', id);
      if (profile) {
        (profile as any).status = 'canonical';
        if (updatedName && updatedName.trim()) profile.name = updatedName.trim();
        await db.put('profiles', profile);
      }
    } else if (type === 'tournament') {
      const series = await db.get('series', id);
      if (series) {
        (series as any).status = 'canonical';
        if (updatedName && updatedName.trim()) series.name = updatedName.trim();
        await db.put('series', series);
      }
    }
  },

  /**
   * Menggabungkan (Merge) Source Item ke Target Canonical Record
   */
  async executeMerge(payload: MergeActionPayload): Promise<void> {
    const { entityType, sourceId, canonicalTargetId, retainSourceAsAlias } = payload;
    const db = await initDB();

    // 1. Ambil data source
    const all = await this.listEntities(entityType);
    const source = all.find(i => i.id === sourceId);
    const target = all.find(i => i.id === canonicalTargetId);

    if (!source || !target) {
      throw new Error('Data sumber atau target canonical tidak ditemukan!');
    }

    // 2. Simpan nama source sebagai Alias resmi untuk target jika diminta
    if (retainSourceAsAlias && source.name !== target.name) {
      await this.addAlias(canonicalTargetId, entityType, source.name);
    }

    // Pindahkan juga semua alias lama milik source ke target
    const sourceAliases = await db.getAllFromIndex('master_aliases', 'by-canonical', sourceId);
    for (const sa of sourceAliases) {
      sa.canonicalId = canonicalTargetId;
      await db.put('master_aliases', sa);
    }

    // 3. Update status source menjadi 'merged' dan simpan canonicalId
    if (entityType === 'club' || entityType === 'school' || entityType === 'academy') {
      const sourceOrg = await db.get('organizations', sourceId);
      if (sourceOrg) {
        sourceOrg.status = 'merged';
        sourceOrg.mergedIntoId = canonicalTargetId;
        await db.put('organizations', sourceOrg);
      }

      // Re-point semua tim di sourceOrg ke targetOrg
      const teams = await db.getAll('teams');
      for (const t of teams) {
        if (t.organizationId === sourceId) {
          t.organizationId = canonicalTargetId;
          await db.put('teams', t);
        }
      }
    } else if (entityType === 'training_squad' || entityType === 'competition_team') {
      const sourceTeam = await db.get('teams', sourceId);
      const targetTeam = await db.get('teams', canonicalTargetId);
      if (sourceTeam && targetTeam) {
        sourceTeam.status = 'merged';
        sourceTeam.mergedIntoId = canonicalTargetId;
        await db.put('teams', sourceTeam);

        // Gabungkan roster
        const mergedRoster = [...(targetTeam.roster || [])];
        if (sourceTeam.roster) {
          sourceTeam.roster.forEach(p => {
            if (!mergedRoster.some(ep => ep.id === p.id || ep.name.toLowerCase() === p.name.toLowerCase())) {
              mergedRoster.push(p);
            }
          });
        }
        targetTeam.roster = mergedRoster;
        await db.put('teams', targetTeam);

        // Re-point matches
        const matches = await db.getAll('matches');
        for (const m of matches) {
          let changed = false;
          if (m.teamId === sourceId) {
            m.teamId = canonicalTargetId;
            changed = true;
          }
          if (m.opponentTeamId === sourceId) {
            m.opponentTeamId = canonicalTargetId;
            changed = true;
          }
          if (changed) await db.put('matches', m);
        }
      }
    } else if (entityType === 'athlete') {
      // Reuse existing merge-player service (aliases, claims, insights, undo log)
      const { mergeService } = await import('../../merge-player/model/mergeService');
      await mergeService.executeMerge(canonicalTargetId, sourceId, {});
    } else if (entityType === 'tournament') {
      const sourceSeries = await db.get('series', sourceId);
      if (sourceSeries) {
        (sourceSeries as any).status = 'merged';
        (sourceSeries as any).mergedIntoId = canonicalTargetId;
        await db.put('series', sourceSeries);

        // Re-point matches
        const matches = await db.getAll('matches');
        for (const m of matches) {
          if (m.seriesId === sourceId) {
            m.seriesId = canonicalTargetId;
            await db.put('matches', m);
          }
        }
      }
    }

    // 4. Catat Log Riwayat Penggabungan (Audit)
    const mergeLog = {
      id: `mlog_${generateId()}`,
      timestamp: new Date().toISOString(),
      primaryId: canonicalTargetId,
      secondaryId: sourceId,
      primaryName: target.name,
      secondaryName: source.name,
      previousPrimaryState: target as any,
      previousSecondaryState: source as any,
      reassignedCounts: {
        matchRosters: source.transactionCount || 0,
        events: 0,
        matchStints: 0,
        transferHistory: 0
      },
      details: {
        entityType,
        retainedAlias: retainSourceAsAlias ? source.name : undefined,
        notes: payload.notes || 'Merged via MDM Console'
      }
    };
    await db.put('merge_logs', mergeLog as any);
  },

  /**
   * Mengambil riwayat merge
   */
  async getMergeLogs(): Promise<any[]> {
    const db = await initDB();
    const logs = await db.getAll('merge_logs');
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  /**
   * Melakukan Rollback Merge (Membatalkan penggabungan)
   */
  async rollbackMerge(logId: string): Promise<void> {
    const db = await initDB();
    const log = await db.get('merge_logs', logId);
    if (!log) throw new Error('Log merge tidak ditemukan');

    const entityType = (log.details as any)?.entityType as MasterEntityType || 'club';
    const sourceId = log.secondaryId;

    // Kembalikan status source
    if (entityType === 'club' || entityType === 'school' || entityType === 'academy') {
      const org = await db.get('organizations', sourceId);
      if (org) {
        org.status = 'pending';
        delete org.mergedIntoId;
        await db.put('organizations', org);
      }
    } else if (entityType === 'training_squad' || entityType === 'competition_team') {
      const team = await db.get('teams', sourceId);
      if (team) {
        team.status = 'active';
        delete team.mergedIntoId;
        await db.put('teams', team);
      }
    } else if (entityType === 'athlete') {
      const profile = await db.get('profiles', sourceId);
      if (profile) {
        profile.archived = false;
        delete (profile as any).mergedIntoId;
        await db.put('profiles', profile);
      }
    } else if (entityType === 'tournament') {
      const series = await db.get('series', sourceId);
      if (series) {
        (series as any).status = 'canonical';
        delete (series as any).mergedIntoId;
        await db.put('series', series);
      }
    }

    // Hapus log
    await db.delete('merge_logs', logId);
  },

  /**
   * Seed Data Awal Realistis (jika belum ada) agar Admin Console langsung siap didemonstrasikan
   */
  async seedSampleMdmDataIfNeeded(): Promise<void> {
    const db = await initDB();
    const orgs = await db.getAll('organizations');
    
    // Pastikan beberapa master organisasi dan duplikat terdaftar
    const sampleOrgs: Organization[] = [
      {
        id: 'clb_sahabat_smg',
        name: 'Sahabat Basketball Semarang',
        type: 'club',
        city: 'Semarang',
        province: 'Jawa Tengah',
        status: 'verified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'clb_sahabat_dup',
        name: 'Sahabat Arena',
        type: 'club',
        city: 'Semarang',
        province: 'Jawa Tengah',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sch_kanisius_jkt',
        name: 'SMA Kolese Kanisius',
        type: 'school',
        city: 'Jakarta Pusat',
        province: 'DKI Jakarta',
        status: 'verified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sch_kanisius_dup',
        name: 'SMA Kanisius Menteng',
        type: 'school',
        city: 'Jakarta Pusat',
        province: 'DKI Jakarta',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'acd_dbl_sby',
        name: 'DBL Academy Surabaya',
        type: 'academy',
        city: 'Surabaya',
        province: 'Jawa Timur',
        status: 'verified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'acd_dbl_dup',
        name: 'DBL Basketball Academy',
        type: 'academy',
        city: 'Surabaya',
        province: 'Jawa Timur',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const so of sampleOrgs) {
      const exists = orgs.some(o => o.id === so.id || o.name.toLowerCase() === so.name.toLowerCase());
      if (!exists) {
        await db.put('organizations', so);
      }
    }

    // Seed sample alias
    const existingAliases = await db.getAll('master_aliases');
    if (existingAliases.length === 0) {
      const sampleAliases: MasterAlias[] = [
        {
          id: 'als_1',
          entityType: 'club',
          canonicalId: 'clb_sahabat_smg',
          aliasText: 'Sahabat Arena SMG',
          normalizedText: normalizeText('Sahabat Arena SMG'),
          source: 'admin_merged',
          createdAt: new Date().toISOString()
        },
        {
          id: 'als_2',
          entityType: 'school',
          canonicalId: 'sch_kanisius_jkt',
          aliasText: 'Canisius College High School',
          normalizedText: normalizeText('Canisius College High School'),
          source: 'user_input',
          createdAt: new Date().toISOString()
        }
      ];
      for (const sa of sampleAliases) {
        await db.put('master_aliases', sa);
      }
    }

    // Seed sample tournament
    const seriesList = await db.getAll('series');
    if (seriesList.length <= 1) {
      const sampleSeries: Series[] = [
        {
          id: 'trm_kejurkot_jakpus_26',
          name: 'Kejuaraan Kota Jakarta Pusat 2026',
          description: 'Kejurkot Resmi Pengkot Perbasi Jakarta Pusat',
          startDate: '2026-05-10'
        },
        {
          id: 'trm_kejurkot_dup',
          name: 'Kejurkot Jakpus 26',
          description: 'Usulan operator lapangan',
          startDate: '2026-05-12'
        }
      ];
      for (const ss of sampleSeries) {
        (ss as any).status = ss.id === 'trm_kejurkot_dup' ? 'pending' : 'canonical';
        (ss as any).city = 'Jakarta Pusat';
        await db.put('series', ss);
      }
    }
  }
};
