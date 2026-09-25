import React from 'react';

export function LotusLogo({ 
  className = "w-8 h-8", 
  style 
}: { 
  className?: string; 
  style?: React.CSSProperties;
}) {
  return (
    <svg 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      style={style}
    >
      <defs>
        {/* Main pointed petal with traditional ornate contour and side flourishes */}
        <g id="kalavritti-petal">
          {/* Outer pointed petal silhouette */}
          <path
            d="M 100 12 
               C 95 25, 87 38, 85 52 
               C 83 62, 87 70, 93 77 
               L 100 82 
               L 107 77 
               C 113 70, 117 62, 115 52 
               C 113 38, 105 25, 100 12 Z"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Inner contour of the pointed petal */}
          <path
            d="M 100 24 
               C 97 34, 91 44, 90 54 
               C 89 60, 93 65, 100 70 
               C 107 65, 111 60, 110 54 
               C 109 44, 103 34, 100 24 Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Center rib/spine */}
          <line x1="100" y1="28" x2="100" y2="48" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />

          {/* Wing flourishes flanking petal base */}
          <path
            d="M 85 52 C 78 48, 74 57, 81 63 C 86 67, 91 71, 93 77"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 115 52 C 122 48, 126 57, 119 63 C 114 67, 109 71, 107 77"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Inner teardrop petal */}
          <path
            d="M 100 54 
               C 92 61, 90 73, 94 82 
               L 100 86 
               L 106 82 
               C 110 73, 108 61, 100 54 Z"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M 100 62 
               C 96 66, 95 73, 98 78 
               L 100 80 
               L 102 78 
               C 105 73, 104 66, 100 62 Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>

        {/* Intermediate pointed spur between petals */}
        <g id="kalavritti-spur">
          <path
            d="M 100 32 
               C 95 42, 92 52, 95 62 
               L 100 66 
               L 105 62 
               C 108 52, 105 42, 100 32 Z"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="100" cy="46" r="2.8" fill="currentColor" />
        </g>
      </defs>

      {/* 8 Intermediate Spurs rotated by 22.5 deg */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <use 
          key={`spur-${angle}`} 
          href="#kalavritti-spur" 
          transform={`rotate(${angle + 22.5} 100 100)`} 
        />
      ))}

      {/* 8 Primary Ornate Petals */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <use 
          key={`petal-${angle}`} 
          href="#kalavritti-petal" 
          transform={`rotate(${angle} 100 100)`} 
        />
      ))}

      {/* Center Floral Core */}
      <circle cx="100" cy="100" r="16" stroke="currentColor" strokeWidth="2.8" fill="none" />
      <circle cx="100" cy="100" r="10" stroke="currentColor" strokeWidth="2.2" fill="none" />
      <circle cx="100" cy="100" r="5" fill="currentColor" />
    </svg>
  );
}
