interface PagePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PagePlaceholder({
  eyebrow,
  title,
  description,
}: PagePlaceholderProps) {
  return (
    <section className="rounded-[28px] border border-dashed border-white/15 bg-black/20 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-soft)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        {description}
      </p>
    </section>
  );
}
