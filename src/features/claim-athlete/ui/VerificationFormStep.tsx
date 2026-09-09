import React from 'react';
import { User, Award, FileText, Trash2, Upload, AlertCircle, CheckSquare, Square, ArrowRight } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { motion } from 'motion/react';

interface Document {
  type: string;
  fileName: string;
  dataUrl: string;
}

interface VerificationFormStepProps {
  relationship: 'ayah' | 'ibu' | 'wali';
  setRelationship: (val: 'ayah' | 'ibu' | 'wali') => void;
  claimantName: string;
  setClaimantName: (val: string) => void;
  claimantPhone: string;
  setClaimantPhone: (val: string) => void;
  claimantNik: string;
  setClaimantNik: (val: string) => void;
  childName: string;
  setChildName: (val: string) => void;
  childDob: string;
  setChildDob: (val: string) => void;
  childGender: string;
  setChildGender: (val: string) => void;
  childClub: string;
  setChildClub: (val: string) => void;
  childJerseyNumber: string;
  setChildJerseyNumber: (val: string) => void;
  childEvents: string[];
  documents: Document[];
  uploadError: string;
  agreedToTerms: boolean;
  setAgreedToTerms: React.Dispatch<React.SetStateAction<boolean>>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'kk' | 'akta' | 'kartu_pelajar') => void;
  handleRemoveDocument: (type: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export const VerificationFormStep: React.FC<VerificationFormStepProps> = ({
  relationship,
  setRelationship,
  claimantName,
  setClaimantName,
  claimantPhone,
  setClaimantPhone,
  claimantNik,
  setClaimantNik,
  childName,
  setChildName,
  childDob,
  setChildDob,
  childGender,
  setChildGender,
  childClub,
  setChildClub,
  childJerseyNumber,
  setChildJerseyNumber,
  childEvents,
  documents,
  uploadError,
  agreedToTerms,
  setAgreedToTerms,
  handleFileUpload,
  handleRemoveDocument,
  onSubmit,
  onBack
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <form onSubmit={onSubmit} className="space-y-6">
        
        {/* SECTION A: CLAIMANT DATA */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
          <h3 className="font-display font-black text-sm uppercase tracking-wider text-brand-navy dark:text-brand-orange border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
            <User size={16} />
            Informasi Wali Pengklaim
          </h3>

          <div className="grid grid-cols-3 gap-2">
            {(['ayah', 'ibu', 'wali'] as const).map(rel => (
              <button
                type="button"
                key={rel}
                onClick={() => setRelationship(rel)}
                className={`py-3 rounded-xl text-xs font-bold border capitalize transition-all ${
                  relationship === rel 
                    ? 'bg-brand-navy dark:bg-brand-orange border-brand-navy dark:border-brand-orange text-white dark:text-brand-navy' 
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {rel}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Nama Lengkap Sesuai KTP <span className="text-red-500">*</span></label>
            <input 
              type="text"
              value={claimantName}
              onChange={(e) => setClaimantName(e.target.value)}
              placeholder="Masukkan nama wali"
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">No. WhatsApp Aktif <span className="text-red-500">*</span></label>
              <input 
                type="tel"
                value={claimantPhone}
                onChange={(e) => setClaimantPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">NIK Wali (KTP) <span className="text-zinc-400">(Opsional)</span></label>
              <input 
                type="text"
                value={claimantNik}
                onChange={(e) => setClaimantNik(e.target.value)}
                placeholder="NIK 16 Digit"
                maxLength={16}
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange"
              />
            </div>
          </div>
        </div>

        {/* SECTION B: CHILD CONFIRMATION */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
          <h3 className="font-display font-black text-sm uppercase tracking-wider text-brand-navy dark:text-brand-orange border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
            <Award size={16} />
            Konfirmasi Data Atlet / Anak
          </h3>

          <p className="text-[10px] text-zinc-500 leading-normal">
            Konfirmasi detail fisik, nomor punggung, atau turnamen yang pernah diikuti oleh anak Anda di bawah untuk pencocokan berkas otomatis (Pre-Screening).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Nama Atlet <span className="text-red-500">*</span></label>
              <input 
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Tanggal Lahir <span className="text-red-500">*</span></label>
              <input 
                type="date"
                value={childDob}
                onChange={(e) => setChildDob(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Jenis Kelamin <span className="text-red-500">*</span></label>
              <select
                value={childGender}
                onChange={(e) => setChildGender(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange"
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Klub / Tim Saat Ini <span className="text-red-500">*</span></label>
              <input 
                type="text"
                value={childClub}
                onChange={(e) => setChildClub(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">No. Jersey / Punggung</label>
            <input 
              type="text"
              value={childJerseyNumber}
              onChange={(e) => setChildJerseyNumber(e.target.value)}
              placeholder="Contoh: 23"
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange"
            />
          </div>

          {childEvents.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Event yang Diikuti</label>
              <div className="flex flex-wrap gap-1">
                {childEvents.map((evt, i) => (
                  <span key={i} className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[9px] font-bold py-1 px-2.5 rounded-full border border-zinc-200/50 dark:border-zinc-700/50">
                    {evt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SECTION C: DOCUMENTS UPLOAD */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
          <h3 className="font-display font-black text-sm uppercase tracking-wider text-brand-navy dark:text-brand-orange border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
            <FileText size={16} />
            Unggah Dokumen Verifikasi
          </h3>

          <p className="text-[10px] text-zinc-500 leading-normal">
            Demi melindungi data anak, mohon lampirkan KK (Wajib) serta akta lahir atau kartu pelajar sebagai penunjang pembuktian legalitas wali. Dokumen akan dienkripsi dan disimpan lokal secara aman.
          </p>

          {/* KK FILE INPUT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                1. Kartu Keluarga <span className="text-red-500">*Wajib</span>
              </span>
              {documents.some(d => d.type === 'kk') && (
                <button 
                  type="button" 
                  onClick={() => handleRemoveDocument('kk')}
                  className="text-red-500 hover:text-red-700 p-1 rounded-md"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {documents.some(d => d.type === 'kk') ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs flex items-center justify-between border border-emerald-200 dark:border-emerald-900/30 font-semibold">
                <span className="truncate max-w-[240px]">{documents.find(d => d.type === 'kk')?.fileName}</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold">Terunggah</span>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-all text-center">
                <Upload size={18} className="text-zinc-400 mb-1" />
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Pilih file KK</span>
                <span className="text-[9px] text-zinc-400">Maks. 5MB (JPG, PNG, PDF)</span>
                <input 
                  type="file" 
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileUpload(e, 'kk')}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* AKTA FILE INPUT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                2. Akta Kelahiran Anak <span className="text-zinc-400 font-normal">(Opsional)</span>
              </span>
              {documents.some(d => d.type === 'akta') && (
                <button 
                  type="button" 
                  onClick={() => handleRemoveDocument('akta')}
                  className="text-red-500 hover:text-red-700 p-1 rounded-md"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {documents.some(d => d.type === 'akta') ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs flex items-center justify-between border border-emerald-200 dark:border-emerald-900/30 font-semibold">
                <span className="truncate max-w-[240px]">{documents.find(d => d.type === 'akta')?.fileName}</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold font-mono">Terunggah</span>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-all text-center">
                <Upload size={18} className="text-zinc-400 mb-1" />
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Pilih file Akta</span>
                <span className="text-[9px] text-zinc-400">Maks. 5MB (JPG, PNG, PDF)</span>
                <input 
                  type="file" 
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileUpload(e, 'akta')}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* KARTU PELAJAR FILE INPUT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                3. Kartu Pelajar / Foto <span className="text-zinc-400 font-normal">(Opsional)</span>
              </span>
              {documents.some(d => d.type === 'kartu_pelajar') && (
                <button 
                  type="button" 
                  onClick={() => handleRemoveDocument('kartu_pelajar')}
                  className="text-red-500 hover:text-red-700 p-1 rounded-md"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {documents.some(d => d.type === 'kartu_pelajar') ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs flex items-center justify-between border border-emerald-200 dark:border-emerald-900/30 font-semibold">
                <span className="truncate max-w-[240px]">{documents.find(d => d.type === 'kartu_pelajar')?.fileName}</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold font-mono">Terunggah</span>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-all text-center">
                <Upload size={18} className="text-zinc-400 mb-1" />
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Pilih file Kartu Pelajar</span>
                <span className="text-[9px] text-zinc-400">Maks. 5MB (JPG, PNG, PDF)</span>
                <input 
                  type="file" 
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileUpload(e, 'kartu_pelajar')}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {uploadError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2 border border-red-200 dark:border-red-900/30">
              <AlertCircle size={14} className="shrink-0" />
              <span className="font-semibold">{uploadError}</span>
            </div>
          )}
        </div>

        {/* DECLARATION CHECKBOX */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-3">
          <button
            type="button"
            onClick={() => setAgreedToTerms(prev => !prev)}
            className="flex items-start gap-3 text-left focus:outline-none"
          >
            <span className="text-brand-navy dark:text-brand-orange mt-0.5 shrink-0">
              {agreedToTerms ? <CheckSquare size={18} /> : <Square size={18} />}
            </span>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              Saya menyatakan dengan sadar dan penuh tanggung jawab bahwa seluruh data yang diisi di atas adalah benar. Saya adalah orang tua/wali resmi dari anak tersebut, dan bersedia membuktikan legalitas berkas jika diperlukan. Saya menyetujui ketentuan privasi HoopStats.
            </p>
          </button>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex gap-4">
          <Button 
            type="button"
            variant="secondary"
            onClick={onBack}
            className="flex-1 rounded-2xl py-3 text-xs border-zinc-200 dark:border-zinc-800"
          >
            Kembali
          </Button>
          <Button 
            type="submit"
            className="flex-1 rounded-2xl py-3 text-xs flex items-center justify-center gap-2"
          >
            Lanjut ke Pembayaran
            <ArrowRight size={14} />
          </Button>
        </div>
      </form>
    </motion.div>
  );
};
