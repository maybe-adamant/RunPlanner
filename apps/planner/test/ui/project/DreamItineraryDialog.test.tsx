// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { DreamItineraryDialog } from '@planner/ui/project/DreamItineraryDialog';

afterEach(cleanup);

describe('DreamItineraryDialog', () => {
  const biomeLabel = (key: string) => catalog.biomes.byKey[key]!.label;
  it('shows unavailable starting and later biomes with reasons in the disclosure', () => {
    render(
      <DreamItineraryDialog
        catalog={catalog}
        onCancel={vi.fn()}
        onCreate={vi.fn()}
        pending={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Unavailable/ }));
    expect(screen.getByRole('option', { name: /Erebus/ }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getAllByText('Cannot be the first biome in a Dream Dive.')).toHaveLength(2);
    fireEvent.click(screen.getByRole('option', { name: biomeLabel('G') }));
    fireEvent.click(screen.getByRole('button', { name: /Unavailable/ }));
    expect(screen.getByRole('option', { name: /^Oceanus/ }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getByText('Already included in this route.')).toBeTruthy();
    expect(
      screen.getByText('Normally follows Oceanus; Dream Dives require a different next biome.'),
    ).toBeTruthy();
  });
  it('cancels its transient staged draft without creating a project', () => {
    const onCancel = vi.fn();
    const onCreate = vi.fn();
    render(
      <DreamItineraryDialog
        catalog={catalog}
        onCancel={onCancel}
        onCreate={onCreate}
        pending={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Choose four biomes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Route order' }).textContent).toContain(
      'Choose biomes',
    );
    expect(screen.getByRole('button', { name: 'Route order' }).textContent).not.toContain('1.');
    expect(screen.getAllByRole('button', { name: /Choose biome/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('keeps one picker open through four selections, revises a badge, and creates atomically', () => {
    const onCreate = vi.fn();
    render(
      <DreamItineraryDialog
        catalog={catalog}
        onCancel={vi.fn()}
        onCreate={onCreate}
        pending={false}
      />,
    );

    for (const biome of ['G', 'F', 'N', 'H']) {
      fireEvent.click(screen.getByRole('option', { name: biomeLabel(biome) }));
    }
    expect(screen.getByRole('button', { name: 'Route order' }).textContent).toContain(
      '1. Oceanus · 2. Erebus · 3. Ephyra · 4. Fields',
    );
    fireEvent.click(screen.getByRole('button', { name: `1. ${biomeLabel('G')}` }));
    fireEvent.click(screen.getByRole('option', { name: biomeLabel('H') }));
    expect(screen.getAllByRole('button', { name: /Choose biome/ })).toHaveLength(1);
    for (const biome of ['P']) {
      fireEvent.click(screen.getByRole('option', { name: biomeLabel(biome) }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(onCreate).toHaveBeenCalledWith(['H', 'F', 'N', 'P']);
  });
});
