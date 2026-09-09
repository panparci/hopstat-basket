import { initDB } from '../lib/db';
import { SiteContent } from '../core/types/cms';

export const DEFAULT_CONTENT: SiteContent = {
  id: 'main',
  hero: {
    headline: 'SIAP MELACAK & MEMAKSIMALKAN POTENSI ATLET?',
    subheadline: 'Bergabunglah dengan ribuan orang tua, pelatih, dan pemain yang menggunakan HoopStats untuk melacak pertumbuhan basket secara profesional. Isi formulir untuk berbicara dengan tim kami.',
    ctaPrimary: 'Mulai Gratis',
    ctaSecondary: 'Hubungi Kami'
  },
  pricing: [
    {
      id: 'free',
      name: 'Gratis',
      price: 'Rp 0',
      period: 'selamanya',
      features: [
        'Klaim & pantau statistik atlet',
        'Akses web dashboard',
        'Match story yang sudah terbit',
        'Pesan jasa pencatatan (Stat Pack)'
      ],
      highlighted: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 'Rp 99.000',
      period: 'bulan',
      features: [
        'Semua fitur Gratis',
        'Review & analisis AI Coach mendalam',
        'Unduh Laporan PDF bulanan',
        'Grafik perkembangan & tren performa',
        'Tanpa batas jumlah pertandingan'
      ],
      highlighted: true
    },
    {
      id: 'verified',
      name: 'Verified',
      price: 'Rp 299.000',
      period: 'pertandingan',
      features: [
        'Semua fitur Pro',
        'Dicatat oleh professional statistician HoopStats',
        'Cukup kirim video pertandingan/link YouTube',
        'Verifikasi lencana akun (Verified Badge)',
        'Profil siap dibagikan ke scout & agensi'
      ],
      highlighted: false
    }
  ],
  testimonials: [
    {
      id: 'testi-1',
      name: 'Budi Santoso',
      role: 'Orang Tua Atlet (U-14)',
      quote: 'HoopStats sangat membantu saya melacak perkembangan atlet saya. Laporan tren dan review AI Coach memberi tahu kami dengan tepat apa yang perlu ditingkatkan di latihan berikutnya.'
    },
    {
      id: 'testi-2',
      name: 'Coach Andi',
      role: 'Pelatih Klub Gading Serpong',
      quote: 'Menggunakan live tracking di HoopStats saat pertandingan menghemat waktu kami. Analisis otomatisnya memberikan statistik instan yang langsung bisa dievaluasi saat turun minum.'
    },
    {
      id: 'testi-3',
      name: 'Rian Wijaya',
      role: 'Pemain Basket Amatir',
      quote: 'Sangat suka dengan fitur Jasa Statistik Profesional. Saya cukup mengirimkan rekaman game dari YouTube, dan tim HoopStats menginput semua statistiknya secara akurat!'
    }
  ],
  faqs: [
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
  ],
  updatedAt: Date.now()
};

/**
 * Site copy lives in Postgres (`site_content`). Default below is the seed if the row is empty.
 */
export const contentService = {
  async getContent(): Promise<SiteContent> {
    try {
      const db = await initDB();
      const content = await db.get('site_content', 'main');
      return content || DEFAULT_CONTENT;
    } catch (error) {
      console.error('Error getting site content:', error);
      return DEFAULT_CONTENT;
    }
  },

  async saveContent(content: Partial<SiteContent>): Promise<SiteContent> {
    try {
      const db = await initDB();
      const current = await this.getContent();
      const updated: SiteContent = {
        ...current,
        ...content,
        id: 'main',
        updatedAt: Date.now()
      };
      await db.put('site_content', updated);
      return updated;
    } catch (error) {
      console.error('Error saving site content:', error);
      throw error;
    }
  },

  async resetToDefault(): Promise<SiteContent> {
    try {
      const db = await initDB();
      const resetContent = {
        ...DEFAULT_CONTENT,
        updatedAt: Date.now()
      };
      await db.put('site_content', resetContent);
      return resetContent;
    } catch (error) {
      console.error('Error resetting site content to default:', error);
      throw error;
    }
  }
};
