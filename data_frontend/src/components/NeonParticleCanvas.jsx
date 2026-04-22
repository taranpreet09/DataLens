import { useEffect, useRef } from 'react';

const PRIMARY = { r: 148, g: 170, b: 255 }; // blue
const ACCENT  = { r: 92,  g: 253, b: 128 }; // green
const DIM     = { r: 80,  g: 90,  b: 140 }; // dim blue

export default function NeonParticleCanvas({ 
  particleCount = 45, 
  className = '', 
  interactive = false,  // mouse tracking
  gridEnabled = true,
  barsEnabled = true,
  alwaysActive = true, // ignores hover state, acts as if hovered
}) {
  const canvasRef = useRef(null);
  const isHoveredRef = useRef(false);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      // If we are dealing with a fixed full-screen element, we use innerWidth
      const isFixed = window.getComputedStyle(canvas.parentElement).position === 'fixed';
      const width = isFixed ? window.innerWidth : canvas.parentElement.clientWidth;
      const height = isFixed ? window.innerHeight : canvas.parentElement.clientHeight;
      
      dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    // Mouse tracking for interactive mode
    const handleMouseMove = (e) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - rect.left) / rect.width;
      mouseRef.current.y = (e.clientY - rect.top) / rect.height;
    };
    const handleMouseLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseleave', handleMouseLeave);
    }

    const nodes = Array.from({ length: particleCount }, (_, i) => {
      const isHub = i < Math.max(6, Math.floor(particleCount * 0.15));
      return {
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * (isHub ? 0.0003 : 0.0008),
        vy: (Math.random() - 0.5) * (isHub ? 0.0003 : 0.0008),
        radius: isHub ? 3.5 : (Math.random() * 1.8 + 0.8),
        isHub,
        phase: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.015,
        glowAmount: 0,
      };
    });

    const pulses = [];
    const spawnPulse = (from, to) => {
      if (pulses.length < 20) {
        pulses.push({ from, to, t: 0, speed: 0.006 + Math.random() * 0.01 });
      }
    };

    const GRID_SPACING = 40;
    const CONNECTION_DIST = 0.15;
    const MOUSE_RADIUS = 0.12;
    let frame = 0;

    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const hovered = alwaysActive || isHoveredRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseActive = interactive && mx > -1 && mx < 2;

      // ── Grid ──
      if (gridEnabled) {
        const gridAlpha = hovered ? 0.08 : 0.035;
        ctx.strokeStyle = `rgba(${PRIMARY.r}, ${PRIMARY.g}, ${PRIMARY.b}, ${gridAlpha})`;
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += GRID_SPACING) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += GRID_SPACING) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
      }

      // ── Update & draw nodes ──
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.phase += n.speed;

        // Mouse interaction: gentle attraction for nearby, repulsion for very close
        if (mouseActive) {
          const dx = n.x - mx;
          const dy = n.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS && dist > 0.001) {
            if (dist < 0.04) {
              const force = (0.04 - dist) / 0.04 * 0.0004;
              n.vx += dx / dist * force;
              n.vy += dy / dist * force;
            } else {
              const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.00008;
              n.vx -= dx / dist * force;
              n.vy -= dy / dist * force;
            }
          }
        }

        // Dampen velocity
        n.vx *= 0.998;
        n.vy *= 0.998;

        // Bounce
        if (n.x < 0.01 || n.x > 0.99) n.vx *= -1;
        if (n.y < 0.01 || n.y > 0.99) n.vy *= -1;
        n.x = Math.max(0.01, Math.min(0.99, n.x));
        n.y = Math.max(0.01, Math.min(0.99, n.y));

        // Glow
        const targetGlow = hovered ? 1 : 0;
        n.glowAmount += (targetGlow - n.glowAmount) * 0.04;

        const px = n.x * w;
        const py = n.y * h;
        const pulse = Math.sin(n.phase) * 0.3;
        const r = n.radius + pulse;

        // Mouse proximity glow
        let mouseGlow = 0;
        if (mouseActive) {
          const dx = n.x - mx;
          const dy = n.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS) {
            mouseGlow = (1 - dist / MOUSE_RADIUS);
          }
        }

        const totalGlow = alwaysActive ? 0.3 + mouseGlow : Math.min(1, n.glowAmount + mouseGlow);

        // Hub glow halo
        if (totalGlow > 0.01 && n.isHub) {
          const glowR = r * (6 + totalGlow * 8);
          const grad = ctx.createRadialGradient(px, py, 0, px, py, glowR);
          grad.addColorStop(0, `rgba(${PRIMARY.r}, ${PRIMARY.g}, ${PRIMARY.b}, ${0.25 * totalGlow})`);
          grad.addColorStop(1, `rgba(${PRIMARY.r}, ${PRIMARY.g}, ${PRIMARY.b}, 0)`);
          ctx.beginPath();
          ctx.arc(px, py, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Node rendering
        if (n.isHub) {
          ctx.beginPath();
          ctx.arc(px, py, r + 1, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${PRIMARY.r}, ${PRIMARY.g}, ${PRIMARY.b}, ${0.5 + totalGlow * 0.4})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${PRIMARY.r}, ${PRIMARY.g}, ${PRIMARY.b}, ${0.7 + totalGlow * 0.3})`;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          const alpha = 0.25 + pulse * 0.1 + totalGlow * 0.35;
          ctx.fillStyle = `rgba(${DIM.r}, ${DIM.g}, ${DIM.b}, ${alpha})`;
          ctx.fill();
        }
      }

      // ── Node-to-node connections ──
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * (hovered ? 0.16 : 0.06);
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(nodes[i].x * w, nodes[i].y * h);
            ctx.lineTo(nodes[j].x * w, nodes[j].y * h);
            ctx.strokeStyle = `rgba(${PRIMARY.r}, ${PRIMARY.g}, ${PRIMARY.b}, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
            ctx.setLineDash([]);

            if (frame % 90 === 0 && Math.random() < 0.04) {
              spawnPulse(nodes[i], nodes[j]);
            }
          }
        }
      }

      // ── Mouse-to-node connections ──
      if (mouseActive) {
        for (const n of nodes) {
          const dx = n.x - mx;
          const dy = n.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS) {
            const alpha = (1 - dist / MOUSE_RADIUS) * 0.25;
            ctx.beginPath();
            ctx.moveTo(n.x * w, n.y * h);
            ctx.lineTo(mx * w, my * h);
            ctx.strokeStyle = `rgba(${ACCENT.r}, ${ACCENT.g}, ${ACCENT.b}, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // Mouse cursor dot
        ctx.beginPath();
        ctx.arc(mx * w, my * h, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${ACCENT.r}, ${ACCENT.g}, ${ACCENT.b}, 0.4)`;
        ctx.fill();
        const cursorGrad = ctx.createRadialGradient(mx * w, my * h, 0, mx * w, my * h, 30);
        cursorGrad.addColorStop(0, `rgba(${ACCENT.r}, ${ACCENT.g}, ${ACCENT.b}, 0.1)`);
        cursorGrad.addColorStop(1, `rgba(${ACCENT.r}, ${ACCENT.g}, ${ACCENT.b}, 0)`);
        ctx.beginPath();
        ctx.arc(mx * w, my * h, 30, 0, Math.PI * 2);
        ctx.fillStyle = cursorGrad;
        ctx.fill();
      }

      // ── Data pulses ──
      for (let p = pulses.length - 1; p >= 0; p--) {
        const pulse = pulses[p];
        pulse.t += pulse.speed;
        if (pulse.t > 1) { pulses.splice(p, 1); continue; }

        const px = (pulse.from.x + (pulse.to.x - pulse.from.x) * pulse.t) * w;
        const py = (pulse.from.y + (pulse.to.y - pulse.from.y) * pulse.t) * h;
        const pulseAlpha = Math.sin(pulse.t * Math.PI) * 0.6;

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${ACCENT.r}, ${ACCENT.g}, ${ACCENT.b}, ${pulseAlpha})`;
        ctx.fill();
      }

      // ── Mini bar chart ──
      if (barsEnabled) {
        const barCount = 6;
        const barW = 4;
        const barGap = 3;
        const barAreaX = w - (barCount * (barW + barGap)) - 20;
        const barBaseY = h - 20;
        for (let b = 0; b < barCount; b++) {
          const barH = 10 + Math.sin(frame * 0.02 + b * 0.8) * 8;
          const bx = barAreaX + b * (barW + barGap);
          const alpha = hovered ? 0.35 : 0.12;
          ctx.fillStyle = `rgba(${PRIMARY.r}, ${PRIMARY.g}, ${PRIMARY.b}, ${alpha})`;
          ctx.fillRect(bx, barBaseY - barH, barW, barH);
        }
      }

      frame++;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      if (resizeObserver && canvas.parentElement) resizeObserver.disconnect();
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [particleCount, interactive, gridEnabled, barsEnabled, alwaysActive]);

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
