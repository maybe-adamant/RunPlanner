import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 10_000 });

class TestResizeObserver implements ResizeObserver {
  disconnect(): void {}

  observe(): void {}

  unobserve(): void {}
}

if (globalThis.ResizeObserver === undefined) {
  globalThis.ResizeObserver = TestResizeObserver;
}

if (globalThis.HTMLElement !== undefined) {
  if (HTMLElement.prototype.scrollIntoView === undefined) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
  if (HTMLElement.prototype.hasPointerCapture === undefined) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (HTMLElement.prototype.setPointerCapture === undefined) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (HTMLElement.prototype.releasePointerCapture === undefined) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
}
