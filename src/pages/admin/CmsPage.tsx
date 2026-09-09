import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { contentService } from '../../services/contentService';
import { SiteContent, PricingPackage, Testimonial, FaqItem } from '../../core/types/cms';
import { UserAccount } from '../../core/types/serviceRequests';
import { useToast } from '../../core/contexts/ToastContext';
import { BottomNav } from '../../components/atoms/BottomNav';
import { Can } from '../../core/contexts/PermissionsContext';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { BaseModal } from '../../components/atoms/BaseModal';
import { 
  FileText, 
  ArrowLeft, 
  Save, 
  RotateCcw, 
  ExternalLink, 
  Plus, 
  Trash2, 
  HelpCircle, 
  DollarSign, 
  Check, 
  MessageSquare, 
  Sparkles,
  Info
} from 'lucide-react';

type CmsTab = 'HERO' | 'HARGA' | 'TESTIMONI' | 'FAQ';

export const CmsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<CmsTab>('HERO');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Form States corresponding to SiteContent
  const [heroHeadline, setHeroHeadline] = useState('');
  const [heroSubheadline, setHeroSubheadline] = useState('');
  const [heroCtaPrimary, setHeroCtaPrimary] = useState('');
  const [heroCtaSecondary, setHeroCtaSecondary] = useState('');

  const [pricingPackages, setPricingPackages] = useState<PricingPackage[]>([]);
  // Store features as raw newline-separated text for easier editing
  const [featuresInput, setFeaturesInput] = useState<Record<string, string>>({});

  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);

  // Authenticate user & load content
  useEffect(() => {
    const checkRoleAndLoad = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
          navigate('/login', { replace: true });
        } else {
          setUser(currentUser);
          await loadContentData();
        }
      } catch (err) {
        console.error('Authentication check failed', err);
        navigate('/', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    checkRoleAndLoad();
  }, [navigate]);

  const loadContentData = async () => {
    try {
      const content = await contentService.getContent();
      
      // Seed Form state
      setHeroHeadline(content.hero.headline);
      setHeroSubheadline(content.hero.subheadline);
      setHeroCtaPrimary(content.hero.ctaPrimary);
      setHeroCtaSecondary(content.hero.ctaSecondary);

      setPricingPackages(content.pricing);
      
      // Initialize features input dictionary
      const featureDict: Record<string, string> = {};
      content.pricing.forEach(pkg => {
        featureDict[pkg.id] = pkg.features.join('\n');
      });
      setFeaturesInput(featureDict);

      setTestimonials(content.testimonials);
      setFaqItems(content.faqs);
    } catch (err) {
      showToast('Gagal memuat konten landing page', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Re-compile packages with their edited features
      const updatedPricing: PricingPackage[] = pricingPackages.map(pkg => ({
        ...pkg,
        features: featuresInput[pkg.id]
          ? featuresInput[pkg.id]
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
          : []
      }));

      const patch: Partial<SiteContent> = {
        hero: {
          headline: heroHeadline,
          subheadline: heroSubheadline,
          ctaPrimary: heroCtaPrimary,
          ctaSecondary: heroCtaSecondary
        },
        pricing: updatedPricing,
        testimonials,
        faqs: faqItems
      };

      await contentService.saveContent(patch);
      showToast('Konten berhasil disimpan & diperbarui!', 'success');
    } catch (err) {
      showToast('Gagal menyimpan konten', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    try {
      await contentService.resetToDefault();
      await loadContentData();
      setIsResetModalOpen(false);
      showToast('Konten berhasil dikembalikan ke bawaan pabrik!', 'success');
    } catch (err) {
      showToast('Gagal mereset konten', 'error');
    }
  };

  // Pricing Handlers
  const handlePricingChange = (id: string, field: keyof PricingPackage, value: any) => {
    setPricingPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleFeaturesChange = (id: string, value: string) => {
    setFeaturesInput(prev => ({ ...prev, [id]: value }));
  };

  // Testimonial Handlers
  const handleTestimonialChange = (id: string, field: keyof Testimonial, value: string) => {
    setTestimonials(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // FAQ Handlers
  const handleFaqChange = (id: string, field: keyof FaqItem, value: string) => {
    setFaqItems(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleAddFaq = () => {
    const newId = `faq_${Date.now()}`;
    const newItem: FaqItem = {
      id: newId,
      question: 'Pertanyaan baru?',
      answer: 'Jawaban pertanyaan baru.'
    };
    setFaqItems(prev => [...prev, newItem]);
    showToast('Pertanyaan baru ditambahkan', 'success');
  };

  const handleDeleteFaq = (id: string) => {
    setFaqItems(prev => prev.filter(f => f.id !== id));
    showToast('Pertanyaan dihapus', 'success');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-zinc-900 dark:text-zinc-100">
      {/* Top action header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-2xl">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Landing CMS Editor</h1>
            <p className="text-xs text-zinc-500">Edit konten landing page, headline, testimoni, & FAQ tanpa kode.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a 
            href="/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-blue-600 dark:text-blue-400 rounded-xl transition-colors border border-zinc-200/50 dark:border-zinc-700/50 cursor-pointer shadow-sm"
          >
            Lihat Landing <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Save/Reset Sticky bar for quick access */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-orange/10 text-brand-orange rounded-xl">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs font-bold">Ubah Konten Landing</p>
              <p className="text-[10px] text-zinc-500 font-medium">Ubah headline, daftar harga, testimoni, atau FAQ.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Can permission="manage_cms" fallback={
              <div className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                Mode Pratinjau (Read-Only)
              </div>
            }>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsResetModalOpen(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-200 dark:border-red-900/40"
              >
                <RotateCcw size={14} /> Reset Bawaan
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs bg-brand-navy hover:opacity-90 dark:bg-brand-orange dark:text-brand-navy border-none"
              >
                <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </Can>
          </div>
        </div>

        {/* CMS Tabs */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 justify-between items-center">
          {(['HERO', 'HARGA', 'TESTIMONI', 'FAQ'] as CmsTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-tight rounded-xl transition-all ${
                activeTab === tab 
                  ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-brand-orange shadow-sm scale-[1.02]' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <Card className="p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm rounded-3xl space-y-6">
          
          {/* 1. HERO TAB */}
          {activeTab === 'HERO' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <FileText size={18} className="text-brand-navy dark:text-brand-orange" />
                <h3 className="font-display font-black italic uppercase text-sm tracking-tight">KONTEN HERO UTAMA</h3>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                  Headline Utama (Gunakan \n atau baris baru untuk jeda)
                </label>
                <textarea
                  value={heroHeadline}
                  onChange={(e) => setHeroHeadline(e.target.value)}
                  placeholder="Masukkan headline utama"
                  rows={4}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                  Subheadline / Deskripsi Singkat
                </label>
                <textarea
                  value={heroSubheadline}
                  onChange={(e) => setHeroSubheadline(e.target.value)}
                  placeholder="Masukkan deskripsi subheadline"
                  rows={3}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                    Teks Tombol CTA Utama
                  </label>
                  <input
                    type="text"
                    value={heroCtaPrimary}
                    onChange={(e) => setHeroCtaPrimary(e.target.value)}
                    placeholder="Contoh: Coba Gratis Sekarang"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                    Teks Tombol CTA Kedua
                  </label>
                  <input
                    type="text"
                    value={heroCtaSecondary}
                    onChange={(e) => setHeroCtaSecondary(e.target.value)}
                    placeholder="Contoh: Lihat Demo"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. HARGA TAB */}
          {activeTab === 'HARGA' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <DollarSign size={18} className="text-brand-navy dark:text-brand-orange" />
                <h3 className="font-display font-black italic uppercase text-sm tracking-tight">PAKET DAN HARGA</h3>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {pricingPackages.map((pkg) => (
                  <div key={pkg.id} className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-850 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-200/50 dark:border-zinc-800/40">
                      <span className="text-xs font-extrabold uppercase tracking-widest text-brand-navy dark:text-brand-orange">
                        ID Paket: {pkg.id.toUpperCase()}
                      </span>
                      <label className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pkg.highlighted}
                          onChange={(e) => handlePricingChange(pkg.id, 'highlighted', e.target.checked)}
                          className="rounded text-brand-navy dark:text-brand-orange focus:ring-brand-navy focus:ring-2"
                        />
                        Sorot Paket (Populer)
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Nama Paket</label>
                        <input
                          type="text"
                          value={pkg.name}
                          onChange={(e) => handlePricingChange(pkg.id, 'name', e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Harga Paket</label>
                        <input
                          type="text"
                          value={pkg.price}
                          onChange={(e) => handlePricingChange(pkg.id, 'price', e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Periode</label>
                        <input
                          type="text"
                          value={pkg.period}
                          onChange={(e) => handlePricingChange(pkg.id, 'period', e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        Daftar Fitur <Info size={11} className="text-zinc-400" />
                      </label>
                      <p className="text-[10px] text-zinc-500">Tuliskan satu fitur pada setiap baris baru</p>
                      <textarea
                        value={featuresInput[pkg.id] || ''}
                        onChange={(e) => handleFeaturesChange(pkg.id, e.target.value)}
                        rows={4}
                        placeholder="Masukkan daftar fitur..."
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs leading-relaxed focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. TESTIMONI TAB */}
          {activeTab === 'TESTIMONI' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <MessageSquare size={18} className="text-brand-navy dark:text-brand-orange" />
                <h3 className="font-display font-black italic uppercase text-sm tracking-tight">TESTIMONI PENGGUNA</h3>
              </div>

              <div className="space-y-6">
                {testimonials.map((testi, tIdx) => (
                  <div key={testi.id} className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-850 space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-200/50 dark:border-zinc-800/40 pb-2">
                      <span className="text-xs font-black uppercase text-brand-navy dark:text-brand-orange">Testimoni #{tIdx + 1}</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Isi Kutipan (Quote)</label>
                      <textarea
                        value={testi.quote}
                        onChange={(e) => handleTestimonialChange(testi.id, 'quote', e.target.value)}
                        rows={3}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-medium leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Nama Pengguna</label>
                        <input
                          type="text"
                          value={testi.name}
                          onChange={(e) => handleTestimonialChange(testi.id, 'name', e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Peran / Posisi</label>
                        <input
                          type="text"
                          value={testi.role}
                          onChange={(e) => handleTestimonialChange(testi.id, 'role', e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. FAQ TAB */}
          {activeTab === 'FAQ' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <HelpCircle size={18} className="text-brand-navy dark:text-brand-orange" />
                  <h3 className="font-display font-black italic uppercase text-sm tracking-tight">PERTANYAAN UMUM (FAQ)</h3>
                </div>
                <Button
                  onClick={handleAddFaq}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-1 text-xs border border-zinc-200 dark:border-zinc-800"
                >
                  <Plus size={12} /> Tambah FAQ
                </Button>
              </div>

              {faqItems.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <HelpCircle size={24} className="mx-auto mb-2 text-zinc-400" />
                  <p className="text-xs font-bold">Belum Ada FAQ</p>
                  <p className="text-[10px]">Klik tombol di atas untuk menambah pertanyaan baru.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {faqItems.map((item, index) => (
                    <div key={item.id} className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-850 space-y-4 relative">
                      <button
                        onClick={() => handleDeleteFaq(item.id)}
                        className="absolute top-4 right-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition-colors"
                        title="Hapus Pertanyaan"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="text-[10px] font-black uppercase text-brand-navy dark:text-brand-orange">Pertanyaan #{index + 1}</div>

                      <div className="space-y-1.5 pr-8">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Pertanyaan</label>
                        <input
                          type="text"
                          value={item.question}
                          onChange={(e) => handleFaqChange(item.id, 'question', e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Jawaban</label>
                        <textarea
                          value={item.answer}
                          onChange={(e) => handleFaqChange(item.id, 'answer', e.target.value)}
                          rows={3}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-medium leading-relaxed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </Card>

      </div>

      {/* Reset Confirmation Modal */}
      <BaseModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Kembalikan Konten Bawaan"
      >
        <div className="space-y-5 pt-2">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Apakah Anda yakin ingin mengembalikan seluruh konten landing page ke bawaan asli pabrik? Semua modifikasi headline, harga, testimoni, dan FAQ Anda akan terhapus secara permanen.
          </p>
          <div className="flex gap-2.5 justify-end pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsResetModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResetToDefault}
              className="bg-red-600 hover:bg-red-700 text-white border-none"
            >
              Kembalikan
            </Button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
};
