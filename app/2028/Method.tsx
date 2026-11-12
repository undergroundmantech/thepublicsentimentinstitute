// How the 2028 numbers add up, shown under every 2028 page.
export default function Method() {
  return (
    <section className="card x28-method">
      <div className="card-h"><h3>How the numbers add up</h3><span className="eye">Method</span></div>
      <div className="x28-mcols">
        <p><b>The forecast&apos;s own numbers.</b> Everything here comes from the On Point 2028 Forecast. The general election shows its win chance, electoral votes, national margin and state results for every pairing, carried to each county the way the forecast&apos;s county map does it: every county moves by its state&apos;s change from the generic Democrat against Vance. A state is the sum of its counties, so the map, the tooltips and the tables always agree.</p>
        <p><b>Simulations.</b> General election odds come from the forecast&apos;s 20,000 simulations, with a national error with fat tails, a regional error and each state&apos;s own error. Pick a ticket runs the forecast&apos;s ticket engine in your browser: every county, then 4,000 simulations. The primaries are the forecast&apos;s calendar simulation, 2,000 runs, with candidates dropping out after early states and their voters moving to the most similar rival; each state&apos;s counties are fitted to add up exactly to its result.</p>
        <p><b>Alaska and Connecticut.</b> Both now have county maps. The model forecasts each statewide, then spreads it over Connecticut&apos;s eight counties by their 2024 lean and a fifth of their 2020 to 2024 swing, and over Alaska&apos;s boroughs by their 2024 presidential and 2026 Senate lean. Their primary counties borrow the county pattern of the most similar counties in nearby states. Margins are two party, Republican minus Democrat.</p>
      </div>
    </section>
  );
}
