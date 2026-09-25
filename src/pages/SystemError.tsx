import React from 'react';
import { ServerCrash, RefreshCw } from 'lucide-react';
import { LotusLogo } from '../components/LotusLogo';

export default function SystemError() {
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col font-body bg-background text-on-surface relative">
      <main className="flex-grow flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
        
        {/* Subtle repeating background motif */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-5 flex items-center justify-center">
           <LotusLogo className="w-[120vw] h-[120vw] max-w-[1500px] max-h-[1500px] text-error animate-pulse" style={{ animationDuration: '10s' }} />
        </div>

        <div className="relative z-10 w-24 h-24 rounded-3xl bg-error/10 flex items-center justify-center mb-8 border border-error/20 shadow-md">
          <ServerCrash className="w-10 h-10 text-error" />
        </div>
        
        <h1 className="relative z-10 font-headline text-4xl md:text-5xl font-bold text-error mb-6 tracking-tight">System Error</h1>
        <p className="relative z-10 text-lg text-on-surface-variant font-medium max-w-md mx-auto mb-10">
          We encountered an unexpected issue with the signaling server. Please try refreshing the page.
        </p>
        
        <button 
          onClick={() => window.location.reload()}
          className="relative z-10 bg-surface-container text-primary border border-border-subtle py-4 px-8 rounded-xl flex items-center justify-center gap-3 hover:bg-surface-container-high transition-all text-sm font-bold shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Page
        </button>
      </main>
    </div>
  );
}
