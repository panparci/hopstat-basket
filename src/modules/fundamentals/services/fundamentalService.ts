import { 
  FundamentalDrill, 
  AthleteProfile, 
  WorkoutScheduleDay, 
  DrillSubmission, 
  ClassroomQAThread,
  QAReply,
  PlayingPosition,
  SkillLevel,
  FacilityAccess
} from '../types';
import { DEFAULT_FUNDAMENTAL_DRILLS } from './fundamentalSeedData';
import { callGeminiRaw } from '../../../core/services/ai/utils';
import { initDB } from '../../../lib/db';

const DRILLS_STORE = 'fundamental_drills';
const PROFILE_STORE = 'fundamental_profiles';
const SCHEDULE_STORE = 'workout_schedules';
const SUBMISSIONS_STORE = 'drill_submissions';
const QA_STORE = 'classroom_qa';

class FundamentalService {
  // --- DRILLS LIBRARY ---
  async getDrills(): Promise<FundamentalDrill[]> {
    const db = await initDB();
    const stored = await db.getAll(DRILLS_STORE);
    if (Array.isArray(stored) && stored.length > 0) return stored;
    for (const drill of DEFAULT_FUNDAMENTAL_DRILLS) {
      await db.put(DRILLS_STORE, drill);
    }
    return DEFAULT_FUNDAMENTAL_DRILLS;
  }

  async saveDrill(drill: FundamentalDrill): Promise<FundamentalDrill[]> {
    const db = await initDB();
    await db.put(DRILLS_STORE, drill);
    return this.getDrills();
  }

  async bulkImportDrills(importedDrills: FundamentalDrill[], mode: 'append' | 'replace' = 'append'): Promise<FundamentalDrill[]> {
    const db = await initDB();
    if (mode === 'replace') {
      await db.clear(DRILLS_STORE);
      for (const drill of importedDrills) {
        await db.put(DRILLS_STORE, drill);
      }
      return importedDrills;
    }
    const current = await this.getDrills();
    const existingNames = new Set(current.map(d => d.name.toLowerCase().trim()));
    const newItems = importedDrills.filter(d => !existingNames.has(d.name.toLowerCase().trim()));
    for (const drill of newItems) {
      await db.put(DRILLS_STORE, drill);
    }
    return this.getDrills();
  }

  async deleteDrill(drillId: string): Promise<FundamentalDrill[]> {
    const db = await initDB();
    await db.delete(DRILLS_STORE, drillId);
    return this.getDrills();
  }

  async resetDefaultDrills(): Promise<FundamentalDrill[]> {
    const db = await initDB();
    await db.clear(DRILLS_STORE);
    for (const drill of DEFAULT_FUNDAMENTAL_DRILLS) {
      await db.put(DRILLS_STORE, drill);
    }
    return DEFAULT_FUNDAMENTAL_DRILLS;
  }

  // --- ATHLETE PROFILE ---
  async getAthleteProfile(): Promise<AthleteProfile | null> {
    const db = await initDB();
    const all = await db.getAll(PROFILE_STORE);
    return all[0] || null;
  }

  async saveAthleteProfile(profile: AthleteProfile): Promise<AthleteProfile> {
    const db = await initDB();
    await db.put(PROFILE_STORE, profile);
    return profile;
  }

  // --- WORKOUT SCHEDULE ---
  async getWorkoutSchedule(athleteId: string): Promise<WorkoutScheduleDay[]> {
    const db = await initDB();
    const row = await db.get(SCHEDULE_STORE, athleteId);
    return row?.days || [];
  }

  async saveWorkoutSchedule(athleteId: string, schedule: WorkoutScheduleDay[]): Promise<WorkoutScheduleDay[]> {
    const db = await initDB();
    await db.put(SCHEDULE_STORE, { id: athleteId, days: schedule });
    return schedule;
  }

