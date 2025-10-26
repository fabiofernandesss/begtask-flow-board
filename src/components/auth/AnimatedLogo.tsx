import { useEffect, useRef } from 'react';

const AnimatedLogo = () => {
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const logo = logoRef.current;
    if (!logo) return;

    const animateShine = () => {
      logo.style.setProperty('--shine-position', '0%');
      setTimeout(() => {
        logo.style.setProperty('--shine-position', '200%');
      }, 100);
    };

    animateShine();
    const interval = setInterval(animateShine, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mb-8">
      <style>{`
        @keyframes shine {
          from {
            left: var(--shine-position, -100%);
          }
          to {
            left: var(--shine-position, 200%);
          }
        }
        
        .logo-shine {
          position: relative;
          overflow: hidden;
        }
        
        .logo-shine::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            hsla(0, 0%, 100%, 0.6),
            transparent
          );
          animation: shine 1.5s ease-in-out;
          animation-fill-mode: forwards;
        }
      `}</style>
      <div
        ref={logoRef}
        className="logo-shine text-5xl font-bold text-primary inline-block"
        style={{
          background: 'linear-gradient(135deg, hsl(243 75% 59%) 0%, hsl(250 75% 65%) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}
      >
        BegTask
      </div>
    </div>
  );
};

export default AnimatedLogo;
