import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import SolutionSection from "@/components/landing/SolutionSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import ForgettingCurveSection from "@/components/landing/ForgettingCurveSection";
import StatsSection from "@/components/landing/StatsSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import CompetitorComparisonSection from "@/components/landing/CompetitorComparisonSection";
import BenefitsSection from "@/components/landing/BenefitsSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import ConversionBadgesSection from "@/components/landing/ConversionBadgesSection";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";

const Landing = () => (
  <div className="min-h-screen bg-[#050508] relative overflow-hidden">
    {/* Debug tag requested by user */}
    <div className="fixed top-0 left-0 z-[9999] bg-primary text-primary-foreground text-[10px] px-2 py-0.5 font-bold uppercase pointer-events-none">
      confira se esta resolvido
    </div>
    <EnaflixBackgroundFX intensity="subtle" />
    <div className="relative z-10">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <ForgettingCurveSection />
      <StatsSection />
      <FeaturesSection />
      <CompetitorComparisonSection />
      <BenefitsSection />
      <TestimonialsSection />
      <ConversionBadgesSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  </div>
);

export default Landing;