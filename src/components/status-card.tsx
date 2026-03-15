interface StatusCardProps {
  label: string;
  value: string;
  caption: string;
}

export function StatusCard({ label, value, caption }: StatusCardProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 backdrop-blur">
      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{caption}</p>
    </section>
  );
}
