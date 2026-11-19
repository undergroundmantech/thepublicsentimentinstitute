// Wrap anything to animate it in on scroll: <Reveal fx="slam">...</Reveal>
// fx: slam | flip | whip | mask | pop | fade. Delay in ms staggers groups.
export default function Reveal({ fx = 'pop', delay = 0, children, className = '' }:
  { fx?: 'slam' | 'flip' | 'whip' | 'mask' | 'pop' | 'fade'; delay?: number; children: React.ReactNode; className?: string }) {
  return <div data-sk-reveal={fx} data-sk-delay={delay} className={className}>{children}</div>;
}
