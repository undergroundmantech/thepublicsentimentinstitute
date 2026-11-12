// How the 2028 numbers add up, shown under every 2028 page.
export default function Method() {
  return (
    <section className="card x28-method">
      <div className="card-h"><h3>How the numbers add up</h3><span className="eye">Method</span></div>
      <div className="x28-mcols">
        <p><b>Counties first.</b> The general election engine forecasts every county from its own 2000 to 2024 presidential history, its voter coalitions and issue positions from the On Point national dataset, the nominees&apos; primary consolidation and the projected ad money. A state is the sum of its counties, so the map, the tooltips and the tables always agree.</p>
        <p><b>Simulations.</b> 4,000 runs draw a national error with fat tails, a regional error and each state&apos;s own error; every county moves with its state plus its own three points of noise, which gives the county win chances. The primaries run their own calendar simulation, with candidates dropping out after early states and their voters moving to the most similar rival.</p>
        <p><b>Alaska and Connecticut.</b> Both now have county maps. The model forecasts each statewide, then spreads it over Connecticut&apos;s eight counties by their 2024 lean and a fifth of their 2020 to 2024 swing, and over Alaska&apos;s boroughs by their 2024 presidential and 2026 Senate lean. Their primary counties borrow the county pattern of the most similar counties in nearby states. Margins are two party, Republican minus Democrat.</p>
      </div>
    </section>
  );
}
