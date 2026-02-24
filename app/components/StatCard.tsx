type Props = {
  label: string;
  value: string;
  note?: string;
};

export default function StatCard({ label, value, note }: Props) {
  return (
    <div className="relative overflow-hidden border border-white/10 bg-[#0a0a0a] p-5 transition hover:border-amber-500/40">
      
      {/* top accent bar */}
      <div className="absolute left-0 top-0 h-[2px] w-full bg-amber-500/80" />

      {/* label */}
      <div className="psi-mono text-[10px] font-bold tracking-[0.25em] text-white/35">
        {label.toUpperCase()}
      </div>

      {/* main value */}
      <div className="mt-3 font-['Barlow_Condensed',system-ui] text-4xl font-extrabold uppercase tracking-[0.03em] text-white">
        {value}
      </div>

      {/* divider */}
      {note && (
        <>
          <div className="my-3 h-px w-full bg-white/10" />

          <div className="psi-mono text-[10px] tracking-[0.18em] text-white/40">
            {note}
          </div>
        </>
      )}

      {/* subtle glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100" />
    </div>
  );
}