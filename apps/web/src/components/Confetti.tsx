import { useMemo, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';

const COLORS = ['#f2c14e', '#e0475f', '#3ddc97', '#5aa9ff', '#f8dc95', '#ffffff'];

/**
 * Lightweight CSS confetti: a fixed number of absolutely positioned pieces animated with
 * transforms only (GPU friendly). Renders nothing when the user prefers reduced motion.
 */
export function Confetti({ count = 70 }: { count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.6 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 240,
        spin: (Math.random() - 0.5) * 1440,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 8,
        h: 10 + Math.random() * 10,
      })),
    [count],
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
      <style>{`@keyframes op-confetti{0%{transform:translate3d(0,-10vh,0) rotate(0)}100%{transform:translate3d(var(--drift),110vh,0) rotate(var(--spin))}}`}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={
            {
              position: 'absolute',
              top: 0,
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: 2,
              animation: `op-confetti ${p.duration}s cubic-bezier(.2,.6,.4,1) ${p.delay}s forwards`,
              transform: 'translate3d(0,-10vh,0)',
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
