import * as XLSX from 'xlsx';
import { FundamentalDrill, DrillCategory, SkillLevel } from '../types';
import { DEFAULT_FUNDAMENTAL_DRILLS } from './fundamentalSeedData';

export interface DrillExcelRow {
  'Nama Drill': string;
  'Kategori': string;
  'Tingkat Kesulitan': string;
  'URL Video YouTube': string;
  'Detik Mulai Loop': number;
  'Detik Selesai Loop'?: number;
  'Rekomendasi Set': number;
  'Rekomendasi Repetisi': string;
  'Deskripsi': string;
  'Kunci Mekanika (Pisahkan dengan Titik Koma ;)': string;
  'Target Otot (Pisahkan dengan Titik Koma ;)': string;
  'Peralatan (Pisahkan dengan Titik Koma ;)': string;
  'URL Thumbnail (Opsional)'?: string;
}

export interface ParsedDrillResult {
  drills: FundamentalDrill[];
  errors: string[];
  warnings: string[];
}

/**
 * Extract YouTube 11-character video ID from any YouTube URL or ID
 */
export function extractYouTubeId(urlOrId: string): string {
  if (!urlOrId) return '0j3aY_z1Jro';
  const str = urlOrId.trim();
  if (str.length === 11 && !str.includes('/') && !str.includes('.')) {
    return str;
  }
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : '0j3aY_z1Jro';
}

/**
 * Map readable Indonesian category string to standard DrillCategory
 */
function normalizeCategory(catStr: string): DrillCategory {
  if (!catStr) return 'ball_handling';
  const lower = catStr.toLowerCase().trim();
  if (lower.includes('ball') || lower.includes('handling') || lower.includes('dribble')) return 'ball_handling';
  if (lower.includes('shoot') || lower.includes('tembak') || lower.includes('form')) return 'shooting';
  if (lower.includes('foot') || lower.includes('step') || lower.includes('finish')) return 'footwork';
  if (lower.includes('defen') || lower.includes('slide') || lower.includes('agility') || lower.includes('tahan')) return 'defense';
  if (lower.includes('pass') || lower.includes('umpan') || lower.includes('vision')) return 'passing';
  if (lower.includes('post') || lower.includes('hook') || lower.includes('paint')) return 'post_moves';
  return 'ball_handling';
}

/**
 * Map readable Indonesian difficulty string to SkillLevel
 */
function normalizeDifficulty(diffStr: string): SkillLevel {
  if (!diffStr) return 'pemula';
  const lower = diffStr.toLowerCase().trim();
  if (lower.includes('pro') || lower.includes('mahir') || lower.includes('tingkat atas')) return 'pro';
  if (lower.includes('menengah') || lower.includes('interm') || lower.includes('sedang')) return 'menengah';
  return 'pemula';
}

/**
 * Download standard Excel (.xlsx) template pre-filled with sample data
 */
