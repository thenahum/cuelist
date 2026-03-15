interface StatusCardProps {
  label: string;
  value: string;
  caption?: string;
}

export function StatusCard({ label, value, caption }: StatusCardProps) {
  return (
    <section className="cu-panel p-5">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        {value}
      </p>
      {caption ? (
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{caption}</p>
      ) : null}
    </section>
  );
}
