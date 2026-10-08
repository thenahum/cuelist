import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type KeyboardEvent,
  type FocusEvent,
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
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  function dismissKeyboard() {
    const activeElement = document.activeElement;

    if (
      activeElement instanceof HTMLInputElement &&
      panelRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
  }

  function handleFocusCapture(event: FocusEvent<HTMLElement>) {
    if (event.target instanceof HTMLInputElement) {
      setIsKeyboardActive(true);
    }
  }

  function handleBlurCapture() {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;

      if (
        !(
          activeElement instanceof HTMLInputElement &&
          panelRef.current?.contains(activeElement)
        )
      ) {
        setIsKeyboardActive(false);
      }
    });
  }

  function handleKeyDownCapture(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.currentTarget.querySelector("input")?.blur();
    }
  }

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
    window.addEventListener("resize", scheduleViewportCorrection);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      resizeObserver.disconnect();
      viewport?.removeEventListener("resize", scheduleViewportCorrection);
      window.removeEventListener("resize", scheduleViewportCorrection);
    };
  }, []);

  useEffect(() => {
    if (!isKeyboardActive) {
      return;
    }

    const viewport = window.visualViewport;
    let settleTimeoutId: number | null = null;
    let animationFrameId: number | null = null;

    function scheduleSettledViewportCorrection() {
      if (settleTimeoutId !== null) {
        window.clearTimeout(settleTimeoutId);
      }

      settleTimeoutId = window.setTimeout(() => {
        settleTimeoutId = null;
        animationFrameId = window.requestAnimationFrame(() => {
          animationFrameId = null;
          updateViewportCorrection();
        });
      }, 120);
    }

    viewport?.addEventListener("scroll", scheduleSettledViewportCorrection);
    scheduleSettledViewportCorrection();

    return () => {
      if (settleTimeoutId !== null) {
        window.clearTimeout(settleTimeoutId);
      }

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      viewport?.removeEventListener("scroll", scheduleSettledViewportCorrection);
    };
  }, [isKeyboardActive]);

  return (
    <>
      <button
        type="button"
        aria-label="Dismiss search keyboard"
        onClick={dismissKeyboard}
        className={[
          "cu-search-backdrop",
          isKeyboardActive ? "cu-search-backdrop-keyboard-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <section
        ref={panelRef}
        className={["cu-search-panel", className].filter(Boolean).join(" ")}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
        onKeyDownCapture={handleKeyDownCapture}
      >
        {children}
      </section>
    </>
  );
}
