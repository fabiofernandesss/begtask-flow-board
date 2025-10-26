import { useEffect, useRef } from 'react';

const TechBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class FloatingCard {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 60 + 40;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        this.opacity = Math.random() * 0.3 + 0.1;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;

        if (this.x < -this.size) this.x = canvas.width + this.size;
        if (this.x > canvas.width + this.size) this.x = -this.size;
        if (this.y < -this.size) this.y = canvas.height + this.size;
        if (this.y > canvas.height + this.size) this.y = -this.size;
      }

      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw card with gradient
        const gradient = ctx.createLinearGradient(-this.size/2, -this.size/2, this.size/2, this.size/2);
        gradient.addColorStop(0, `hsla(243, 75%, 59%, ${this.opacity})`);
        gradient.addColorStop(1, `hsla(250, 75%, 65%, ${this.opacity})`);
        
        ctx.fillStyle = gradient;
        ctx.strokeStyle = `hsla(243, 75%, 80%, ${this.opacity * 0.5})`;
        ctx.lineWidth = 2;
        
        // Rounded rectangle
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(-this.size/2 + radius, -this.size/2);
        ctx.lineTo(this.size/2 - radius, -this.size/2);
        ctx.quadraticCurveTo(this.size/2, -this.size/2, this.size/2, -this.size/2 + radius);
        ctx.lineTo(this.size/2, this.size/2 - radius);
        ctx.quadraticCurveTo(this.size/2, this.size/2, this.size/2 - radius, this.size/2);
        ctx.lineTo(-this.size/2 + radius, this.size/2);
        ctx.quadraticCurveTo(-this.size/2, this.size/2, -this.size/2, this.size/2 - radius);
        ctx.lineTo(-this.size/2, -this.size/2 + radius);
        ctx.quadraticCurveTo(-this.size/2, -this.size/2, -this.size/2 + radius, -this.size/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    }

    const cards: FloatingCard[] = [];
    const cardCount = 15;

    for (let i = 0; i < cardCount; i++) {
      cards.push(new FloatingCard());
    }

    const animate = () => {
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      cards.forEach(card => {
        card.update();
        card.draw();
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
};

export default TechBackground;
