import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { contentService } from '../services/contentService';
import { Navbar } from '../components/landing/Navbar';
import { Hero } from '../components/landing/Hero';
import { ProblemSolution } from '../components/landing/ProblemSolution';
import { Features } from '../components/landing/Features';
import { HowItWorks } from '../components/landing/HowItWorks';
import { Pricing } from '../components/landing/Pricing';
import { Testimonials } from '../components/landing/Testimonials';
import { FAQ } from '../components/landing/FAQ';
import { CtaBanner } from '../components/landing/CtaBanner';
import { Footer } from '../components/landing/Footer';
import { BaseModal } from '../components/atoms/BaseModal';
import { LeadForm } from '../components/landing/LeadForm';
import { Lead } from '../core/types/crm';
import { SiteContent } from '../core/types/cms';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedInterest, setSelectedInterest] = useState<Lead['interest']>('free');
  const [siteContent, setSiteContent] = useState<SiteContent | null>(null);

  useEffect(() => {
    const checkAuthAndLoadContent = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          // If already logged in, redirect to main application
          navigate('/', { replace: true });
          return;
        }
        
        // Load the landing page content from contentService
        const content = await contentService.getContent();
        setSiteContent(content);
      } catch (err) {
        console.error('Failed to load landing page data', err);
      } finally {
        setLoading(false);
      }
    };
    checkAuthAndLoadContent();
  }, [navigate]);

  const handleLoginRedirect = () => {
    navigate('/login');
  };

  const handleSignupRedirect = () => {
    navigate('/signup');
  };

  const handlePlanSelect = (planId: string) => {
    // Map planId to Lead['interest'] (free, pro, verified)
    const interestMap: Record<string, Lead['interest']> = {
      'free': 'free',
      'pro': 'pro',
      'verified': 'verified'
    };
    setSelectedInterest(interestMap[planId] || 'free');
    setIsLeadModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 selection:bg-brand-orange selection:text-brand-navy">
      {/* Navbar */}
      <Navbar onLoginClick={handleLoginRedirect} onSignupClick={handleSignupRedirect} />

      {/* Main Sections */}
      <main className="flex-1">
        {/* Hero Section */}
        <Hero 
          onSignupClick={handleSignupRedirect} 
          onDemoClick={handleSignupRedirect} 
          hero={siteContent?.hero}
        />

        {/* Problem -> Solution Section */}
        <ProblemSolution />

        {/* Features Section */}
        <Features />

        {/* How It Works Section */}
        <HowItWorks />

        {/* Pricing Section */}
        <Pricing 
          onPlanSelect={handlePlanSelect} 
          plans={siteContent?.pricing}
        />

        {/* Testimonials Section */}
        <Testimonials 
          testimonials={siteContent?.testimonials}
        />

        {/* FAQ Section */}
        <FAQ 
          faqs={siteContent?.faqs}
        />

        {/* Closing CTA Banner */}
        <CtaBanner onCtaClick={handleSignupRedirect} />
      </main>

      {/* Pricing Lead Capture Modal */}
      <BaseModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        title="Hubungi Tim Kami"
      >
        <div className="pt-2">
          <LeadForm 
            source="landing_pricing" 
            defaultInterest={selectedInterest} 
            onSuccess={() => {
              // Optionally close modal after a short delay
              setTimeout(() => {
                setIsLeadModalOpen(false);
              }, 2500);
            }}
          />
        </div>
      </BaseModal>

      {/* Footer */}
      <Footer />
    </div>
  );
};
