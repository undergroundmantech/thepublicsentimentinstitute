type Props = {
  label: string;
  value: string;
  note?: string;
};

export default function StatCard({ label, value, note }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {note ? <div className="mt-2 text-xs text-slate-500">{note}</div> : null}
    </div>
  );
}
