"use client";
import { lazy, Suspense, type ReactNode } from 'react';

const Navbar = lazy(() => import('../components/Navbar'));
const Hero = lazy(() => import('../components/Hero'));
const Testimonials = lazy(() => import('../components/Testimonials'));
const Integrations = lazy(() => import('../components/Integrations'));
const Features = lazy(() => import('../components/Features'));
const HowItWorks = lazy(() => import('../components/HowItWorks'));
const Pricing = lazy(() => import('../components/Pricing'));
const ProblemSolution = lazy(() => import('../components/ProblemSolution'));
const EarlyAccessCTA = lazy(() => import('../components/EarlyAccessCTA'));
const Footer = lazy(() => import('../components/Footer'));



const SuspendedSection = ({ label, children }: { label: string; children: ReactNode }) => (
  <Suspense >{children}</Suspense>
);

export default function Home() {
  return (
    <>

      <div className="min-h-screen bg-background max-w-screen overflow-x-hidden">
        <SuspendedSection label="Navbar">
          <Navbar />
        </SuspendedSection>
        <SuspendedSection label="Hero">
          <Hero />
        </SuspendedSection>
        <SuspendedSection label="Testimonials">
          <Testimonials />
        </SuspendedSection>
        <SuspendedSection label="Integrations">
          <Integrations />
        </SuspendedSection>
        <SuspendedSection label="Features">
          <Features />
        </SuspendedSection>
        <SuspendedSection label="How It Works">
          <HowItWorks />
        </SuspendedSection>
        <SuspendedSection label="Pricing">
          <Pricing />
        </SuspendedSection>
        <SuspendedSection label="Problem & Solution">
          <ProblemSolution />
        </SuspendedSection>
        <SuspendedSection label="Early Access">
          <EarlyAccessCTA />
        </SuspendedSection>
        <SuspendedSection label="Footer">
          <Footer />
        </SuspendedSection>
      </div>
    </>
  );
}
