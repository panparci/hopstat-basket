import React from 'react';
import { Target } from 'lucide-react';
import { BasketballCourtPicker } from '../common/BasketballCourtPicker';
import { BaseModal } from '../atoms/BaseModal';

interface ShotChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (x: number, y: number) => void;
  title?: string;
  points?: number;
  sidePanel?: boolean;
}

export const ShotChartModal: React.FC<ShotChartModalProps> = ({ isOpen, onClose, onSelectLocation, title, points, sidePanel = false }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'Pilih Lokasi Tembakan'}
      icon={<Target className="text-brand-navy dark:text-brand-orange" size={20} />}
      sidePanel={true}
    >
      <div className="flex flex-col items-center justify-center p-1">
        <div className="w-full max-w-sm">
          <BasketballCourtPicker 
            onLocationSelect={(x, y) => onSelectLocation(x, y)} 
            allowedArea={points === 2 ? '2pt' : points === 3 ? '3pt' : 'any'}
          />
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3 font-bold uppercase tracking-wider">Tap pada area lapangan untuk mencatat posisi</p>
      </div>
    </BaseModal>
  );
};
