interface StatusCardProps {
  label: string;
  value: string;
  caption: string;
}

export function StatusCard({ label, value, caption }: StatusCardProps) {
  return (
    <section className="cu-panel p-5">
      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{caption}</p>
    </section>
  );
}
