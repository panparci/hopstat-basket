import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/organisms/Layout';
import { initDB } from '../lib/db';
import { statsService } from '../core/services/statsService';
import { authService } from '../services/authService';
import { claimService } from '../services/claimService';
import { ClaimRequest } from '../core/types/claim';
import { UserAccount } from '../core/types/serviceRequests';
import { ChildProfile, Team, Club, GameEvent, MatchRoster } from '../core/types/stats';
import { SearchStep } from '../features/claim-athlete/ui/SearchStep';
import { TeaserStep } from '../features/claim-athlete/ui/TeaserStep';
import { VerificationFormStep } from '../features/claim-athlete/ui/VerificationFormStep';
import { PaymentStep } from '../features/claim-athlete/ui/PaymentStep';
import { SuccessStep } from '../features/claim-athlete/ui/SuccessStep';

interface StatsSummary {
  ppg: string;
  rpg: string;
  apg: string;
  matchCount: number;
}

export const ClaimAthletePage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeStep, setActiveStep] = useState<'search' | 'teaser' | 'form' | 'payment' | 'success'>('search');
  
  // Search state
  const [searchName, setSearchName] = useState('');
  const [searchDob, setSearchDob] = useState('');
  const [searchClub, setSearchClub] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Found Profile details
  const [matchedProfile, setMatchedProfile] = useState<ChildProfile | null>(null);
  const [matchedTeam, setMatchedTeam] = useState<Team | null>(null);
  const [matchedClub, setMatchedClub] = useState<Club | null>(null);
  const [statsSummary, setStatsSummary] = useState<StatsSummary>({ ppg: '0', rpg: '0', apg: '0', matchCount: 0 });
  const [existingClaim, setExistingClaim] = useState<ClaimRequest | null>(null);

  // Claimant form state
  const [relationship, setRelationship] = useState<'ayah' | 'ibu' | 'wali'>('ayah');
  const [claimantName, setClaimantName] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [claimantNik, setClaimantNik] = useState('');
  
  // Child confirmation state (prefilled from matched profile)
  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('');
  const [childGender, setChildGender] = useState('L');
  const [childClub, setChildClub] = useState('');
  const [childJerseyNumber, setChildJerseyNumber] = useState('');
  const [childEvents, setChildEvents] = useState<string[]>([]);
  
  // Documents upload state
  const [documents, setDocuments] = useState<{ type: string; fileName: string; dataUrl: string }[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Pre-screen score
  const [matchScore, setMatchScore] = useState(100);

  // Payment State
  const [selectedPackage, setSelectedPackage] = useState<'basic' | 'premium' | 'pro'>('premium');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'e-wallet'>('transfer');
  const [processingPayment, setProcessingPayment] = useState(false);

  const [userApproved, setUserApproved] = useState(false);
  const [userPending, setUserPending] = useState(false);
  const [othersVerified, setOthersVerified] = useState(false);
  const [othersPending, setOthersPending] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setClaimantName(user.name || '');
      }
    };
    fetchUser();
  }, []);

  const calculateKU = (dateString?: string) => {
    if (!dateString) return 'KU-?';
    const birthYear = new Date(dateString).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
    if (age <= 8) return 'KU-8';
    if (age <= 10) return 'KU-10';
    if (age <= 12) return 'KU-12';
    if (age <= 14) return 'KU-14';
    if (age <= 16) return 'KU-16';
    if (age <= 18) return 'KU-18';
    return `KU-${age}`;
  };

  const getPackagePrice = (pkg: 'basic' | 'premium' | 'pro') => {
    switch (pkg) {
      case 'basic': return 50000;
      case 'premium': return 150000;
      case 'pro': return 250000;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setSearching(true);
    setSearched(false);
    setMatchedProfile(null);
    setMatchedTeam(null);
    setMatchedClub(null);
    setExistingClaim(null);

    if (!searchName.trim() || !searchDob || !searchClub.trim()) {
      setSearchError('Semua kolom pencarian wajib diisi!');
      setSearching(false);
      return;
    }

    try {
      const dbInstance = await initDB();
      const allProfiles = await dbInstance.getAll('profiles');
      const allTeams = await dbInstance.getAll('teams');
      const allClubs = await dbInstance.getAll('clubs');

      // Find profile by exact-match: Name + DOB + Club/Team
      const foundProfile = allProfiles.find(profile => {
        const nameMatch = profile.name.trim().toLowerCase() === searchName.trim().toLowerCase();
        const dobMatch = profile.birthDate === searchDob;
        
        // Find club or team matching searchClub (supports partial matching for SBA Harimau etc)
        let clubOrTeamMatch = false;
        
        // If profile is linked to a team
        if (profile.teamId) {
          const team = allTeams.find(t => t.id === profile.teamId);
          if (team) {
            // Check team name
            if (team.name.trim().toLowerCase().includes(searchClub.trim().toLowerCase())) {
              clubOrTeamMatch = true;
            }
            // Check club name
            if (team.clubId) {
              const club = allClubs.find(c => c.id === team.clubId);
              if (club && club.name.trim().toLowerCase().includes(searchClub.trim().toLowerCase())) {
                clubOrTeamMatch = true;
              }
            }
          }
        }

        // Alternative check: mainTeamId or custom fields
        return nameMatch && dobMatch && clubOrTeamMatch;
      });

      if (foundProfile) {
        setMatchedProfile(foundProfile);

        // Fetch matched team & club for displaying
        const team = foundProfile.teamId ? allTeams.find(t => t.id === foundProfile.teamId) : undefined;
        if (team) {
          setMatchedTeam(team);
          const club = team.clubId ? allClubs.find(c => c.id === team.clubId) : undefined;
          if (club) setMatchedClub(club);
        }

        // Calculate Stats Teaser and Match count
        const allMatches = await dbInstance.getAll('matches');
        const allRosters = await dbInstance.getAll('match_rosters');
        const allEvents = await dbInstance.getAll('events');

        const profileRosterMatchIds = new Set(
          allRosters.filter((r: MatchRoster) => r.profileId === foundProfile.id).map((r: MatchRoster) => r.matchId)
        );

        const profileMatches = allMatches.filter(m => m.childId === foundProfile.id || profileRosterMatchIds.has(m.id));
        const matchCount = profileMatches.length;

        // Calculate PPG, RPG, APG
        let totalPoints = 0;
        let totalRebounds = 0;
        let totalAssists = 0;

        const profileEvents = allEvents.filter((e: GameEvent) => e.playerId === foundProfile.id);
        profileEvents.forEach((e: GameEvent) => {
          if (e.type === '1pt_make') totalPoints += 1;
          else if (e.type === '2pt_make') totalPoints += 2;
          else if (e.type === '3pt_make') totalPoints += 3;
          else if (e.type === 'free_throw' && e.result === 'make') totalPoints += 1;
          else if (e.type === 'shot' && e.result === 'make') totalPoints += (e.points || 2);

          if (e.type === 'oreb' || e.type === 'dreb' || e.type === 'rebound') {
            totalRebounds += 1;
          }
          if (e.type === 'ast') {
            totalAssists += 1;
          }
        });

        const finalMatchCount = matchCount;
        const finalPoints = totalPoints;
        const finalRebounds = totalRebounds;
        const finalAssists = totalAssists;

        setStatsSummary({
          ppg: finalMatchCount > 0 ? (finalPoints / finalMatchCount).toFixed(1) : '0.0',
          rpg: finalMatchCount > 0 ? (finalRebounds / finalMatchCount).toFixed(1) : '0.0',
          apg: finalMatchCount > 0 ? (finalAssists / finalMatchCount).toFixed(1) : '0.0',
          matchCount: finalMatchCount
        });

        // Check if there are claims for this profile
        const profileClaims = await dbInstance.getAllFromIndex('claim_requests', 'by-profile', foundProfile.id);
        const hasUserPending = profileClaims.some(c => c.claimantAccountId === currentUser?.id && c.status === 'pending');
        const hasUserApproved = profileClaims.some(c => c.claimantAccountId === currentUser?.id && c.status === 'approved') || 
                             (foundProfile.links !== undefined && foundProfile.links.some(l => l.accountId === (currentUser?.id || '') && l.verified));
        const hasOthersVerified = foundProfile.claimStatus === 'verified' && !hasUserApproved;
        const hasOthersPending = foundProfile.claimStatus === 'claim_pending' && !hasUserPending;

        setUserPending(hasUserPending);
        setUserApproved(hasUserApproved);
        setOthersVerified(hasOthersVerified);
        setOthersPending(hasOthersPending);

        const activeClaim = profileClaims.find(c => c.claimantAccountId === currentUser?.id) || profileClaims[0];
        if (activeClaim) {
          setExistingClaim(activeClaim);
        }

        // Pre-fill child confirmation fields
        setChildName(foundProfile.name);
        setChildDob(foundProfile.birthDate || '');
        setChildGender('L'); // default
        setChildClub(team ? team.name : '');
        setChildJerseyNumber(foundProfile.jerseyNumber || '');
        
        // Find recognized events
        const eventsList = Array.from(new Set(profileMatches.map(m => m.eventName).filter(Boolean))) as string[];
        setChildEvents(eventsList);

        setActiveStep('teaser');
      } else {
        setSearched(true);
      }
    } catch (err) {
      console.error(err);
      setSearchError('Terjadi kesalahan saat memproses pencarian.');
    } finally {
      setSearching(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'kk' | 'akta' | 'kartu_pelajar') => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Size limit 5MB
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal adalah 5MB!');
      return;
    }

    // Type checking
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Tipe file hanya boleh berupa Gambar (JPG, PNG) atau PDF!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setDocuments(prev => [
        ...prev.filter(doc => doc.type !== type),
        { type, fileName: file.name, dataUrl }
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDocument = (type: string) => {
    setDocuments(prev => prev.filter(doc => doc.type !== type));
  };

  const calculateAutomaticPreScreen = () => {
    if (!matchedProfile) return 100;
    let score = 0;

    // Check name
    if (childName.trim().toLowerCase() === matchedProfile.name.trim().toLowerCase()) {
      score += 40;
    } else if (childName.trim().toLowerCase().includes(matchedProfile.name.trim().toLowerCase())) {
      score += 20;
    }

    // Check DOB
    if (childDob === matchedProfile.birthDate) {
      score += 30;
    }

    // Check Club / Team
    const teamName = matchedTeam ? matchedTeam.name : '';
    const clubName = matchedClub ? matchedClub.name : '';
    if (
      childClub.trim().toLowerCase() === teamName.trim().toLowerCase() ||
      childClub.trim().toLowerCase() === clubName.trim().toLowerCase()
    ) {
      score += 20;
    }

    // Check Jersey Number
    if (childJerseyNumber === matchedProfile.jerseyNumber) {
      score += 10;
    }

    return score;
  };

  const handleGoToForm = () => {
    if (existingClaim && (existingClaim.status === 'pending' || matchedProfile?.claimStatus === 'claim_pending')) {
      return; // Prevent if claim already pending/verified
    }
    setActiveStep('form');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!claimantName.trim() || !claimantPhone.trim()) {
      setUploadError('Nama pengklaim dan nomor WhatsApp wajib diisi!');
      return;
    }

    // KK is absolutely required
    const hasKK = documents.some(doc => doc.type === 'kk');
    if (!hasKK) {
      setUploadError('Dokumen Kartu Keluarga (KK) wajib diunggah untuk verifikasi keamanan!');
      return;
    }

    if (!agreedToTerms) {
      setUploadError('Anda harus menyetujui pernyataan kebenaran data dan kebijakan privasi.');
      return;
    }

    // Pre-screen automatically
    const score = calculateAutomaticPreScreen();
    setMatchScore(score);

    setUploadError('');
    setActiveStep('payment');
  };

  const handleProcessPayment = async () => {
    if (!currentUser || !matchedProfile) return;
    setProcessingPayment(true);

    try {
      // Create the claim request using FSD claimService
      await claimService.createClaim(
        {
          profileId: matchedProfile.id,
          claimantAccountId: currentUser.id,
          relationship,
          claimantName,
          claimantPhone,
          claimantNik: claimantNik || undefined,
          childData: {
            name: childName,
            dob: childDob,
            gender: childGender,
            club: childClub,
            jerseyNumber: childJerseyNumber || undefined,
            events: childEvents
          },
          documents,
          matchScore
        },
        paymentMethod,
        getPackagePrice(selectedPackage)
      );

      setActiveStep('success');
    } catch (err) {
      console.error(err);
      setUploadError('Gagal memproses pembayaran dan klaim.');
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <Layout title="Klaim Atlet">
      <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Header Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight uppercase">
            {activeStep === 'search' && 'Temukan Atlet Saya'}
            {activeStep === 'teaser' && 'Profil Atlet Ditemukan'}
            {activeStep === 'form' && 'Formulir Klaim & Verifikasi'}
            {activeStep === 'payment' && 'Selesaikan Pembayaran'}
            {activeStep === 'success' && 'Pengajuan Dikirim'}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
            {activeStep === 'search' && 'Keamanan anak WAJIB: masukkan pencarian kecocokan exact untuk memverifikasi hubungan keluarga.'}
            {activeStep === 'teaser' && 'Tinjau teaser statistik terbatas di bawah sebelum melanjutkan proses klaim.'}
            {activeStep === 'form' && 'Lengkapi informasi keluarga dan unggah Kartu Keluarga untuk membuktikan wali resmi.'}
            {activeStep === 'payment' && 'Pilih paket statistik Anda dan selesaikan transaksi aman.'}
            {activeStep === 'success' && 'Klaim masuk antrean. Pembayaran menunggu konfirmasi admin (belum ada gerbang pembayaran otomatis).'}
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center justify-between px-6 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50">
          {(['search', 'teaser', 'form', 'payment', 'success'] as const).map((step, i) => {
            const steps = ['Cari', 'Teaser', 'Verifikasi', 'Bayar', 'Selesai'];
            const stepIndex = ['search', 'teaser', 'form', 'payment', 'success'].indexOf(activeStep);
            const isCompleted = i < stepIndex;
            const isActive = i === stepIndex;

            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCompleted ? 'bg-emerald-500 text-white' :
                    isActive ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy' :
                    'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                  }`}>
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <span className={`text-[9px] font-bold mt-1 uppercase tracking-wider ${
                    isActive ? 'text-brand-navy dark:text-brand-orange' : 'text-zinc-400'
                  }`}>
                    {steps[i]}
                  </span>
                </div>
                {i < 4 && (
                  <div className={`flex-1 h-[2px] mx-2 -mt-4 ${
                    i < stepIndex ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Dynamic Steps based on FSD ui elements */}
        {activeStep === 'search' && (
          <SearchStep
            searchName={searchName}
            setSearchName={setSearchName}
            searchDob={searchDob}
            setSearchDob={setSearchDob}
            searchClub={searchClub}
            setSearchClub={setSearchClub}
            searchError={searchError}
            searching={searching}
            onSearch={handleSearch}
          />
        )}

        {activeStep === 'teaser' && matchedProfile && (
          <TeaserStep
            matchedProfile={matchedProfile}
            matchedTeam={matchedTeam}
            statsSummary={statsSummary}
            userApproved={userApproved}
            userPending={userPending}
            othersVerified={othersVerified}
            othersPending={othersPending}
            calculateKU={calculateKU}
            onBack={() => { setActiveStep('search'); setSearched(false); }}
            onNext={handleGoToForm}
          />
        )}

        {activeStep === 'form' && matchedProfile && (
          <VerificationFormStep
            relationship={relationship}
            setRelationship={setRelationship}
            claimantName={claimantName}
            setClaimantName={setClaimantName}
            claimantPhone={claimantPhone}
            setClaimantPhone={setClaimantPhone}
            claimantNik={claimantNik}
            setClaimantNik={setClaimantNik}
            childName={childName}
            setChildName={setChildName}
            childDob={childDob}
            setChildDob={setChildDob}
            childGender={childGender}
            setChildGender={setChildGender}
            childClub={childClub}
            setChildClub={setChildClub}
            childJerseyNumber={childJerseyNumber}
            setChildJerseyNumber={setChildJerseyNumber}
            childEvents={childEvents}
            documents={documents}
            uploadError={uploadError}
            agreedToTerms={agreedToTerms}
            setAgreedToTerms={setAgreedToTerms}
            handleFileUpload={handleFileUpload}
            handleRemoveDocument={handleRemoveDocument}
            onSubmit={handleFormSubmit}
            onBack={() => setActiveStep('teaser')}
          />
        )}

        {activeStep === 'payment' && matchedProfile && (
          <PaymentStep
            selectedPackage={selectedPackage}
            setSelectedPackage={setSelectedPackage}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            uploadError={uploadError}
            processingPayment={processingPayment}
            getPackagePrice={getPackagePrice}
            handleProcessPayment={handleProcessPayment}
            onBack={() => setActiveStep('form')}
          />
        )}

        {activeStep === 'success' && (
          <SuccessStep
            matchScore={matchScore}
            onReturnHome={() => navigate('/')}
          />
        )}

      </div>
    </Layout>
  );
};