  async toggleDrillCompletion(athleteId: string, dayId: string, drillId: string): Promise<WorkoutScheduleDay[]> {
    const schedule = await this.getWorkoutSchedule(athleteId);
    const dayIndex = schedule.findIndex(d => d.id === dayId);
    if (dayIndex >= 0) {
      const day = schedule[dayIndex];
      const updatedDrills = day.drills.map(d => {
        if (d.drillId === drillId) {
          return { ...d, completed: !d.completed };
        }
        return d;
      });
      const allCompleted = updatedDrills.every(d => d.completed);
      schedule[dayIndex] = {
        ...day,
        drills: updatedDrills,
        completedAt: allCompleted ? new Date().toISOString() : undefined
      };
      await this.saveWorkoutSchedule(athleteId, schedule);
    }
    return schedule;
  }

  // --- AI SCHEDULE GENERATOR ---
  async generateAISchedule(
    position: PlayingPosition,
    skillLevel: SkillLevel,
    facilityAccess: FacilityAccess,
    weeklyGoalDays: number = 4
  ): Promise<WorkoutScheduleDay[]> {
    const drills = await this.getDrills();

    // System instruction for Gemini AI Basketball Coach
    const systemInstruction = `Anda adalah AI Basketball Head Coach & Performance Director kelas dunia (Freeletics Basketball Coach). Tugas Anda adalah menyusun program latihan fundamental mingguan yang terstruktur secara ilmiah untuk atlet basket berdasarkan posisi, tingkat kemampuan, dan fasilitas.`;

    const prompt = `
Daftar gerakan fundamental yang tersedia di library:
${JSON.stringify(drills.map(d => ({ id: d.id, name: d.name, category: d.category, difficulty: d.difficulty, equipment: d.equipment })))}

Parameter Atlet:
- Posisi Bermain: ${position}
- Tingkat Kemampuan: ${skillLevel}
- Akses Fasilitas: ${facilityAccess}
- Target Hari Latihan per Minggu: ${weeklyGoalDays} hari

Instruksi Tambahan:
Susun jadwal latihan untuk 7 hari (Hari 1 hingga Hari 7, di mana ${weeklyGoalDays} hari adalah hari latihan aktif, sisanya hari istirahat/rest day).
Setiap hari latihan aktif harus memiliki 3-5 drill dari library yang relevan dengan posisi & fasilitas.

Format Output WAJIB berupa JSON Array valid murni tanpa text markdown pengantar, seperti format ini:
[
  {
    "dayIndex": 1,
    "dayTitle": "Hari 1: Ball Handling & Pocket Control",
    "focusArea": "Ball Handling",
    "estimatedMinutes": 45,
    "isRestDay": false,
    "drills": [
      { "drillId": "drill-cone-dribble-02", "sets": 4, "reps": "60 Detik", "notes": "Fokus pada kestabilan pinggul" }
    ]
  }
]
`;

    try {
      const aiResponseText = await callGeminiRaw(systemInstruction, prompt);
      const cleanedJson = aiResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const rawDays = JSON.parse(cleanedJson);

      if (Array.isArray(rawDays) && rawDays.length > 0) {
        const generatedSchedule: WorkoutScheduleDay[] = rawDays.map((d: any, idx: number) => ({
          id: `day-${idx + 1}-${Date.now()}`,
          athleteId: 'current-athlete',
          dayIndex: d.dayIndex || (idx + 1),
          dayTitle: d.dayTitle || `Hari ${idx + 1}`,
          focusArea: d.focusArea || 'Fundamental Practice',
          estimatedMinutes: d.estimatedMinutes || 40,
          isRestDay: !!d.isRestDay,
          drills: (d.drills || []).map((dr: any) => ({
            drillId: dr.drillId || drills[0]?.id || 'drill-mikan-01',
            sets: dr.sets || 4,
            reps: dr.reps || '10 Reps',
            notes: dr.notes || 'Jaga bentuk mekanik',
            completed: false
          }))
        }));
        return generatedSchedule;
      }
    } catch (err) {
      console.warn('AI Schedule Generation fallback to template routine:', err);
    }

    // Fallback Template if AI offline or JSON parse fails
    return this.createTemplateSchedule(drills, position, skillLevel, facilityAccess, weeklyGoalDays);
  }

