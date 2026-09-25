import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Tv, Radio, Info, X, ShieldCheck } from 'lucide-react';
import { LotusLogo } from '../components/LotusLogo';

export default function Join() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/announcements/active')
      .then(res => res.json())
      .then(data => {
        if (data.announcement) {
          setAnnouncement(data.announcement.text);
        }
      })
      .catch(console.error);
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      navigate('/user?room=main');
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col font-body bg-background text-on-surface relative">
      {announcement && !isDismissed && (
        <div className="bg-accent text-on-primary py-3 px-6 shadow-md border-b border-accent/80 flex items-center justify-between z-50">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-semibold">{announcement}</p>
          </div>
          <button 
            onClick={() => setIsDismissed(true)} 
            className="text-on-primary/80 hover:text-on-primary transition-colors p-1"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
        
        {/* Subtle repeating background motif */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-5 flex items-center justify-center">
           <LotusLogo className="w-[120vw] h-[120vw] max-w-[1500px] max-h-[1500px] text-accent animate-pulse" style={{ animationDuration: '10s' }} />
        </div>
        
        <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-24 items-center">
          
          <div className="flex-1 text-center lg:text-left space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container border border-border-subtle shadow-sm text-xs font-semibold text-primary mb-6">
                <Radio className="w-4 h-4 text-accent" />
                <span className="uppercase tracking-widest">Kalavritti Meet</span>
              </div>
              <h1 className="font-headline text-5xl md:text-7xl font-bold text-primary tracking-tight mb-4 leading-[1.1]">
                Simple. <br/>Real-time. <br/>Connected.
              </h1>
              <p className="text-lg text-on-surface-variant font-medium max-w-md mx-auto lg:mx-0">
                Experience high-fidelity, low-latency broadcasting designed for professional cultural real-time communication.
              </p>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md">
            <div className="bg-surface-container border border-border-subtle p-8 md:p-10 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-primary to-accent"></div>
              
              <div className="mb-8">
                <h2 className="font-headline text-3xl font-bold text-primary mb-2">Join Session</h2>
                <p className="text-sm text-on-surface-variant font-medium">Enter your details to connect to the main room as a viewer.</p>
              </div>
              
              <form onSubmit={handleJoin} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="participant-name" className="block text-xs font-bold text-primary uppercase tracking-widest">
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="participant-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-surface border border-border-subtle focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-xl px-4 py-3.5 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none transition-all shadow-inner font-medium"
                  />
                </div>
                
                <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-container transition-colors font-bold shadow-md shadow-primary/20">
                  <Tv className="w-5 h-5" />
                  Enter Viewer Mode
                </button>
              </form>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
