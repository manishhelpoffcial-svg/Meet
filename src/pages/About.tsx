import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingBag, 
  Store, 
  Truck, 
  ShieldCheck, 
  Headphones, 
  ExternalLink, 
  Sparkles, 
  UserCheck, 
  Video, 
  Layers,
  Award
} from 'lucide-react';
import { LotusLogo } from '../components/LotusLogo';

export default function About() {
  return (
    <div className="min-h-[calc(100vh-73px)] font-body bg-background text-on-surface">
      {/* Hero Header Section */}
      <section className="relative overflow-hidden border-b border-border-subtle bg-surface-container/60 py-16 md:py-24 px-6">
        <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center overflow-hidden">
          <LotusLogo className="w-[100vw] h-[100vw] max-w-[1200px] max-h-[1200px] text-accent" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-accent/40 text-xs font-bold text-primary uppercase tracking-widest shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Discover Kalavritti</span>
          </div>

          <div className="space-y-2">
            <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-bold text-primary tracking-tight">
              About Kalavritti
            </h1>
            <p className="font-hindi text-xl sm:text-2xl font-bold text-accent tracking-wider">
              कलावृत्ति — संस्कृति एवं ई-कॉमर्स का संगम
            </p>
          </div>

          <p className="text-base sm:text-lg text-on-surface-variant font-medium leading-relaxed max-w-3xl mx-auto">
            Kalavritti is an innovative multi-vendor marketplace dedicated to celebrating Indian cultural heritage, artisanal craft, and trusted e-commerce. We empower creators and merchants across every corner of India to reach nationwide patrons with ease, authenticity, and unmatched logistical support.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 py-16 space-y-16">
        
        {/* Core Pillars: Buyers & Sellers */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* For Buyers */}
          <div className="bg-surface-container border border-border-subtle rounded-2xl p-8 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-primary"></div>
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="font-headline text-2xl font-bold text-primary">For Our Buyers</h2>
                <p className="text-sm font-semibold text-accent uppercase tracking-wider">Authentic Cultural Artifacts & Curated E-Commerce</p>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
                Whether you seek handcrafted treasures, indigenous art forms, festive essentials, traditional handlooms, or daily lifestyle products, Kalavritti provides an intuitive shopping journey.
              </p>
              <ul className="space-y-3 text-sm text-on-surface font-medium pt-2">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-primary shrink-0 mt-0.5">✓</div>
                  <span><strong>Rich Cultural Variety:</strong> Direct access to verified regional artisans, traditional sculptors, weavers, and heritage crafters.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-primary shrink-0 mt-0.5">✓</div>
                  <span><strong>Warm, User-Friendly Interface:</strong> Clean aesthetics inspired by Indian artistic traditions, making exploration enjoyable.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-primary shrink-0 mt-0.5">✓</div>
                  <span><strong>Responsive Support & Guidance:</strong> Transparent ordering, friendly customer assistance, and prompt order resolution.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* For Sellers */}
          <div className="bg-surface-container border border-border-subtle rounded-2xl p-8 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="font-headline text-2xl font-bold text-primary">For Our Sellers</h2>
                <p className="text-sm font-semibold text-accent uppercase tracking-wider">Pan-India Selling With Simple KYC Verification</p>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
                Selling cultural goods and commercial merchandise online shouldn't require complex bureaucracy. At Kalavritti, any vendor or artisan can launch their storefront in minutes.
              </p>
              <ul className="space-y-3 text-sm text-on-surface font-medium pt-2">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">✓</div>
                  <span><strong>Effortless KYC Onboarding:</strong> Complete quick, paperless KYC verification and start listing inventory immediately.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">✓</div>
                  <span><strong>Intuitive Seller Dashboard:</strong> Simple controls to track orders, manage stock, analyze earnings, and print dispatch slips.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">✓</div>
                  <span><strong>24/7 Seller Support:</strong> Dedicated partner guidance and merchant care around the clock to support your growth.</span>
                </li>
              </ul>
            </div>
          </div>

        </section>

        {/* Logistics Partnership with Shefaro */}
        <section className="bg-surface border border-accent/40 rounded-2xl p-8 md:p-12 shadow-md relative overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-8 items-center justify-between">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-accent/15 border border-accent/30 text-xs font-bold text-primary uppercase tracking-wider">
                <Truck className="w-4 h-4 text-accent" />
                <span>Seamless Pan-India Logistics</span>
              </div>
              <h2 className="font-headline text-3xl font-bold text-primary">
                Integrated with Shefaro Shipping
              </h2>
              <p className="text-sm md:text-base text-on-surface-variant font-medium leading-relaxed">
                To guarantee dependable, insured, and timely door-to-door delivery across India, Kalavritti is deeply merged with <strong>Shefaro</strong>. With automated dispatch routing, automated tracking, and transparent courier aggregation, both sellers and buyers enjoy worry-free fulfillment from Kashmir to Kanyakumari.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full lg:w-auto">
              <a 
                href="https://shefaro.in" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container transition-colors text-sm font-bold flex items-center justify-center gap-2 shadow-md"
              >
                <span>Visit Shefaro.in</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Leadership & Founder Section */}
        <section className="bg-surface-container border border-border-subtle rounded-2xl p-8 md:p-12 shadow-md">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-accent mx-auto flex items-center justify-center shadow-inner">
              <Award className="w-8 h-8 text-primary" />
            </div>
            
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-accent">Founder & Visionary</span>
              <h2 className="font-headline text-3xl font-bold text-primary">Supriyo Sadhukhan</h2>
              <p className="text-sm text-on-surface-variant font-medium">
                Owner & Founder of Kalavritti, Shefaro Logistics, and Kalavritti Meet
              </p>
            </div>

            <p className="text-sm md:text-base text-on-surface font-medium leading-relaxed italic text-on-surface-variant">
              "India's rich cultural artisans and dedicated local entrepreneurs possess incredible talent, but they often lack simple tools, streamlined logistics, and personal broadcasting platforms to connect with buyers. Kalavritti brings these vital pillars together under one roof — pairing easy selling and seamless Shefaro shipping with real-time video verification and broadcasts on Kalavritti Meet."
            </p>
          </div>
        </section>

        {/* Kalavritti Meet Connection */}
        <section className="border-t border-border-subtle pt-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-headline text-xl font-bold text-primary">Explore Kalavritti Meet</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
              Experience real-time low-latency video broadcasts, video KYC verification, and live cultural interactions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/vision" 
              className="px-5 py-2.5 rounded-xl bg-surface-container border border-border-subtle text-primary font-bold text-xs hover:bg-surface-container-high transition-colors"
            >
              Our Vision
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
