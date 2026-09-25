import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Eye, 
  Target, 
  Video, 
  UserCheck, 
  Sparkles, 
  HeartHandshake, 
  Compass, 
  Globe2, 
  Layers,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { LotusLogo } from '../components/LotusLogo';

export default function Vision() {
  return (
    <div className="min-h-[calc(100vh-73px)] font-body bg-background text-on-surface">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border-subtle bg-surface-container/60 py-16 md:py-24 px-6">
        <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center overflow-hidden">
          <LotusLogo className="w-[100vw] h-[100vw] max-w-[1200px] max-h-[1200px] text-accent" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-accent/40 text-xs font-bold text-primary uppercase tracking-widest shadow-sm">
            <Compass className="w-3.5 h-3.5 text-accent" />
            <span>Our Future Roadmap</span>
          </div>

          <div className="space-y-2">
            <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-bold text-primary tracking-tight">
              The Kalavritti Vision
            </h1>
            <p className="font-hindi text-xl sm:text-2xl font-bold text-accent tracking-wider">
              हमारा दृष्टिकोण — संस्कृति, तकनीक एवं सशक्तिकरण
            </p>
          </div>

          <p className="text-base sm:text-lg text-on-surface-variant font-medium leading-relaxed max-w-3xl mx-auto">
            To build India’s most trusted, culturally enriching, and beginner-friendly e-commerce ecosystem — where any artisan can launch their business in minutes, and where real-time video broadcasting brings buyer-seller trust to life.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-16 space-y-16">
        
        {/* Core Vision Principles */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="bg-surface-container border border-border-subtle rounded-2xl p-7 shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h2 className="font-headline text-xl font-bold text-primary">
                Beginner-Friendly Selling
              </h2>
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                Many gifted Indian craftsmen are hesitant to sell online due to technical friction. Our guiding goal is to eliminate complexity: streamlined cataloging, intuitive local-language guidance, and automated fulfillment through Shefaro so that anyone with a craft can sell all over India.
              </p>
            </div>
          </div>

          <div className="bg-surface-container border border-border-subtle rounded-2xl p-7 shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <h2 className="font-headline text-xl font-bold text-primary">
                Live Broadcast Commerce
              </h2>
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                Static photos cannot capture the true soul of handmade pottery, intricate brasswork, or hand-spun silk. Through <strong>Kalavritti Meet</strong>, we are unlocking live broadcasting where sellers demonstrate crafting techniques, answer buyer questions live, and build genuine rapport.
              </p>
            </div>
          </div>

          <div className="bg-surface-container border border-border-subtle rounded-2xl p-7 shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <UserCheck className="w-6 h-6" />
              </div>
              <h2 className="font-headline text-xl font-bold text-primary">
                Instant Video KYC
              </h2>
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                Trust and security are essential. We are harnessing Kalavritti Meet’s low-latency WebRTC streaming infrastructure to power instantaneous, paperless video KYC verification for vendors — authenticating merchant identities rapidly and protecting buyers nationwide.
              </p>
            </div>
          </div>

        </section>

        {/* The Role of Kalavritti Meet Deep Dive */}
        <section className="bg-surface border border-accent/40 rounded-2xl p-8 md:p-12 shadow-md relative overflow-hidden">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-xs font-bold text-primary uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>Technology & Innovation</span>
            </div>

            <h2 className="font-headline text-3xl md:text-4xl font-bold text-primary">
              How Kalavritti Meet Powers Our Future
            </h2>

            <p className="text-sm md:text-base text-on-surface-variant font-medium leading-relaxed max-w-4xl">
              Kalavritti Meet is not merely a meeting tool; it is designed as the core real-time engagement engine across the Kalavritti commerce umbrella. Conceived by founder <strong>Supriyo Sadhukhan</strong>, this WebRTC architecture solves the two biggest challenges in Indian cultural commerce: authenticity verification and merchant onboarding.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="p-6 rounded-xl bg-surface-container border border-border-subtle space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
                    1
                  </div>
                  <h3 className="font-headline text-lg font-bold text-primary">Live Artisan Broadcasts</h3>
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant font-medium leading-relaxed">
                  Artisans from rural clusters can launch high-definition live streams with one click from their mobile or browser, showcasing their workshops, demonstrating authenticity, and answering customer queries in real time.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-surface-container border border-border-subtle space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
                    2
                  </div>
                  <h3 className="font-headline text-lg font-bold text-primary">Face-to-Face Video KYC</h3>
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant font-medium leading-relaxed">
                  Compliance officers and administrators verify seller credentials and inspect sample production over secure, encrypted WebRTC video sessions, reducing onboarding turnaround from days to minutes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Future Goals & Roadmap */}
        <section className="bg-surface-container border border-border-subtle rounded-2xl p-8 md:p-12 shadow-md space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-accent">Continuous Evolution</span>
            <h2 className="font-headline text-3xl font-bold text-primary">Upcoming Milestones</h2>
            <p className="text-sm text-on-surface-variant font-medium">
              We are constantly refining the Kalavritti experience with creator-first features and logistics advancements.
            </p>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="p-5 rounded-xl bg-surface border border-border-subtle flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-primary shrink-0 mt-0.5 font-bold text-xs">
                ✓
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primary">Simplified Vernacular Seller Panels</h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Introducing multilingual interfaces in Hindi, Bengali, Tamil, Telugu, and other regional languages so every craftsperson feels comfortable managing their shop.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface border border-border-subtle flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-primary shrink-0 mt-0.5 font-bold text-xs">
                ✓
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primary">Direct Shefaro Doorstep Dispatch Automation</h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Deep integration with Shefaro (<a href="https://shefaro.in" target="_blank" rel="noopener noreferrer" className="text-primary underline font-bold">shefaro.in</a>) enabling one-click automated pickup generation directly from the seller console.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface border border-border-subtle flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-primary shrink-0 mt-0.5 font-bold text-xs">
                ✓
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primary">Virtual Cultural Art Exhibitions</h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Scheduled streaming galleries where artists and master sculptors present special collections to global art collectors and cultural enthusiasts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="border-t border-border-subtle pt-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-headline text-xl font-bold text-primary">Join the Kalavritti Movement</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
              Explore our background, or jump directly into the live meet broadcast.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/about" 
              className="px-5 py-2.5 rounded-xl bg-surface-container border border-border-subtle text-primary font-bold text-xs hover:bg-surface-container-high transition-colors"
            >
              About Kalavritti
            </Link>
            <Link 
              to="/join" 
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-colors shadow-sm"
            >
              Enter Live Session
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}
