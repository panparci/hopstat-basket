import React, { useState, useEffect } from 'react';
import { organizationRepo } from '../model/organizationRepo';
import { Organization } from '../model/types';
import { Building2, Search, Plus, Check, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/atoms/Button';
import { Input } from '../../../components/atoms/Input';

interface OrganizationSelectorProps {
  label: string;
  selectedOrgId: string;
  onChange: (orgId: string, orgName: string) => void;
}

export const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({
  label,
  selectedOrgId,
  onChange,
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showProposeForm, setShowProposeForm] = useState(false);
  
  // Propose Form Fields
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState<'club' | 'academy' | 'school'>('club');
  const [newOrgCity, setNewOrgCity] = useState('');
  const [newOrgProvince, setNewOrgProvince] = useState('');
  
  // Similar checking
  const [similarOrgs, setSimilarOrgs] = useState<Organization[]>([]);
  const [ignoreSimilar, setIgnoreSimilar] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    const list = await organizationRepo.list();
    // Filter out merged organizations
    setOrganizations(list.filter(org => org.status !== 'merged'));
  };

  // Run similarity check when name or city changes
  useEffect(() => {
    if (newOrgName.trim().length >= 3 && newOrgCity.trim().length >= 3 && !ignoreSimilar) {
      const delayDebounce = setTimeout(async () => {
        const matches = await organizationRepo.findSimilar(newOrgName, newOrgCity);
        setSimilarOrgs(matches);
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setSimilarOrgs([]);
    }
  }, [newOrgName, newOrgCity, ignoreSimilar]);

  const handleSelectOrg = (org: Organization) => {
    onChange(org.id, org.name);
    setSearchQuery(org.name);
    setIsDropdownOpen(false);
    setShowProposeForm(false);
  };

  const handleProposeNew = async () => {
    if (!newOrgName.trim() || !newOrgCity.trim()) return;

    // Create a new pending organization
    const proposed: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'> = {
      name: newOrgName.trim(),
      type: newOrgType,
      city: newOrgCity.trim(),
      province: newOrgProvince.trim() || undefined,
      status: 'pending',
    };

    const created = await organizationRepo.create(proposed);
    await loadOrganizations();
    
    // Select the newly proposed organization
    handleSelectOrg(created);
    
    // Reset form
    setNewOrgName('');
    setNewOrgCity('');
    setNewOrgProvince('');
    setIgnoreSimilar(false);
    setSimilarOrgs([]);
  };

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);

  return (
    <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-100 dark:border-zinc-800">
      <div className="flex justify-between items-center">
        <label className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</label>
        {selectedOrg && (
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
            selectedOrg.status === 'verified' 
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          }`}>
            {selectedOrg.status}
          </span>
        )}
      </div>

      {!showProposeForm ? (
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-4 flex items-center text-zinc-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Cari Organisasi..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full pl-11 pr-4 py-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowProposeForm(true);
                setSearchQuery('');
              }}
              className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300"
            >
              <Plus size={18} />
            </Button>
          </div>

          {isDropdownOpen && searchQuery && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {filteredOrgs.length > 0 ? (
                filteredOrgs.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => handleSelectOrg(org)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between font-bold text-zinc-800 dark:text-zinc-100"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-zinc-400" />
                      <span>{org.name}</span>
                      <span className="text-xs text-zinc-400">({org.city})</span>
                    </div>
                    {selectedOrgId === org.id && <Check size={14} className="text-emerald-500" />}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-zinc-500 font-medium">
                  Tidak ada organisasi ditemukan. <br />
                  <button
                    type="button"
                    onClick={() => {
                      setShowProposeForm(true);
                      setNewOrgName(searchQuery);
                    }}
                    className="text-brand-navy dark:text-brand-orange underline font-bold mt-1"
                  >
                    Usulkan "{searchQuery}" baru
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 bg-zinc-100/50 dark:bg-zinc-900/80 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/80">
          <div className="flex justify-between items-center mb-1">
            <h4 className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">Usulan Organisasi Baru</h4>
            <button
              type="button"
              onClick={() => {
                setShowProposeForm(false);
                setIgnoreSimilar(false);
                setSimilarOrgs([]);
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600 font-bold"
            >
              Batal
            </button>
          </div>

          <div className="space-y-2">
            <Input
              placeholder="Nama Organisasi (mis. Merpati Bali)"
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              required
              className="bg-white dark:bg-zinc-950 rounded-xl py-2 text-sm font-bold"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={newOrgType}
                onChange={e => setNewOrgType(e.target.value as any)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-xs text-[#1A1A1A] dark:text-white"
              >
                <option value="club">Klub (Club)</option>
                <option value="academy">Akademi</option>
                <option value="school">Sekolah</option>
              </select>

              <Input
                placeholder="Kota (mis. Denpasar)"
                value={newOrgCity}
                onChange={e => setNewOrgCity(e.target.value)}
                required
                className="bg-white dark:bg-zinc-950 rounded-xl py-2 text-sm font-bold"
              />
            </div>

            <Input
              placeholder="Provinsi (mis. Bali)"
              value={newOrgProvince}
              onChange={e => setNewOrgProvince(e.target.value)}
              className="bg-white dark:bg-zinc-950 rounded-xl py-2 text-sm font-bold"
            />
          </div>

          {similarOrgs.length > 0 && !ignoreSimilar && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl space-y-2">
              <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <div className="text-xs font-bold">Maksud Anda organisasi di bawah ini?</div>
              </div>
              <div className="space-y-1">
                {similarOrgs.map(org => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => {
                      handleSelectOrg(org);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-800 dark:text-zinc-200 flex justify-between items-center"
                  >
                    <span>{org.name} ({org.city})</span>
                    <span className="text-[10px] uppercase text-emerald-600 font-black">Pilih ini</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIgnoreSimilar(true)}
                className="text-[10px] text-zinc-500 underline hover:text-zinc-700 font-bold block"
              >
                Tetap Usulkan Baru
              </button>
            </div>
          )}

          <Button
            type="button"
            onClick={handleProposeNew}
            disabled={!newOrgName.trim() || !newOrgCity.trim() || (similarOrgs.length > 0 && !ignoreSimilar)}
            className="w-full rounded-xl bg-brand-navy hover:bg-brand-navy/90 text-white font-bold py-2 text-xs"
          >
            Usulkan & Pilih Organisasi ini
          </Button>
        </div>
      )}
    </div>
  );
};
