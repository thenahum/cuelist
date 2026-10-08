import {
  useEffect,
  useState,
  type CSSProperties,
  type PropsWithChildren,
} from "react";

interface KeyboardAwareSearchPanelProps extends PropsWithChildren {
  className?: string;
}

function getKeyboardInset(): number {
  const viewport = window.visualViewport;

  if (!viewport) {
    return 0;
  }

  return Math.max(
    0,
    window.innerHeight - viewport.height - viewport.offsetTop,
  );
}

/**
 * Keeps a fixed search panel above the software keyboard on browsers whose
 * layout viewport does not shrink when the keyboard opens (notably iOS Safari).
 */
export function KeyboardAwareSearchPanel({
  children,
  className,
}: KeyboardAwareSearchPanelProps) {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    function updateKeyboardInset() {
      setKeyboardInset(getKeyboardInset());
    }

    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("resize", updateKeyboardInset);

    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("resize", updateKeyboardInset);
    };
  }, []);

  return (
    <section
      className={["cu-search-panel", className].filter(Boolean).join(" ")}
      style={
        {
          "--cu-keyboard-inset": `${keyboardInset}px`,
        } as CSSProperties
      }
    >
      {children}
    </section>
  );
}