export function downloadDrillExcelTemplate(): void {
  const templateRows: DrillExcelRow[] = DEFAULT_FUNDAMENTAL_DRILLS.map((d) => ({
    'Nama Drill': d.name,
    'Kategori': d.category === 'ball_handling' ? 'Ball Handling'
      : d.category === 'shooting' ? 'Shooting & Form'
      : d.category === 'footwork' ? 'Footwork & Finishing'
      : d.category === 'defense' ? 'Defense & Agility'
      : d.category === 'passing' ? 'Passing & Vision'
      : 'Post Moves',
    'Tingkat Kesulitan': d.difficulty === 'pemula' ? 'Pemula' : d.difficulty === 'menengah' ? 'Menengah' : 'Pro',
    'URL Video YouTube': d.youtubeUrl,
    'Detik Mulai Loop': d.loopStartTimeSec || 0,
    'Detik Selesai Loop': d.loopEndTimeSec || 45,
    'Rekomendasi Set': d.recommendedSets || 4,
    'Rekomendasi Repetisi': d.recommendedReps || '10 Reps per Set',
    'Deskripsi': d.description,
    'Kunci Mekanika (Pisahkan dengan Titik Koma ;)': (d.mechanics || []).join('; '),
    'Target Otot (Pisahkan dengan Titik Koma ;)': (d.targetMuscles || []).join('; '),
    'Peralatan (Pisahkan dengan Titik Koma ;)': (d.equipment || []).join('; '),
    'URL Thumbnail (Opsional)': d.thumbnailUrl || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(templateRows);

  // Set column widths for comfortable reading in Excel
  worksheet['!cols'] = [
    { wch: 30 }, // Nama Drill
    { wch: 22 }, // Kategori
    { wch: 18 }, // Tingkat Kesulitan
    { wch: 45 }, // URL Video YouTube
    { wch: 18 }, // Detik Mulai Loop
    { wch: 18 }, // Detik Selesai Loop
    { wch: 16 }, // Rekomendasi Set
    { wch: 22 }, // Rekomendasi Repetisi
    { wch: 45 }, // Deskripsi
    { wch: 45 }, // Kunci Mekanika
    { wch: 30 }, // Target Otot
    { wch: 30 }, // Peralatan
    { wch: 40 }, // URL Thumbnail
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Katalog Drill');

  // Generate Excel file and trigger browser download
  XLSX.writeFile(workbook, 'Template_Katalog_Latihan_Drill_Basket.xlsx');
}

/**
 * Export active drill library to Excel file
 */
export function exportDrillsToExcel(drills: FundamentalDrill[], filename = 'Katalog_Drill_Basket_HoopStats.xlsx'): void {
  const rows: DrillExcelRow[] = drills.map((d) => ({
    'Nama Drill': d.name,
    'Kategori': d.category,
    'Tingkat Kesulitan': d.difficulty,
    'URL Video YouTube': d.youtubeUrl,
    'Detik Mulai Loop': d.loopStartTimeSec,
    'Detik Selesai Loop': d.loopEndTimeSec,
    'Rekomendasi Set': d.recommendedSets,
    'Rekomendasi Repetisi': d.recommendedReps,
    'Deskripsi': d.description,
    'Kunci Mekanika (Pisahkan dengan Titik Koma ;)': (d.mechanics || []).join('; '),
    'Target Otot (Pisahkan dengan Titik Koma ;)': (d.targetMuscles || []).join('; '),
    'Peralatan (Pisahkan dengan Titik Koma ;)': (d.equipment || []).join('; '),
    'URL Thumbnail (Opsional)': d.thumbnailUrl || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Katalog Drill');

  XLSX.writeFile(workbook, filename);
}

/**
 * Parse an uploaded Excel / CSV file into FundamentalDrill array
 */
export async function parseDrillsFromExcel(file: File): Promise<ParsedDrillResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (rawRows.length === 0) {
          resolve({
            drills: [],
            errors: ['File Excel kosong atau tidak memiliki baris data.'],
            warnings: []
          });
          return;
        }

        const parsedDrills: FundamentalDrill[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2; // Accounting for 1-indexed header

          // Flexible key lookup for headers (Indonesian / English / camelCase)
          const name = String(row['Nama Drill'] || row['name'] || row['Nama'] || '').trim();
          const categoryStr = String(row['Kategori'] || row['category'] || '').trim();
          const difficultyStr = String(row['Tingkat Kesulitan'] || row['difficulty'] || '').trim();
          const youtubeUrl = String(row['URL Video YouTube'] || row['youtubeUrl'] || row['YouTube'] || row['Video URL'] || '').trim();
          const loopStartStr = row['Detik Mulai Loop'] ?? row['loopStartTimeSec'] ?? row['Start Sec'];
          const loopEndStr = row['Detik Selesai Loop'] ?? row['loopEndTimeSec'] ?? row['End Sec'];
          const setsStr = row['Rekomendasi Set'] ?? row['recommendedSets'] ?? row['Sets'];
          const reps = String(row['Rekomendasi Repetisi'] || row['recommendedReps'] || row['Reps'] || '10 Reps per Set').trim();
          const description = String(row['Deskripsi'] || row['description'] || '').trim();
          const mechanicsRaw = String(row['Kunci Mekanika (Pisahkan dengan Titik Koma ;)'] || row['mechanics'] || row['Mekanika'] || '').trim();
          const musclesRaw = String(row['Target Otot (Pisahkan dengan Titik Koma ;)'] || row['targetMuscles'] || row['Target Otot'] || '').trim();
          const equipmentRaw = String(row['Peralatan (Pisahkan dengan Titik Koma ;)'] || row['equipment'] || row['Peralatan'] || '').trim();
          const thumbnailUrl = String(row['URL Thumbnail (Opsional)'] || row['thumbnailUrl'] || '').trim();

          // Validate required fields
          if (!name) {
            warnings.push(`Baris ${rowNum}: Diabaikan karena 'Nama Drill' kosong.`);
            return;
          }

          if (!youtubeUrl) {
            warnings.push(`Baris ${rowNum} (${name}): URL Video YouTube kosong. Menggunakan link default.`);
          }

          const category = normalizeCategory(categoryStr);
          const difficulty = normalizeDifficulty(difficultyStr);
          const ytId = extractYouTubeId(youtubeUrl || 'https://www.youtube.com/watch?v=0j3aY_z1Jro');
          const finalYtUrl = youtubeUrl || `https://www.youtube.com/watch?v=${ytId}`;

          const mechanics = mechanicsRaw
            ? mechanicsRaw.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean)
            : ['Posisi Kaki Tekuk Lutut', 'Pandangan Lurus ke Depan'];

          const targetMuscles = musclesRaw
            ? musclesRaw.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean)
            : ['Quadriceps', 'Core'];

          const equipment = equipmentRaw
            ? equipmentRaw.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean)
            : ['1 Basketball'];

          const drill: FundamentalDrill = {
            id: `drill-excel-${Date.now()}-${index}`,
            name,
            category,
            difficulty,
            description: description || `Latihan fundamental ${name} untuk meningkatkan teknik basket secara konsisten.`,
            mechanics,
            youtubeUrl: finalYtUrl,
            youtubeVideoId: ytId,
            loopStartTimeSec: Number(loopStartStr) >= 0 ? Number(loopStartStr) : 0,
            loopEndTimeSec: Number(loopEndStr) > 0 ? Number(loopEndStr) : undefined,
            recommendedSets: Number(setsStr) > 0 ? Number(setsStr) : 4,
            recommendedReps: reps || '10 Reps per Set',
            targetMuscles,
            equipment,
            thumbnailUrl: thumbnailUrl || `https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80`
          };

          parsedDrills.push(drill);
        });

        resolve({
          drills: parsedDrills,
          errors,
          warnings
        });
      } catch (err: any) {
        reject(new Error(`Gagal membaca file Excel: ${err?.message || 'Format file tidak valid'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca berkas file dari browser.'));
    };

    reader.readAsArrayBuffer(file);
  });
}
