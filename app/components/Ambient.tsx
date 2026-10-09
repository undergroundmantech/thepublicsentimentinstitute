// Ambient orbs and dot grain behind every page. The only continuous motion besides the ticker and live dot.
export default function Ambient() {
  return (
    <div className="opp ambient" aria-hidden="true">
      <div className="orbs"><div className="orb a" /><div className="orb b" /><div className="orb c" /></div>
      <div className="grain" />
    </div>
  );
}
