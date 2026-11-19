'use client';
// <Pointy pose="idle" />  <Pointy pose="idle" run />  <Pointy pose="wave-hello" wave />
// Poses shipped in /public/sketchbook/pointy: idle, think, point-pointer, sit-ballot, wave-hello
import { useEffect, useRef } from 'react';

export default function Pointy({ pose = 'idle', run = false, wave = false, size = 220, className = '' }:
  { pose?: 'idle' | 'think' | 'point-pointer' | 'sit-ballot' | 'wave-hello'; run?: boolean; wave?: boolean; size?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    import('../js/sketchbook.js').then(m => { if (alive && ref.current) { m.default.init({ base: '/sketchbook' }); m.default.pointy(ref.current, { pose, run, wave }); } });
    return () => { alive = false; };
  }, [pose, run, wave]);
  return <div ref={ref} className={className} style={{ width: size, aspectRatio: '380 / 480' }} role="img" aria-label="Pointy, the On Point mascot" />;
}
