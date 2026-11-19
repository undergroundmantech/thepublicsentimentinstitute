'use client';
// The thick 3D On Point logo coin that slowly rocks. <CoinLogo size={160} />
import { useEffect, useRef } from 'react';
export default function CoinLogo({ size = 160 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { import('../js/sketchbook.js').then(m => { if (ref.current) { m.default.init({ base: '/sketchbook' }); m.default.coin(ref.current); } }); }, []);
  return <div ref={ref} style={{ width: size, height: size }} role="img" aria-label="On Point" />;
}
