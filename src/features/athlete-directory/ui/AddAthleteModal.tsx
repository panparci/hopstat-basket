import React, { useState, useEffect } from 'react';
import { BaseModal } from '../../../shared/ui/BaseModal';
import { Button } from '../../../shared/ui/Button';
import { ChildProfile, Club } from '../../../core/types/stats';
import { UserAccount } from '../../../core/types/serviceRequests';
import { useToast } from '../../../core/contexts/ToastContext';
import { statsService } from '../../../core/services/statsService';
import { generateId } from '../../../core/utils/idUtils';
import { User, ShieldCheck } from 'lucide-react';

interface AddAthleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteToEdit: ChildProfile | null;
  clubs: Club[];
  users: UserAccount[];
  onSuccess: () => void;
}

export const AddAthleteModal: React.FC<AddAthleteModalProps> = ({
  isOpen,
  onClose,
  athleteToEdit,
  clubs,
  users,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('L');
  const [avatar, setAvatar] = useState('');
  const [clubId, setClubId] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  
  // Guardian selection for new athlete
  const [linkGuardianOnCreate, setLinkGuardianOnCreate] = useState(false);
  const [selectedGuardianId, setSelectedGuardianId] = useState('');

  // Search guardian state
  const [guardianSearch, setGuardianSearch] = useState('');

  // Load editing profile or reset
  useEffect(() => {
    if (isOpen) {
      if (athleteToEdit) {
        setName(athleteToEdit.name || '');
        setBirthDate(athleteToEdit.birthDate || '');
        setGender(athleteToEdit.gender || 'L');
        setAvatar(athleteToEdit.avatar || '');
        setClubId(athleteToEdit.clubId || '');
        setJerseyNumber(athleteToEdit.jerseyNumber || '');
        setLinkGuardianOnCreate(false);
        setSelectedGuardianId('');
        setGuardianSearch('');
      } else {
        setName('');
        setBirthDate('');
        setGender('L');
        setAvatar('');
        setClubId('');
        setJerseyNumber('');
        setLinkGuardianOnCreate(false);
        setSelectedGuardianId('');
        setGuardianSearch('');
      }
    }
  }, [isOpen, athleteToEdit]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(guardianSearch.toLowerCase()) || 
                          u.email.toLowerCase().includes(guardianSearch.toLowerCase());
    const isNotAdmin = u.role !== 'admin';
    return matchesSearch && isNotAdmin;
  });

  const handleSaveAthlete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Nama atlet wajib diisi', 'error');
      return;
    }
    if (!birthDate) {
      showToast('Tanggal lahir wajib diisi', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (athleteToEdit) {
        // Edit flow
        const updatedProfile: ChildProfile = {
          ...athleteToEdit,
          name: name.trim(),
          birthDate,
          gender,
          avatar: avatar.trim() || undefined,
          clubId: clubId || undefined,
          jerseyNumber: jerseyNumber.trim() || undefined,
        };

        await statsService.updateProfile(updatedProfile);
        showToast('Profil atlet berhasil diperbarui!', 'success');
      } else {
        // Create flow
        // Generate continuous random 6 digit for internal ID (HS-XXXXXX)
        const digits = Math.floor(100000 + Math.random() * 900000);
        const internalId = `HS-${digits}`;

        let claimStatus: 'unclaimed' | 'verified' = 'unclaimed';
        let links = athleteToEdit?.links || [];

        if (linkGuardianOnCreate && selectedGuardianId) {
          claimStatus = 'verified';
          links = [
            {
              accountId: selectedGuardianId,
              relationship: 'guardian',
              verified: true,
              verifiedAt: Date.now()
            }
          ];
        }

        const newProfile: ChildProfile = {
          id: generateId('profile'),
          name: name.trim(),
          birthDate,
          gender,
          avatar: avatar.trim() || undefined,
          clubId: clubId || undefined,
          jerseyNumber: jerseyNumber.trim() || undefined,
          internalId,
          claimStatus,
          links,
          isDiscoverable: true,
          transferHistory: [],
          aliases: []
        };

        await statsService.addProfile(newProfile);
        showToast(`Berhasil menambahkan atlet baru ${name.trim()}!`, 'success');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan profil atlet', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={athleteToEdit ? "Edit Profil Atlet" : "Tambah Atlet Baru"}
    >
      <form onSubmit={handleSaveAthlete} className="space-y-4 font-sans text-zinc-900 dark:text-zinc-100 max-h-[80vh] overflow-y-auto pr-2">
        {/* Name input */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 block uppercase font-bold tracking-wider">Nama Lengkap *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masukkan nama lengkap atlet..."
            className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-orange"
          />
        </div>

        {/* Birth date input */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 block uppercase font-bold tracking-wider">Tanggal Lahir *</label>
          <input
            type="date"
            required
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-orange"
          />
        </div>

        {/* Gender Selection */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 block uppercase font-bold tracking-wider">Jenis Kelamin *</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGender('L')}
              className={`py-2 text-sm font-bold border rounded-xl transition-all ${
                gender === 'L'
                  ? 'bg-brand-navy/5 dark:bg-brand-orange/10 border-brand-navy dark:border-brand-orange text-brand-navy dark:text-brand-orange font-black'
                  : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500'
              }`}
            >
              Laki-laki
            </button>
            <button
              type="button"
              onClick={() => setGender('P')}
              className={`py-2 text-sm font-bold border rounded-xl transition-all ${
                gender === 'P'
                  ? 'bg-brand-navy/5 dark:bg-brand-orange/10 border-brand-navy dark:border-brand-orange text-brand-navy dark:text-brand-orange font-black'
                  : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500'
              }`}
            >
              Perempuan
            </button>
          </div>
        </div>

        {/* Avatar URL / Photo */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 block uppercase font-bold tracking-wider">Foto Profil (URL)</label>
          <input
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://example.com/foto-atlet.jpg (Opsional)"
            className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-orange"
          />
        </div>

        {/* Club selection */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 block uppercase font-bold tracking-wider">Klub Aktif</label>
          <select
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-orange"
          >
            <option value="">-- Tanpa Klub --</option>
            {clubs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Jersey Number */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 block uppercase font-bold tracking-wider">Nomor Punggung</label>
          <input
            type="text"
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
            placeholder="Masukkan nomor punggung (mis. 23)"
            className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-orange font-mono"
          />
        </div>

        {/* Guardian link choice on create only */}
        {!athleteToEdit && (
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="link-guardian"
                checked={linkGuardianOnCreate}
                onChange={(e) => setLinkGuardianOnCreate(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-800 text-brand-orange focus:ring-brand-orange h-4 w-4"
              />
              <label htmlFor="link-guardian" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 select-none cursor-pointer">
                Tautkan Guardian / Wali Terdaftar Langsung
              </label>
            </div>

            {linkGuardianOnCreate && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl space-y-2 border border-zinc-100 dark:border-zinc-800">
                <input
                  type="text"
                  placeholder="Cari wali..."
                  value={guardianSearch}
                  onChange={(e) => setGuardianSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none"
                />

                <div className="max-h-32 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950">
                  {filteredUsers.length === 0 ? (
                    <p className="text-[10px] text-zinc-400 italic p-3 text-center">Wali tidak ditemukan.</p>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedGuardianId === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSelectedGuardianId(u.id)}
                          className={`w-full text-left p-2 flex items-center justify-between text-[11px] ${
                            isSelected 
                              ? 'bg-brand-navy/5 dark:bg-brand-orange/10 text-brand-navy dark:text-brand-orange font-bold' 
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div>
                            <p>{u.name}</p>
                            <p className="text-[9px] text-zinc-400 font-mono font-normal">{u.email}</p>
                          </div>
                          {isSelected && <ShieldCheck size={12} className="text-emerald-500" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : athleteToEdit ? 'Simpan Perubahan' : 'Tambah Atlet'}
          </Button>
        </div>
      </form>
    </BaseModal>
  );
};
