import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PropsWithChildren,
} from "react";

interface KeyboardAwareSearchPanelProps extends PropsWithChildren {
  className?: string;
}

const keyboardClearancePx = 12;

/**
 * Corrects a fixed search panel only when it renders below the visual viewport.
 * This accommodates iOS versions that already move fixed content for the
 * keyboard as well as versions that leave it behind the keyboard after input.
 */
export function KeyboardAwareSearchPanel({
  children,
  className,
}: KeyboardAwareSearchPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const viewportCorrectionRef = useRef(0);

  function updateViewportCorrection() {
    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    const visibleBottom = window.visualViewport?.height ?? window.innerHeight;
    const renderedBottom = panel.getBoundingClientRect().bottom;
    const uncorrectedBottom = renderedBottom + viewportCorrectionRef.current;
    const nextCorrection = Math.max(
      0,
      Math.ceil(uncorrectedBottom - visibleBottom + keyboardClearancePx),
    );

    if (nextCorrection === viewportCorrectionRef.current) {
      return;
    }

    viewportCorrectionRef.current = nextCorrection;
    panel.style.setProperty("--cu-viewport-correction", `${nextCorrection}px`);
  }

  useLayoutEffect(() => {
    updateViewportCorrection();
  });

  useEffect(() => {
    const viewport = window.visualViewport;
    let animationFrameId: number | null = null;

    function scheduleViewportCorrection() {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        updateViewportCorrection();
      });
    }

    const resizeObserver = new ResizeObserver(scheduleViewportCorrection);
    const panel = panelRef.current;

    if (panel) {
      resizeObserver.observe(panel);
    }

    scheduleViewportCorrection();
    viewport?.addEventListener("resize", scheduleViewportCorrection);
    viewport?.addEventListener("scroll", scheduleViewportCorrection);
    window.addEventListener("resize", scheduleViewportCorrection);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      resizeObserver.disconnect();
      viewport?.removeEventListener("resize", scheduleViewportCorrection);
      viewport?.removeEventListener("scroll", scheduleViewportCorrection);
      window.removeEventListener("resize", scheduleViewportCorrection);
    };
  }, []);

  return (
    <section
      ref={panelRef}
      className={["cu-search-panel", className].filter(Boolean).join(" ")}
    >
      {children}
    </section>
  );
}