  private createTemplateSchedule(
    drills: FundamentalDrill[],
    position: PlayingPosition,
    skillLevel: SkillLevel,
    facilityAccess: FacilityAccess,
    weeklyGoalDays: number
  ): WorkoutScheduleDay[] {
    const isGuard = position === 'PG' || position === 'SG';
    const isBig = position === 'C' || position === 'PF';

    const ballHandlingDrill = drills.find(d => d.category === 'ball_handling') || drills[0];
    const shootingDrill = drills.find(d => d.category === 'shooting') || drills[0];
    const footworkDrill = drills.find(d => d.category === 'footwork') || drills[0];
    const defenseDrill = drills.find(d => d.category === 'defense') || drills[0];
    const postDrill = drills.find(d => d.category === 'post_moves') || drills[0];

    return [
      {
        id: `day-1-${Date.now()}`,
        athleteId: 'current-athlete',
        dayIndex: 1,
        dayTitle: 'Hari 1: Ball Handling & Footwork Burst',
        focusArea: 'Ball Handling & Footwork',
        estimatedMinutes: 45,
        isRestDay: false,
        drills: [
          { drillId: ballHandlingDrill.id, sets: 4, reps: '60 Detik', notes: 'Fokus dribble rendah & pandangan lurus ke depan', completed: false },
          { drillId: footworkDrill.id, sets: 4, reps: '8 Reps per Sisi', notes: 'Jaga pivot tidak terangkat', completed: false },
          { drillId: shootingDrill.id, sets: 5, reps: '10 Makes', notes: 'Bentuk follow-through konsisten', completed: false }
        ]
      },
      {
        id: `day-2-${Date.now()}`,
        athleteId: 'current-athlete',
        dayIndex: 2,
        dayTitle: isBig ? 'Hari 2: Post Moves & Paint Dominance' : 'Hari 2: Perimeter Shooting & Form',
        focusArea: isBig ? 'Post Moves' : 'Shooting Consistency',
        estimatedMinutes: 50,
        isRestDay: false,
        drills: [
          { drillId: isBig ? postDrill.id : shootingDrill.id, sets: 5, reps: '10 Makes per Set', notes: 'Soft touch di bawah papan ring', completed: false },
          { drillId: footworkDrill.id, sets: 4, reps: '10 Reps', notes: 'Ubah arah secara eksplosif', completed: false },
          { drillId: defenseDrill.id, sets: 3, reps: '45 Detik', notes: 'Dada tegak, stance rendah', completed: false }
        ]
      },
      {
        id: `day-3-${Date.now()}`,
        athleteId: 'current-athlete',
        dayIndex: 3,
        dayTitle: 'Hari 3: Recovery & Video Analysis',
        focusArea: 'Active Recovery',
        estimatedMinutes: 20,
        isRestDay: true,
        drills: []
      },
      {
        id: `day-4-${Date.now()}`,
        athleteId: 'current-athlete',
        dayIndex: 4,
        dayTitle: 'Hari 4: Defensive Stance & Lateral Speed',
        focusArea: 'Defense & Conditioning',
        estimatedMinutes: 40,
        isRestDay: false,
        drills: [
          { drillId: defenseDrill.id, sets: 5, reps: '45 Detik per Set', notes: 'Push off menggunakan kaki belakang', completed: false },
          { drillId: ballHandlingDrill.id, sets: 4, reps: '60 Detik', notes: 'Uji daya tahan lengan', completed: false }
        ]
      },
      {
        id: `day-5-${Date.now()}`,
        athleteId: 'current-athlete',
        dayIndex: 5,
        dayTitle: 'Hari 5: Finishing & Game Simulation',
        focusArea: 'Finishing & Game Speed',
        estimatedMinutes: 55,
        isRestDay: false,
        drills: [
          { drillId: drills.find(d => d.id === 'drill-euro-step-05')?.id || footworkDrill.id, sets: 4, reps: '10 Makes per Set', notes: 'Simulasi defender tinggi', completed: false },
          { drillId: shootingDrill.id, sets: 5, reps: '10 Makes', notes: 'Catch and shoot ritme game', completed: false }
        ]
      },
      {
        id: `day-6-${Date.now()}`,
        athleteId: 'current-athlete',
        dayIndex: 6,
        dayTitle: 'Hari 6: Rest & Core Mobility',
        focusArea: 'Rest & Mobility',
        estimatedMinutes: 15,
        isRestDay: true,
        drills: []
      },
      {
        id: `day-7-${Date.now()}`,
        athleteId: 'current-athlete',
        dayIndex: 7,
        dayTitle: 'Hari 7: Weekly Challenge & Form Test',
        focusArea: 'Form Evaluation',
        estimatedMinutes: 45,
        isRestDay: false,
        drills: [
          { drillId: shootingDrill.id, sets: 5, reps: '10 Makes per Titik', notes: 'Rekam video tembakan untuk diserahkan ke coach', completed: false },
          { drillId: ballHandlingDrill.id, sets: 3, reps: '60 Detik', notes: 'Cetak rekor dribble tanpa lepas bola', completed: false }
        ]
      }
    ];
  }

