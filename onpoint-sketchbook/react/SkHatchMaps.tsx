'use client';
// Pencil maps for the whole site, whatever palette a map was drawn with. Mount once, next to the page content.
// The work happens in js/sk-maps.js: states are redrawn in hatching, counties and small maps in a flat ink wash,
// and the hovered shape gets a ring drawn on top of its neighbors. See that file for the opt outs.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function SkHatchMaps() {
  const path = usePathname();
  useEffect(() => {
    let stop = () => {}, alive = true;
    import('../js/sk-maps.js').then((m) => { if (alive) stop = m.default.start(); });
    return () => { alive = false; stop(); };
  }, []);
  // a new page can reuse a map element at a new size: read everything again once it has painted
  useEffect(() => {
    const t = window.setTimeout(() => import('../js/sk-maps.js').then((m) => m.default.sweep()), 400);
    return () => clearTimeout(t);
  }, [path]);
  return null;
}
