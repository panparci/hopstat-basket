import React, { useState, useRef } from 'react';
import { Camera, Type, Upload, Loader2, X } from 'lucide-react';
import { aiVisionService } from '../../core/services/aiVisionService';
import { Player } from '../../core/types/stats';
import { BaseModal } from '../atoms/BaseModal';

interface AITeamSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtract: (players: Partial<Player>[]) => void;
}

export const AITeamSetupModal: React.FC<AITeamSetupModalProps> = ({ isOpen, onClose, onExtract }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Text state
  const [textInput, setTextInput] = useState('');
  
  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setIsProcessing(true);
    try {
      const players = await aiVisionService.extractLineupFromText(textInput);
      onExtract(players);
      onClose();
    } catch (error) {
      console.error(error);
      // alert replaced with console error as per guidelines if needed, but keeping it simple
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageSubmit = async () => {
    if (!imagePreview) return;
    setIsProcessing(true);
    try {
      // Extract mime type and base64
      const mimeType = imagePreview.split(';')[0].split(':')[1];
      const players = await aiVisionService.extractLineupFromImage(imagePreview, mimeType);
      onExtract(players);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="AI Lineup Assistant"
      maxWidth="max-w-md"
    >
      <div className="flex gap-2 mb-6 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl -mt-4">
        <button 
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'text' ? 'bg-white dark:bg-zinc-700 text-brand-navy dark:text-brand-orange shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          <Type size={16} /> Teks Cepat
        </button>
        <button 
          onClick={() => setActiveTab('image')}
          className={`flex-1 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'image' ? 'bg-white dark:bg-zinc-700 text-brand-navy dark:text-brand-orange shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          <Camera size={16} /> Foto
        </button>
      </div>

      <div className="min-h-[200px]">
        {activeTab === 'text' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Ketik nomor punggung (pisahkan dengan koma) atau nomor dan nama. Contoh: "1, 2, 3" atau "1 Budi, 2 Andi".
            </p>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full h-32 p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white resize-none"
              placeholder="Masukkan nomor punggung..."
            />
            <button 
              onClick={handleTextSubmit}
              disabled={isProcessing || !textInput.trim()}
              className="w-full py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-bold tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? <><Loader2 size={20} className="animate-spin" /> Memproses...</> : 'EKSTRAK LINEUP'}
            </button>
          </div>
        )}

        {activeTab === 'image' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Upload foto jersey dari belakang untuk mengekstrak nomor dan nama secara otomatis.
            </p>
            
            {!imagePreview ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-40 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <Upload size={32} className="text-zinc-400" />
                <span className="text-sm font-bold text-zinc-500">Klik untuk Upload Foto</span>
              </div>
            ) : (
              <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setImagePreview(null)}
                  className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            
            <button 
              onClick={handleImageSubmit}
              disabled={isProcessing || !imagePreview}
              className="w-full py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-bold tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? <><Loader2 size={20} className="animate-spin" /> Memproses...</> : 'EKSTRAK DARI FOTO'}
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
};
