import React, { useEffect, useState } from 'react';
import { Workflow } from 'lucide-react';

interface WelcomeSplashProps {
  onComplete: () => void;
}

export function WelcomeSplash({ onComplete }: WelcomeSplashProps) {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // Start fade out after 2 seconds
    const timer = setTimeout(() => {
      setIsAnimating(false);
      // Complete transition after animation ends
      setTimeout(onComplete, 1000);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-black flex items-center justify-center transition-opacity duration-1000 z-50 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="text-center">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="logo-icon scale-150">
              <Workflow className="h-12 w-12" />
            </div>
            <div className="absolute inset-0 animate-ping-slow">
              <div className="logo-icon opacity-50 scale-150">
                <Workflow className="h-12 w-12" />
              </div>
            </div>
          </div>
        </div>
        <h1 className="text-4xl font-bold text-white mb-4 animate-fade-in">
          Welcome to MSME Flow
        </h1>
        <p className="text-sky-500 text-xl animate-fade-in-delay">
          Empowering Business Growth
        </p>
      </div>
    </div>
  );
} 