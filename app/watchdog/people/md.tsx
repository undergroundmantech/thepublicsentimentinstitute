// A small Markdown reader for the Watchdog people files: headings, paragraphs, bold, lists, tables and bare links.
// The files come from the On Point Watchdog Database and follow its research protocol, so this covers what they use.
import React from "react";

const URL_RE = /(https?:\/\/[^\s)]+[^\s).,;:])/g;

function inline(s: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) { out.push(<b key={`${key}b${i}`}>{linkify(p.slice(2, -2), `${key}b${i}`)}</b>); return; }
    out.push(...linkify(p, `${key}t${i}`));
  });
  return out;
}
function linkify(s: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = []; let last = 0, m: RegExpExecArray | null; let i = 0;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const u = m[1]; let host = u; try { host = new URL(u).hostname.replace(/^www\./, ""); } catch { /* keep the raw text */ }
    out.push(<a key={`${key}u${i++}`} href={u} target="_blank" rel="noopener noreferrer" className="pf-src">{host}</a>);
    last = m.index + u.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export default function Md({ text, skipTitle = true }: { text: string; skipTitle?: boolean }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^# /.test(l)) { if (!skipTitle) blocks.push(<h2 key={k++}>{l.slice(2)}</h2>); i++; continue; }
    if (/^## /.test(l)) { blocks.push(<h3 key={k++} id={l.slice(3).toLowerCase().replace(/[^a-z0-9]+/g, "-")}>{l.slice(3)}</h3>); i++; continue; }
    if (/^#{4,6} /.test(l)) { blocks.push(<h4 key={k++}>{l.replace(/^#+ /, "")}</h4>); i++; continue; }
    if (/^### /.test(l)) { blocks.push(<h4 key={k++}>{l.slice(4)}</h4>); i++; continue; }
    if (/^\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())); i++; }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      const [head, ...rest] = body;
      blocks.push(
        <div className="pf-tw" key={k++}><table className="pf-t">
          <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, `h${k}${j}`)}</th>)}</tr></thead>
          <tbody>{rest.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, `c${k}${ri}${j}`)}</td>)}</tr>)}</tbody>
        </table></div>,
      );
      continue;
    }
    if (/^\s*[-*] /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*] /, "")); i++; }
      blocks.push(<ul key={k++}>{items.map((x, j) => <li key={j}>{inline(x, `l${k}${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\. /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\. /, "")); i++; }
      blocks.push(<ol key={k++}>{items.map((x, j) => <li key={j}>{inline(x, `o${k}${j}`)}</li>)}</ol>);
      continue;
    }
    // a paragraph always takes its first line, so a stray line like "#tag" can never stall the reader
    const para: string[] = [l]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6} |\||\s*[-*] |\s*\d+\. )/.test(lines[i])) { para.push(lines[i]); i++; }
    const txt = para.join(" ");
    const tag = /^Inference:/.test(txt) ? "pf-inf" : /^Documented\./.test(txt) ? "pf-doc" : "";
    blocks.push(<p key={k++} className={tag || undefined}>{inline(txt, `p${k}`)}</p>);
  }
  return <div className="pf-md">{blocks}</div>;
}
