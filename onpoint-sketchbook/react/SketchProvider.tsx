'use client';
// Mount once in app/layout.tsx:  <SketchProvider tone="default">{children}</SketchProvider>
// Adds the SVG filters, paper texture, grain, scanlines and the static flash on every route change.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

type Tone = 'default' | 'pro';
export default function SketchProvider({ children, tone = 'default', overlays = true }: { children: React.ReactNode; tone?: Tone; overlays?: boolean }) {
  const path = usePathname();
  useEffect(() => {
    document.documentElement.setAttribute('data-sk', '');
    if (tone === 'pro') document.documentElement.setAttribute('data-sk-tone', 'pro'); else document.documentElement.removeAttribute('data-sk-tone');
    import('../js/sketchbook.js').then(m => m.default.init({ base: '/sketchbook', overlays, paper: overlays }));
  }, [tone, overlays]);
  useEffect(() => {
    // no static flash between pages: it read as a frozen screen. Only the scroll reveals run.
    import('../js/sketchbook.js').then(m => { if (overlays) m.default.flash(180); m.default.reveal(); });
  }, [path, overlays]);
  return <>{children}</>;
}
