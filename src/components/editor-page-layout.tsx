import { Link } from "react-router-dom";

interface EditorPageLayoutProps {
  backTo: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function EditorPageLayout({
  backTo,
  backLabel,
  eyebrow,
  title,
  description,
  children,
}: EditorPageLayoutProps) {
  return (
    <div className="space-y-5">
      <section className="cu-panel p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              to={backTo}
              className="cu-button cu-button-neutral"
            >
              {backLabel}
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.35em] text-[var(--brand-soft)]">
              {eyebrow}
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              {description}
            </p>
          </div>
        </div>
      </section>

      <section className="cu-panel p-3 sm:p-4">
        {children}
      </section>
    </div>
  );
}
