// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ArcanaCard } from '@planner/ui/controls/arcana-fear/ArcanaCard';

afterEach(cleanup);

describe('Arcana rank presentation', () => {
  it.each([
    ['Common', 'I'],
    ['Rare', 'II'],
    ['Epic', 'III'],
    ['Heroic', 'IV'],
  ])('shows active %s independently of selection', (rarity, numeral) => {
    render(
      <ArcanaCard
        cardKey="ChanneledCast"
        label="The Sorceress"
        rarity={rarity}
        aria-pressed={false}
        disabled
      />,
    );
    const card = screen.getByRole('button', { name: 'The Sorceress' });
    expect(card.getAttribute('data-rarity')).toBe(rarity);
    expect(card.getAttribute('data-active')).toBe('true');
    expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText(numeral)).toBeTruthy();
    expect(card.title).toContain(`Current: ${rarity}`);
  });

  it('separates a selected grant preview from the current rank and restores it on deselection', () => {
    const { rerender } = render(
      <ArcanaCard
        cardKey="ChanneledCast"
        label="The Sorceress"
        rarity="Epic"
        resultRarity="Heroic"
        aria-pressed
        selectionOrder={2}
      />,
    );
    expect(screen.getByRole('button').getAttribute('data-rarity')).toBe('Heroic');
    expect(screen.getByText('IV')).toBeTruthy();
    expect(screen.getByRole('button').getAttribute('aria-description')).toBe(
      'Grants: Heroic · Rank 4; pick 2',
    );
    expect(screen.getByText('Pick 2')).toBeTruthy();
    rerender(
      <ArcanaCard
        cardKey="ChanneledCast"
        label="The Sorceress"
        rarity="Epic"
        resultRarity="Heroic"
        aria-pressed={false}
      />,
    );
    expect(screen.getByRole('button').getAttribute('data-rarity')).toBe('Epic');
    expect(screen.getByText('III')).toBeTruthy();
    expect(screen.queryByText('Pick 2')).toBeNull();
  });

  it('does not invent a rank for inactive or branch-varying cards', () => {
    const { rerender } = render(
      <ArcanaCard
        cardKey="ChanneledCast"
        label="The Sorceress"
        rarity={null}
        aria-pressed={false}
      />,
    );
    expect(screen.getByRole('button').hasAttribute('data-rarity')).toBe(false);
    rerender(
      <ArcanaCard
        cardKey="ChanneledCast"
        label="The Sorceress"
        rarity="mixed"
        aria-pressed={false}
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByRole('button').title).toContain('Rank varies');
  });
});
