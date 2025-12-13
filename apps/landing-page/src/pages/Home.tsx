'use client';
import { lazy, Suspense, type ReactNode } from 'react';
import SEOHead from '../components/SEOHead';

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

const SuspendedSection = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => <Suspense>{children}</Suspense>;

export default function Home() {
  return (
    <>
      <SEOHead
        title="Sia - Wake Up To Ready Pull Requests"
        description="Delegate coding tasks to Sia through Slack or Discord. It queues them, executes via AI coding tools, and creates pull requests while you sleep."
        keywords="AI coding assistant, automated pull requests, Slack bot, Discord bot, code automation, AI developer tools, GitHub automation"
        url="https://getpullrequest.com"
        type="website"
      />
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
