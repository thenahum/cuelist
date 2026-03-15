import type { PropsWithChildren } from "react";

interface PageContentStackProps extends PropsWithChildren {
  density?: "default" | "compact";
  className?: string;
}

export function PageContentStack({
  children,
  density = "default",
  className,
}: PageContentStackProps) {
  return (
    <div
      className={[
        "cu-page-content-stack",
        density === "compact" ? "cu-page-content-stack-compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
