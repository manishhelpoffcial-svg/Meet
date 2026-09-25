import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ExternalLink, Truck } from 'lucide-react';
import { LotusLogo } from './LotusLogo';

export default function TopNav() {
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/join' },
    { name: 'About', path: '/about' },
    { name: 'Vision', path: '/vision' },
  ];

  const isActive = (path: string) => {
    if (path === '/join') {
      return location.pathname === '/join' || location.pathname === '/';
    }
    return location.pathname === path;
  };

  return (
    <nav className="w-full bg-surface shadow-sm border-b border-border-subtle px-6 py-4 flex items-center justify-between z-50 sticky top-0 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
      
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2 relative z-10">
        <Link to="/join" className="flex items-center gap-3.5 group">
          <LotusLogo className="w-10 h-10 sm:w-11 sm:h-11 text-accent transition-transform group-hover:scale-105 duration-300 shrink-0" />
          <div className="flex flex-col justify-center">
            <span className="font-headline text-2xl sm:text-2xl font-bold tracking-tight text-primary leading-none">
              Kalavritti
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-hindi text-[11px] sm:text-xs font-bold text-primary tracking-wider leading-none">
                कलावृत्ति
              </span>
              <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-border-subtle leading-none">
                Meet
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation Links - Permanently visible on all screen sizes */}
      <div className="flex items-center gap-3 sm:gap-7 relative z-10">
        {navLinks.map((link) => (
          <Link 
            key={link.path}
            to={link.path} 
            className={`text-xs sm:text-sm font-bold tracking-wide transition-all hover:text-primary ${
              isActive(link.path) 
                ? 'text-primary border-b-2 border-primary pb-0.5 sm:pb-1' 
                : 'text-on-surface-variant hover:border-b-2 hover:border-accent/40 pb-0.5 sm:pb-1'
            }`}
          >
            {link.name}
          </Link>
        ))}
      </div>

      {/* Right Controls: Shefaro Partner Link */}
      <div className="flex items-center gap-2 sm:gap-3 relative z-10">
        <a 
          href="https://shefaro.in" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-accent/40 bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-primary transition-all shadow-sm"
          title="Shipping Partner: Shefaro.in"
        >
          <Truck className="w-3.5 h-3.5 text-accent" />
          <span>Shefaro.in</span>
          <ExternalLink className="w-3 h-3 text-on-surface-variant opacity-70 ml-0.5" />
        </a>
      </div>
    </nav>
  );
}
