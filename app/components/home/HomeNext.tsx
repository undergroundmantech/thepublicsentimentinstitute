// The top of the home page now the midterms are counted: the 2028 forecast, the game built on it, and the 2027
// governor races. Server rendered from the same files as the 2028 and 2027 pages.
import Link from "@/app/components/Link";
import Toon from "@/app/majority-tracker/Toon";
import { featured, nomination } from "@/app/2028/data28";
import { STATES, last as last27, mg, pc, stateModel } from "@/app/2027/data27";
import Mascot from "./Mascot";
import "./homenext.css";

const last = (n: string) => n.split(" ").slice(-1)[0];
const pct = (p: number) => (p >= 0.995 ? ">99%" : p <= 0.005 ? "<1%" : `${Math.round(p * 100)}%`);

export default function HomeNext() {
  const p = featured(1)[0];
  const nom = nomination();
  const evR = 538 - p.evMap;
  const g27 = STATES.map((s) => stateModel(s.code));
  return (
    <section className="hn" aria-label="2028 and 2027">
      <Link href="/2028" className="hn-card hn-28" data-ev="Home next" data-ev-d='{"card":"2028"}'>
        <span className="hn-eye"><i />The 2028 forecast</span>
        <div className="hn-duel">
          <div className="d"><Toon name={p.d} side="D" size={86} uid="hn-d" /><b>{last(p.d)}</b><strong>{p.evMap}</strong></div>
          <div className="mid"><em>{pct(p.pD)}</em><span>{last(p.d)} wins the White House in 20,000 runs</span></div>
          <div className="r"><Toon name={p.r} side="R" size={86} uid="hn-r" /><b>{last(p.r)}</b><strong>{evR}</strong></div>
        </div>
        <div className="hn-bar" aria-hidden="true"><i style={{ width: `${(p.evMap / 538) * 100}%` }} /><s style={{ left: "50.2%" }} /></div>
        <p className="hn-sub">Primaries: {nom.D[0].name} leads the Democrats at {pct(nom.D[0].p)}, {nom.R[0].name} the Republicans at {pct(nom.R[0].p)}.</p>
        <span className="hn-go">Open the 2028 forecast</span>
      </Link>
      <Link href="/play" className="hn-card hn-play" data-ev="Home next" data-ev-d='{"card":"play"}'>
        <span className="hn-eye"><i />Campaign 2028 · free game</span>
        <h2>Run for president.</h2>
        <p>Pick from 54 candidates, win the primaries, choose a running mate and fight county by county to 270, on the forecast&apos;s own numbers.</p>
        <div className="hn-pty" aria-hidden="true"><Mascot size={150} pose="cheer" prop="flag" look={-1} /></div>
        <span className="hn-go">Play now</span>
      </Link>
      <Link href="/2027" className="hn-card hn-27" data-ev="Home next" data-ev-d='{"card":"2027"}'>
        <span className="hn-eye"><i />New · the 2027 governors</span>
        <ul>
          {g27.map((S) => (
            <li key={S.code}>
              <b>{S.name}</b>
              <span className="hn-odds"><em className="r">R {pc(S.pR)}</em><em className="d">D {pc(1 - S.pR)}</em></span>
              {S.pairs[0] ? <small>{last27(S.pairs[0].r)} v {last27(S.pairs[0].d)}, {mg(S.pairs[0].margin)}</small> : null}
            </li>
          ))}
        </ul>
        <span className="hn-go">Every matchup and county</span>
      </Link>
    </section>
  );
}
