import { AIFeedback } from "@/components/home/AIFeedback";
import { FinalCTA } from "@/components/home/FinalCTA";
import { HomeFooter } from "@/components/home/HomeFooter";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PracticeModes } from "@/components/home/PracticeModes";
import { ProductJourney } from "@/components/home/ProductJourney";
import { ProgressShowcase } from "@/components/home/ProgressShowcase";
import { QuestionShowcase } from "@/components/home/QuestionShowcase";
import { ResumeIntelligence } from "@/components/home/ResumeIntelligence";
import { useHomeReveal } from "@/components/home/useHomeReveal";

export function HomePage() {
  useHomeReveal();
  return (
    <div className="home-page">
      <HomeNavbar />
      <HomeHero />
      <ProductJourney />
      <HowItWorks />
      <ResumeIntelligence />
      <QuestionShowcase />
      <PracticeModes />
      <AIFeedback />
      <ProgressShowcase />
      <FinalCTA />
      <HomeFooter />
    </div>
  );
}
