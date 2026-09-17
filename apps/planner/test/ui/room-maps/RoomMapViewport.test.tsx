// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderMap(width = 1000, height = 800) {
  render(
    <RoomMapViewport
      asset={{ gameName: 'H_Combat04', src: '/map.webp', isPlaceholder: false }}
      title="Combat 04"
    />,
  );
  const image = screen.getByRole('img', { name: 'Map of Combat 04' });
  Object.defineProperties(image, {
    naturalWidth: { value: width },
    naturalHeight: { value: height },
  });
  fireEvent.load(image);
  const scroll = screen.getByRole('region', { name: 'Pan map of Combat 04' });
  const frame = image.parentElement;
  const stage = frame?.parentElement;
  if (stage === null || stage === undefined) throw new Error('Map stage is missing');
  let capturedPointer: number | undefined;
  const capture = vi.spyOn(stage, 'setPointerCapture').mockImplementation((id) => {
    capturedPointer = id;
  });
  vi.spyOn(stage, 'hasPointerCapture').mockImplementation((id) => capturedPointer === id);
  vi.spyOn(stage, 'releasePointerCapture').mockImplementation(() => {
    capturedPointer = undefined;
  });
  if (frame === null) throw new Error('Map image frame is missing');
  return { scroll, stage, image, frame, capture };
}

const pointer = { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300, clientY: 260 };

describe('RoomMapViewport', () => {
  it('drags the zoomed map using pointer capture while retaining native input paths', () => {
    const { scroll, stage, image, capture } = renderMap();
    expect(image.getAttribute('draggable')).toBe('false');
    fireEvent.pointerDown(stage, pointer);
    expect(capture).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect([scroll.scrollLeft, scroll.scrollTop]).toEqual([125, 100]);
    fireEvent.pointerDown(stage, { ...pointer, button: 2 });
    fireEvent.pointerDown(stage, { ...pointer, pointerType: 'touch' });
    expect(capture).not.toHaveBeenCalled();

    fireEvent.pointerDown(stage, pointer);
    expect(capture).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(scroll);
    expect(stage.getAttribute('data-panning')).toBe('true');
    fireEvent.pointerMove(stage, { ...pointer, clientX: 250, clientY: 230 });
    expect([scroll.scrollLeft, scroll.scrollTop]).toEqual([175, 130]);
    fireEvent.pointerMove(stage, { ...pointer, pointerId: 2, clientX: 0, clientY: 0 });
    expect([scroll.scrollLeft, scroll.scrollTop]).toEqual([175, 130]);

    fireEvent.pointerUp(stage, pointer);
    expect(stage.hasPointerCapture(1)).toBe(false);
    expect(stage.hasAttribute('data-panning')).toBe(false);
    fireEvent.pointerMove(stage, { ...pointer, clientX: 200, clientY: 200 });
    expect([scroll.scrollLeft, scroll.scrollTop]).toEqual([175, 130]);
  });

  it.each(['cancel', 'lost capture'])('ends a drag on %s', (termination) => {
    const { scroll, stage } = renderMap();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.pointerDown(stage, pointer);
    if (termination === 'cancel') {
      fireEvent.pointerCancel(stage, pointer);
    } else {
      stage.releasePointerCapture(1);
      fireEvent.lostPointerCapture(stage, pointer);
    }
    fireEvent.pointerMove(stage, { ...pointer, clientX: 0, clientY: 0 });
    expect([scroll.scrollLeft, scroll.scrollTop]).toEqual([62.5, 50]);
    expect(stage.hasAttribute('data-panning')).toBe(false);
    fireEvent.pointerDown(stage, pointer);
    expect(stage.hasPointerCapture(1)).toBe(true);
  });

  it('keeps the viewed center when zooming a letterboxed image and resets with Fit', () => {
    const { scroll, stage } = renderMap(1600, 800);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect([scroll.scrollLeft, scroll.scrollTop]).toEqual([62.5, 0]);
    // Native scrollbar/trackpad positions are also the origin of the next zoom.
    scroll.scrollLeft = 100;
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(scroll.scrollLeft).toBeCloseTo(170);
    expect(scroll.scrollTop).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(scroll.scrollLeft).toBeCloseTo(240);
    expect(scroll.scrollTop).toBeCloseTo(19);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(scroll.scrollLeft).toBeCloseTo(170);
    expect(scroll.scrollTop).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(screen.getByText('100%')).toBeTruthy();
    expect([scroll.scrollLeft, scroll.scrollTop]).toEqual([0, 0]);
    expect(stage.hasAttribute('data-pannable')).toBe(false);
  });

  it('preserves the center when zooming reveals a scrollbar that changes the fit size', () => {
    const { scroll, frame } = renderMap(600, 800);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect([scroll.scrollLeft, scroll.scrollTop]).toEqual([0, 100]);
    Object.defineProperty(scroll, 'clientHeight', {
      configurable: true,
      get: () => (Number.parseFloat(frame.style.width) > 500 ? 385 : 400),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(frame.style.width).toBe('505px');
    expect(frame.style.height).toBe('674px');
    expect([scroll.scrollLeft, scroll.scrollTop]).toEqual([2.5, 144.5]);
  });
});
