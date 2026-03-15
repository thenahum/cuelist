import { useEffect } from "react";

interface EditorSheetProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose(): void;
}

export function EditorSheet({
  title,
  subtitle,
  children,
  onClose,
}: EditorSheetProps) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="cu-editor-overlay">
      <button
        type="button"
        aria-label="Close editor"
        className="cu-editor-backdrop"
        onClick={onClose}
      />
      <section className="cu-editor-panel">
        <header className="cu-editor-header">
          <div>
            <p className="cu-editor-eyebrow">Workspace</p>
            <h2 className="cu-editor-title">{title}</h2>
            <p className="cu-editor-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cu-icon-button"
            aria-label="Close editor"
          >
            Close
          </button>
        </header>
        <div className="cu-editor-body">{children}</div>
      </section>
    </div>
  );
}
