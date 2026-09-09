import { FundamentalDrill } from '../types';

export const DEFAULT_FUNDAMENTAL_DRILLS: FundamentalDrill[] = [
  {
    id: 'drill-mikan-01',
    name: '5 Set Mikan Drill',
    category: 'shooting',
    difficulty: 'pemula',
    description: 'Drill Mikan klasik untuk melatih sentuhan ring (soft touch) di bawah ring dengan kaki & tangan kanan-kiri bergantian.',
    mechanics: [
      'POSISI KAKI: TEKUK LUTUT SAAT LOMPAT',
      'POINT OF RELEASE: RELEASE TINGGI DI PAPAN RING',
      'RITME: TANPA MEMASUKKAN BOLA KE LANTAI (REBOUND LANGSUNG)'
    ],
    youtubeUrl: 'https://www.youtube.com/watch?v=0j3aY_z1Jro',
    youtubeVideoId: '0j3aY_z1Jro',
    loopStartTimeSec: 5,
    loopEndTimeSec: 35,
    recommendedSets: 5,
    recommendedReps: '10 Makes per Set',
    targetMuscles: ['Quadriceps', 'Calves', 'Shoulders', 'Wrist'],
    equipment: ['Basketball', 'Ring Basketball'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'drill-cone-dribble-02',
    name: '10 Menit Cone Dribbling',
    category: 'ball_handling',
    difficulty: 'pemula',
    description: 'Latihan fleksibilitas pergelangan tangan dan dribble rendah melewati rangkaian cone untuk mempertajam ball control.',
    mechanics: [
      'POSTUR: PINGGUL RENDAH & TANGAN NON-DRIBBLE DIPAKAI PROTEKSI',
      'MATA: MENATAP LURUS KE DEPAN (PONT OF VISION)',
      'KONTROL: DRIBBLE SEATAS PINGGUL SAAT EXPLOSIVE, BISA SEATAS LUTUT SAAT SHIFT'
    ],
    youtubeUrl: 'https://www.youtube.com/watch?v=R9K4vLh6NMc',
    youtubeVideoId: 'R9K4vLh6NMc',
    loopStartTimeSec: 10,
    loopEndTimeSec: 50,
    recommendedSets: 4,
    recommendedReps: '60 Detik Non-Stop',
    targetMuscles: ['Forearms', 'Core', 'Glutes', 'Hamstrings'],
    equipment: ['5 Cone', 'Basketball'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'drill-spot-up-3s-03',
    name: '50 Spot-Up Threes',
    category: 'shooting',
    difficulty: 'menengah',
    description: 'Tembakan 3 angka dari 5 titik sudut lapangan (Corner, Wing, Top of Key) untuk membentuk konsistensi mekanik jumper.',
    mechanics: [
      'BASE: KAKI SELEBAR BAHU & HIPS READY SAAT CATCH',
      'ONE MOTION: DARI DIP KE EXTENSION DENGAN DIP PUSAT ENERGI',
      'FOLLOW THROUGH: TANGAN TETAP GANTUNG 2 DETIK DI UDARA'
    ],
    youtubeUrl: 'https://www.youtube.com/watch?v=4y-51l2i4Q8',
    youtubeVideoId: '4y-51l2i4Q8',
    loopStartTimeSec: 12,
    loopEndTimeSec: 45,
    recommendedSets: 5,
    recommendedReps: '10 Tembakan per Titik',
    targetMuscles: ['Triceps', 'Deltoids', 'Quadriceps', 'Core'],
    equipment: ['Full Court', 'Basketball'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'drill-jab-rip-04',
    name: 'Jab, Rip Into Hop Mini Fades',
    category: 'footwork',
    difficulty: 'menengah',
    description: 'Ancaman Triple Threat dengan gerakan jab step, rip low melewati lutut lawan, dan melompat mini fadeaway jumper.',
    mechanics: [
      'TRIPLE THREAT: BOLA DILINDUNGI DI SISI PINGGUL (POCKET)',
      'JAB STEP: JAB TAJAM 45 DERAJAT TANPA ANGKAT PIVOT',
      'EXPLOSIVE HOP: STOP DUA KAKI DENGAN BALANCE SEIMBANG'
    ],
    youtubeUrl: 'https://www.youtube.com/watch?v=p4vW93Xv_-U',
    youtubeVideoId: 'p4vW93Xv_-U',
    loopStartTimeSec: 15,
    loopEndTimeSec: 55,
    recommendedSets: 4,
    recommendedReps: '8 Reps Kanan & Kiri',
    targetMuscles: ['Glutes', 'Calves', 'Core', 'Shoulders'],
    equipment: ['Half Court', 'Basketball'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'drill-euro-step-05',
    name: 'Euro Step & High Finish',
    category: 'footwork',
    difficulty: 'menengah',
    description: 'Variasi langkah dua tahap merubah arah secara tiba-tiba di area paint untuk menghindari blok pemain bertahan tinggi.',
    mechanics: [
      'STEP 1: STEPS HEAVY KE SATU ARAH UNTUK MEMancing LAWAN',
      'STEP 2: STEPS EXPLOSIVE LATERAL DIAGONAL KE SISI LAIN',
      'HIGH FINISH: ANGKAT BOLA DENGAN DUA TANGAN LALU RELEASE TINGGI'
    ],
    youtubeUrl: 'https://www.youtube.com/watch?v=YfIn_hN3gno',
    youtubeVideoId: 'YfIn_hN3gno',
    loopStartTimeSec: 8,
    loopEndTimeSec: 40,
    recommendedSets: 3,
    recommendedReps: '10 Makes per Set',
    targetMuscles: ['Adductors', 'Glutes', 'Core', 'Lats'],
    equipment: ['Half Court', 'Basketball'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'drill-defensive-slide-06',
    name: 'Defensive Slides & Drop Step',
    category: 'defense',
    difficulty: 'pemula',
    description: 'Latihan ketahanan stance bertahan, gerakan lateral tanpa menyilangkan kaki, dan reaksi cepat melakukan drop step.',
    mechanics: [
      'STANCE: DADA TEGAK, PINGGUL DUDUK RENDAH (WALL SIT POSITION)',
      'LATERAL SLIDE: PUSH OFF DENGAN KAKI BELAKANG, TANPA CROSSOVER KAKI',
      'DROP STEP: ANGKAT PINGGUL DENGAN CEPAT SAAT DIREBUT PERIMETER'
    ],
    youtubeUrl: 'https://www.youtube.com/watch?v=4y-51l2i4Q8',
    youtubeVideoId: '4y-51l2i4Q8',
    loopStartTimeSec: 60,
    loopEndTimeSec: 100,
    recommendedSets: 4,
    recommendedReps: '45 Detik per Sesi',
    targetMuscles: ['Quadriceps', 'Hip Flexors', 'Calves', 'Core'],
    equipment: ['Tanpa Ring', '3 Cone'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'drill-post-dropstep-07',
    name: 'Post Drop-Step & Power Hook',
    category: 'post_moves',
    difficulty: 'pro',
    description: 'Gerakan khusus pemain Center/Power Forward membelakangi ring, melakukan kontak fisik dan memutar bahu untuk hook shot.',
    mechanics: [
      'SEAL POSITION: SEALING BEHIND DEFENDER DENGAN DADA TEGAP',
      'DROP STEP FOOTWORK: PUTAR KAKI DALLAM MENUJU AREA BASKET',
      'HOOK EXTENSION: BOLA DIKONTROL DENGAN FINGERTIPS SAAT RELEASE'
    ],
    youtubeUrl: 'https://www.youtube.com/watch?v=0j3aY_z1Jro',
    youtubeVideoId: '0j3aY_z1Jro',
    loopStartTimeSec: 40,
    loopEndTimeSec: 85,
    recommendedSets: 4,
    recommendedReps: '8 Makes Kanan & Kiri',
    targetMuscles: ['Lats', 'Deltoids', 'Glutes', 'Triceps'],
    equipment: ['Half Court', 'Basketball'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'drill-pocket-pass-08',
    name: 'Pick & Roll Pocket Pass Precision',
    category: 'passing',
    difficulty: 'menengah',
    description: 'Latihan memberikan umpan tajam celah ketiak/pinggul pemain bertahan dalam situasi Pick & Roll.',
    mechanics: [
      'WRAP AROUND: UMPAN DENGAN SATU TANGAN MEMUTAR DI SISI DEFENDER',
      'BOUNCE PASS: MEMANTULKAN BOLA 2/3 JARAK MENUJU ROLL MAN',
      'EYE DECEPTION: LOOK AWAY UNTUK MENGECOH PERIMETER DEFENSE'
    ],
    youtubeUrl: 'https://www.youtube.com/watch?v=R9K4vLh6NMc',
    youtubeVideoId: 'R9K4vLh6NMc',
    loopStartTimeSec: 60,
    loopEndTimeSec: 105,
    recommendedSets: 3,
    recommendedReps: '12 Umpan Presisi',
    targetMuscles: ['Chest', 'Triceps', 'Core', 'Wrist'],
    equipment: ['Half Court', 'Target Wall / Dummy'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&auto=format&fit=crop&q=80'
  }
];
