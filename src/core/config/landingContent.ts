export interface PricePlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaText: string;
  isPopular?: boolean;
}

export interface Testimony {
  id: string;
  name: string;
  role: string;
  quote: string;
  initials: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const PRICE_PLANS: PricePlan[] = [
  {
    id: 'free',
    name: 'Gratis',
    price: 'Rp 0',
    period: 'selamanya',
    description: 'Cocok untuk mencoba pencatatan statistik mandiri dasar.',
    features: [
      'Self-tracking pertandingan',
      'Statistik dasar pemain & tim',
      'Akses web dashboard',
      'Simpan hingga 5 pertandingan'
    ],
    ctaText: 'Mulai Gratis',
    isPopular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Rp 99.000',
    period: 'bulan',
    description: 'Sangat cocok untuk orang tua & pelatih yang ingin perkembangan analitis.',
    features: [
      'Semua fitur Gratis',
      'Review & analisis AI Coach mendalam',
      'Unduh Laporan PDF bulanan',
      'Grafik perkembangan & tren performa',
      'Tanpa batas jumlah pertandingan'
    ],
    ctaText: 'Coba Pro Gratis',
    isPopular: true
  },
  {
    id: 'verified',
    name: 'Verified',
    price: 'Rp 299.000',
    period: 'pertandingan',
    description: 'Pencatatan profesional tanpa repot untuk hasil terverifikasi.',
    features: [
      'Semua fitur Pro',
      'Dicatat oleh professional statistician HoopStats',
      'Cukup kirim video pertandingan/link YouTube',
      'Verifikasi lencana akun (Verified Badge)',
      'Profil siap dibagikan ke scout & agensi'
    ],
    ctaText: 'Pesan Sekarang',
    isPopular: false
  }
];

export const TESTIMONIALS: Testimony[] = [
  {
    id: 'testi-1',
    name: 'Budi Santoso',
    role: 'Orang Tua Atlet (U-14)',
    quote: 'HoopStats sangat membantu saya melacak perkembangan atlet saya. Laporan tren dan review AI Coach memberi tahu kami dengan tepat apa yang perlu ditingkatkan di latihan berikutnya.',
    initials: 'BS'
  },
  {
    id: 'testi-2',
    name: 'Coach Andi',
    role: 'Pelatih Klub Gading Serpong',
    quote: 'Menggunakan live tracking di HoopStats saat pertandingan menghemat waktu kami. Analisis otomatisnya memberikan statistik instan yang langsung bisa dievaluasi saat turun minum.',
    initials: 'CA'
  },
  {
    id: 'testi-3',
    name: 'Rian Wijaya',
    role: 'Pemain Basket Amatir',
    quote: 'Sangat suka dengan fitur Jasa Statistik Profesional. Saya cukup mengirimkan rekaman game dari YouTube, dan tim HoopStats menginput semua statistiknya secara akurat!',
    initials: 'RW'
  }
];

export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'Bagaimana cara melakukan pencatatan statistik (live tracking) di HoopStats?',
    answer: 'Anda dapat mencatatkan statistik secara langsung selama pertandingan berlangsung melalui menu tracking di aplikasi kami. Cukup ketuk tindakan pemain seperti tembakan masuk, meleset, assist, rebound, dan lainnya secara real-time.'
  },
  {
    id: 'faq-2',
    question: 'Apa itu fitur Jasa Statistik Profesional HoopStats?',
    answer: 'Jika Anda tidak sempat mencatat secara live, Anda cukup merekam pertandingan atau memberikan link video YouTube pertandingan tersebut. Tim professional statistician kami akan menganalisis rekaman tersebut dan menginput seluruh statistik pertandingan atlet Anda ke dalam sistem.'
  },
  {
    id: 'faq-3',
    question: 'Bagaimana AI Coach HoopStats bekerja menganalisis performa?',
    answer: 'AI Coach kami menggunakan model bahasa besar (seperti Gemini) yang dipadukan dengan data statistik pertandingan yang tercatat. AI akan membaca efisiensi tembakan, kontribusi rebound, pola turnover, dan memberikan saran tertulis serta feedback terarah untuk pengembangan pemain.'
  },
  {
    id: 'faq-4',
    question: 'Apakah laporan statistik HoopStats bisa diunduh?',
    answer: 'Ya! Untuk pengguna paket Pro dan Verified, Anda dapat mengunduh laporan perkembangan, statistik kumulatif, dan ulasan AI Coach dalam bentuk dokumen PDF yang terformat rapi untuk dibagikan.'
  },
  {
    id: 'faq-5',
    question: 'Apakah HoopStats aman digunakan dan data tidak hilang?',
    answer: 'Keamanan data Anda adalah prioritas kami. HoopStats menyimpan data pertandingan dan profil pemain di PostgreSQL. File video tidak disimpan di database — sumbernya terpisah (YouTube sekarang, Google Drive kemudian).'
  }
];
