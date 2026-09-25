import React from 'react';
import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import { LotusLogo } from '../components/LotusLogo';

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col font-body bg-background text-on-surface relative">
      <main className="flex-grow flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
        
        {/* Subtle repeating background motif */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-5 flex items-center justify-center">
           <LotusLogo className="w-[120vw] h-[120vw] max-w-[1500px] max-h-[1500px] text-accent animate-pulse" style={{ animationDuration: '10s' }} />
        </div>

        <div className="relative z-10 w-24 h-24 rounded-3xl bg-surface-container flex items-center justify-center mb-8 border border-border-subtle shadow-md">
          <MapPinOff className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="relative z-10 font-headline text-5xl md:text-6xl font-bold text-primary mb-6 tracking-tight">404 Not Found</h1>
        <p className="relative z-10 text-lg text-on-surface-variant font-medium max-w-md mx-auto mb-10">
          The broadcast or room you are looking for does not exist or has ended.
        </p>
        
        <Link 
          to="/join"
          className="relative z-10 bg-primary text-on-primary py-4 px-8 rounded-xl flex items-center justify-center gap-3 hover:bg-primary-container transition-all text-sm font-bold shadow-md shadow-primary/20"
        >
          Return to Home
        </Link>
      </main>
    </div>
  );
}
