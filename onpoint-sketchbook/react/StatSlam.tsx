// Big number that counts up and slams in: <StatSlam value={0.4} decimals label="POINT MISS" />
export default function StatSlam({ value, label, prefix = '', suffix = '', tone = '' }:
  { value: number; label: string; prefix?: string; suffix?: string; tone?: '' | 'good' | 'dark' }) {
  return (
    <div className={`sk-stat ${tone}`} data-sk-reveal="slam">
      <b data-sk-count={String(value)} data-sk-prefix={prefix} data-sk-suffix={suffix}>{prefix}{value}{suffix}</b>
      <span>{label}</span>
    </div>
  );
}