  // --- SUBMISSIONS (GOOGLE CLASSROOM STYLE) ---
  async getSubmissions(): Promise<DrillSubmission[]> {
    const db = await initDB();
    return db.getAll(SUBMISSIONS_STORE);
  }

  async addSubmission(submission: Omit<DrillSubmission, 'id' | 'submittedAt' | 'status'>): Promise<DrillSubmission[]> {
    const db = await initDB();
    const newEntry: DrillSubmission = {
      ...submission,
      id: `sub-${Date.now()}`,
      status: 'submitted',
      submittedAt: new Date().toISOString()
    };
    await db.put(SUBMISSIONS_STORE, newEntry);
    return this.getSubmissions();
  }

  async addCoachFeedback(submissionId: string, feedback: { coachName: string; rating: number; comments: string; timestampNotes?: { time: string; note: string }[] }): Promise<DrillSubmission[]> {
    const db = await initDB();
    const current = await this.getSubmissions();
    const index = current.findIndex(s => s.id === submissionId);
    if (index >= 0) {
      current[index] = {
        ...current[index],
        status: 'reviewed',
        coachFeedback: {
          ...feedback,
          reviewedAt: new Date().toISOString()
        }
      };
      await db.put(SUBMISSIONS_STORE, current[index]);
    }
    return current;
  }

  // --- CLASSROOM Q&A THREADS ---
  async getQAThreads(): Promise<ClassroomQAThread[]> {
    const db = await initDB();
    return db.getAll(QA_STORE);
  }

  async addQAQuestion(athleteName: string, question: string, category: string, drillName?: string): Promise<ClassroomQAThread[]> {
    const db = await initDB();
    const newThread: ClassroomQAThread = {
      id: `qa-${Date.now()}`,
      athleteId: 'current-athlete',
      athleteName: athleteName || 'Atlet Basket',
      question,
      category: category || 'General Technique',
      drillName,
      createdAt: new Date().toISOString(),
      replies: []
    };
    await db.put(QA_STORE, newThread);
    return this.getQAThreads();
  }

  async addQAReply(threadId: string, authorName: string, authorRole: 'coach' | 'athlete', message: string): Promise<ClassroomQAThread[]> {
    const db = await initDB();
    const current = await this.getQAThreads();
    const index = current.findIndex(t => t.id === threadId);
    if (index >= 0) {
      const newReply: QAReply = {
        id: `rep-${Date.now()}`,
        authorName,
        authorRole,
        message,
        createdAt: new Date().toISOString()
      };
      current[index].replies.push(newReply);
      await db.put(QA_STORE, current[index]);
    }
    return current;
  }
}

export const fundamentalService = new FundamentalService();
