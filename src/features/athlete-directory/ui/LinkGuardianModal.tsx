import React, { useState, useEffect } from 'react';
import { BaseModal } from '../../../shared/ui/BaseModal';
import { Button } from '../../../shared/ui/Button';
import { ChildProfile } from '../../../core/types/stats';
import { UserAccount } from '../../../core/types/serviceRequests';
import { Search, ShieldAlert, Link as LinkIcon, User } from 'lucide-react';
import { useToast } from '../../../core/contexts/ToastContext';
import { statsService } from '../../../core/services/statsService';

interface LinkGuardianModalProps {
  isOpen: boolean;
  onClose: () => void;
  athlete: ChildProfile | null;
  users: UserAccount[];
  onSuccess: () => void;
}

export const LinkGuardianModal: React.FC<LinkGuardianModalProps> = ({
  isOpen,
  onClose,
  athlete,
  users,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId('');
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!athlete) return null;

  // Filter users based on query and role (customers usually act as guardians)
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const isNotAdmin = u.role !== 'admin';
    return matchesSearch && isNotAdmin;
  });

  const handleLinkGuardian = async () => {
    if (!selectedUserId) {
      showToast('Pilih satu akun wali/guardian terlebih dahulu', 'error');
      return;
    }

    const targetUser = users.find(u => u.id === selectedUserId);
    if (!targetUser) return;

    setIsSubmitting(true);
    try {
      const currentLinks = athlete.links || [];
      
      // Check if already linked
      const alreadyLinked = currentLinks.some(l => l.accountId === selectedUserId && l.relationship === 'guardian');
      if (alreadyLinked) {
        // Update to verified if not verified
        const updatedLinks = currentLinks.map(l => {
          if (l.accountId === selectedUserId && l.relationship === 'guardian') {
            return { ...l, verified: true, verifiedAt: Date.now() };
          }
          return l;
        });

        await statsService.updateProfile({
          ...athlete,
          links: updatedLinks,
          claimStatus: 'verified'
        });
      } else {
        // Add new verified guardian link
        const newLink = {
          accountId: selectedUserId,
          relationship: 'guardian' as const,
          verified: true,
          verifiedAt: Date.now()
        };

        await statsService.updateProfile({
          ...athlete,
          links: [...currentLinks, newLink],
          claimStatus: 'verified'
        });
      }

      showToast(`Berhasil menautkan ${targetUser.name} sebagai guardian untuk ${athlete.name}`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Gagal menautkan guardian', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Tautkan Guardian Manual">
      <div className="space-y-4 font-sans text-zinc-900 dark:text-zinc-100">
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-900/40 text-xs flex gap-2">
          <ShieldAlert className="shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-bold">Aksi Administratif</p>
            <p className="mt-0.5">Menautkan guardian manual akan mengubah status klaim atlet ini menjadi <span className="font-bold">"Sudah Diklaim"</span> dan memberikan hak penuh pengeditan profil kepada akun yang dipilih.</p>
          </div>
        </div>

        <div>
          <span className="text-xs text-zinc-400 block uppercase font-bold tracking-wider mb-1">Atlet</span>
          <p className="text-sm font-bold bg-zinc-50 dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
            {athlete.name} <span className="text-xs font-normal text-zinc-400">({athlete.internalId || 'Tanpa ID'})</span>
          </p>
        </div>

        {/* Search Input */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 block uppercase font-bold tracking-wider">Cari Akun Wali</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Cari nama atau email akun..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-orange"
            />
          </div>
        </div>

        {/* User Selection List */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 block uppercase font-bold tracking-wider">Pilih Wali Terdaftar</label>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900 bg-white dark:bg-zinc-950">
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-zinc-400 italic p-4 text-center">Tidak ada akun wali ditemukan.</p>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUserId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full text-left p-2.5 flex items-center justify-between text-xs transition-all ${
                      isSelected 
                        ? 'bg-brand-navy/5 dark:bg-brand-orange/10 text-brand-navy dark:text-brand-orange font-bold' 
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User size={14} className={isSelected ? 'text-brand-orange' : 'text-zinc-400'} />
                      <div>
                        <p className="font-bold">{u.name}</p>
                        <p className="text-[10px] text-zinc-400 font-mono font-normal">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-md">
                      {u.role === 'customer' ? 'Orang Tua / Wali' : u.role}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleLinkGuardian} 
            disabled={isSubmitting || !selectedUserId}
            className="flex items-center gap-1.5"
          >
            <LinkIcon size={14} /> {isSubmitting ? 'Menautkan...' : 'Tautkan Guardian'}
          </Button>
        </div>
      </div>
    </BaseModal>
  );
};
