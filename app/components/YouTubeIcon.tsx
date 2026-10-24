// A plain play button mark, drawn here rather than YouTube's logo file.
export default function YouTubeIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 40 28" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="40" height="28" rx="8" fill="#e5252a" />
      <path d="M16 8.5 L27 14 L16 19.5 Z" fill="#fff" />
    </svg>
  );
}
