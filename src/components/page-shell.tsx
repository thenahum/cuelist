import type { PropsWithChildren } from "react";

interface PageShellProps extends PropsWithChildren {
  mode?: "list" | "editor";
  className?: string;
}

export function PageShell({
  children,
  mode = "list",
  className,
}: PageShellProps) {
  const modeClassName =
    mode === "editor" ? "cu-page-shell cu-page-shell-editor" : "cu-page-shell cu-page-shell-list";

  return <div className={[modeClassName, className].filter(Boolean).join(" ")}>{children}</div>;
}
