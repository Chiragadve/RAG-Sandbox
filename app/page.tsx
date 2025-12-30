'use client'

import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import ProblemSection from "@/components/landing/ProblemSection";
import CapabilitiesSection from "@/components/landing/CapabilitiesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import AudienceSection from "@/components/landing/AudienceSection";
import TechStackSection from "@/components/landing/TechStackSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            <Navbar />
            <main>
                <Hero />
                <ProblemSection />
                <CapabilitiesSection />
                <HowItWorksSection />
                <ComparisonSection />
                <AudienceSection />
                <TechStackSection />
                <CTASection />
            </main>
            <Footer />
        </div>
    );
}
