export interface PricingPackage {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted: boolean;
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface SiteContent {
  id: 'main';
  hero: {
    headline: string;
    subheadline: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  pricing: PricingPackage[];
  testimonials: Testimonial[];
  faqs: FaqItem[];
  updatedAt: number;
}
