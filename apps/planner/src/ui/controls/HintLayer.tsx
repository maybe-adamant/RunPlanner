import { useEffect, useRef } from 'react';

const showDelayMs = 450;
const anchorGap = 8;
const viewportMargin = 8;

function hintAnchor(target: EventTarget | null): HTMLElement | undefined {
  return target instanceof Element
    ? (target.closest<HTMLElement>('[data-hint]') ?? undefined)
    : undefined;
}

/** The one hint surface; it shows the `data-hint` of the hovered or keyboard-focused control. */
export function HintLayer() {
  const layer = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = layer.current;
    const content = text.current;
    if (element === null || content === null) return;
    let anchor: HTMLElement | undefined;
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A pressed pointer means a click, drag or pan is under way; no hint appears until release.
    let pressed = false;

    const place = (target: HTMLElement): void => {
      const rect = target.getBoundingClientRect();
      const card = element.getBoundingClientRect();
      const below = rect.bottom + anchorGap;
      const above = rect.top - anchorGap - card.height;
      const fitsBelow = below + card.height <= window.innerHeight - viewportMargin;
      const top = fitsBelow || above < viewportMargin ? below : above;
      const centered = rect.left + rect.width / 2 - card.width / 2;
      const left = Math.min(
        Math.max(centered, viewportMargin),
        Math.max(viewportMargin, window.innerWidth - card.width - viewportMargin),
      );
      element.style.top = `${Math.round(top)}px`;
      element.style.left = `${Math.round(left)}px`;
      element.dataset.side = top === below ? 'bottom' : 'top';
    };

    const show = (target: HTMLElement): void => {
      const hint = target.dataset.hint;
      if (hint === undefined || hint === '' || !target.isConnected) return;
      content.textContent = hint;
      element.hidden = false;
      if (typeof element.showPopover === 'function') {
        // Reopen so the hint stacks above any modal dialog opened since.
        if (element.matches(':popover-open')) element.hidePopover();
        element.showPopover();
      }
      place(target);
      visible = true;
    };

    const hide = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      anchor = undefined;
      if (!visible) return;
      visible = false;
      if (typeof element.hidePopover === 'function' && element.matches(':popover-open')) {
        element.hidePopover();
      }
      element.hidden = true;
    };

    const schedule = (target: HTMLElement): void => {
      if (pressed || target === anchor) return;
      if (timer !== undefined) clearTimeout(timer);
      anchor = target;
      if (visible) {
        show(target);
        return;
      }
      timer = setTimeout(() => {
        timer = undefined;
        if (anchor === target && !pressed) show(target);
      }, showDelayMs);
    };

    const pointerOver = (event: PointerEvent): void => {
      if (event.buttons > 0) return;
      const target = hintAnchor(event.target);
      if (target !== undefined) schedule(target);
    };
    const pointerOut = (event: PointerEvent): void => {
      if (anchor === undefined) return;
      const next = event.relatedTarget;
      if (next instanceof Node && anchor.contains(next)) return;
      if (hintAnchor(next) === undefined) hide();
    };
    const focusIn = (event: FocusEvent): void => {
      const target = hintAnchor(event.target);
      if (target === undefined) hide();
      else schedule(target);
    };
    const focusOut = (event: FocusEvent): void => {
      if (anchor !== undefined && anchor.contains(event.target as Node)) hide();
    };
    const pointerDown = (): void => {
      pressed = true;
      hide();
    };
    const pointerUp = (): void => {
      pressed = false;
    };
    const windowBlur = (): void => {
      pressed = false;
      hide();
    };
    const keyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide();
    };

    const capture = { capture: true } as const;
    document.addEventListener('pointerover', pointerOver, capture);
    document.addEventListener('pointerout', pointerOut, capture);
    document.addEventListener('focusin', focusIn, capture);
    document.addEventListener('focusout', focusOut, capture);
    document.addEventListener('keydown', keyDown, capture);
    window.addEventListener('pointerdown', pointerDown, capture);
    window.addEventListener('pointerup', pointerUp, capture);
    window.addEventListener('pointercancel', pointerUp, capture);
    window.addEventListener('scroll', hide, capture);
    window.addEventListener('blur', windowBlur);
    return () => {
      hide();
      document.removeEventListener('pointerover', pointerOver, capture);
      document.removeEventListener('pointerout', pointerOut, capture);
      document.removeEventListener('focusin', focusIn, capture);
      document.removeEventListener('focusout', focusOut, capture);
      document.removeEventListener('keydown', keyDown, capture);
      window.removeEventListener('pointerdown', pointerDown, capture);
      window.removeEventListener('pointerup', pointerUp, capture);
      window.removeEventListener('pointercancel', pointerUp, capture);
      window.removeEventListener('scroll', hide, capture);
      window.removeEventListener('blur', windowBlur);
    };
  }, []);

  return (
    <div className="hint-layer" hidden popover="manual" ref={layer} role="tooltip">
      <span className="hint-card" ref={text} />
    </div>
  );
}
