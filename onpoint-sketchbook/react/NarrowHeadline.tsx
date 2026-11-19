// The squeezed, justified headline: <NarrowHeadline words={['the','whole','map']} />
export default function NarrowHeadline({ words, semi = true, as: Tag = 'h2' }: { words: string[]; semi?: boolean; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <Tag className="sk-narrow-wrap" aria-label={words.join(' ')}>
      <span className={`sk-narrow${semi ? ' semi' : ''}`} aria-hidden="true">{words.map(w => <span key={w}>{w}</span>)}</span>
    </Tag>
  );
}
