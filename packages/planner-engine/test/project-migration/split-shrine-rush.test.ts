import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { decodeProjectDocument, encodeProjectDocument } from '@run-planner/engine/authored-project';
import { splitShrineRush } from '@run-planner/engine/project-migration';
import { loadSurfaceShrineTravelDealCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';

type Raw = Record<string, unknown>;

/** A raw plan whose one occurrence holds the given action order. */
function planWith(order: readonly unknown[]): Raw {
  return {
    schemaVersion: 103,
    route: {
      biomes: [
        {
          biomeKey: 'N',
          topology: { occurrences: [{ occurrenceId: 'a', roomActions: { order } }] },
        },
        { biomeKey: 'O', topology: null },
      ],
    },
  };
}

function orderOf(plan: unknown): unknown {
  return ((plan as Raw).route as { biomes: { topology: { occurrences: Raw[] } }[] }).biomes[0]!
    .topology.occurrences[0]!.roomActions;
}

type RawPlan = {
  route: { biomes: { topology: { occurrences: { roomActions: { order: Raw[] } }[] } | null }[] };
};

/** The plan with its rows' item content dropped, which schema 102 never stored. */
function withoutItemContent(current: Raw): Raw {
  const plan = structuredClone(current) as unknown as RawPlan;
  for (const biome of plan.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      for (const action of occurrence.roomActions.order) delete action.content;
  return plan as unknown as Raw;
}

/** The schema 102 shape of a rush: a flag on its purchase, and no item content. */
function joinShrineRush(current: Raw): Raw {
  const plan = withoutItemContent(current) as unknown as RawPlan;
  for (const biome of plan.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
      const order = occurrence.roomActions.order;
      const rushed = new Set(
        order.flatMap((action) =>
          action.kind === 'rushHermesShrineOffer' ? [action.generationKey] : [],
        ),
      );
      occurrence.roomActions.order = order.flatMap((action) =>
        action.kind === 'rushHermesShrineOffer'
          ? []
          : action.kind === 'purchaseHermesShrineOffer'
            ? [{ ...action, rushed: rushed.has(action.generationKey) }]
            : [action],
      );
    }
  return plan as unknown as Raw;
}

describe('splitting a stored Shrine rush into its own action', () => {
  const fountain = { kind: 'useFountain' };
  const pickup = {
    kind: 'interactAcquisitionEntry',
    siteKey: 'hermesShrineDelivery',
    entryKey: 'x',
  };

  it('follows a rushed purchase with its rush and drops the flag of an unrushed one', () => {
    const before = planWith([
      fountain,
      { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first', rushed: true },
      { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:secondLeft', rushed: false },
      { kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill', rushed: true },
      pickup,
    ]);
    const frozen = structuredClone(before);
    expect(orderOf(splitShrineRush(before))).toEqual({
      order: [
        fountain,
        { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first' },
        { kind: 'rushHermesShrineOffer', generationKey: 'initial:first' },
        { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:secondLeft' },
        { kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill' },
        { kind: 'rushHermesShrineOffer', generationKey: 'travelDealRefill' },
        pickup,
      ],
    });
    // The transform is pure.
    expect(before).toEqual(frozen);
  });

  it('leaves a plan without a stored rush flag, or one it cannot read, unchanged', () => {
    const current = planWith([fountain, { kind: 'rushHermesShrineOffer', generationKey: 'a' }]);
    expect(splitShrineRush(current)).toEqual(current);
    for (const raw of [null, 'plan', { route: 'not a route' }, planWith(['x', 3])])
      expect(splitShrineRush(raw)).toEqual(raw);
    // A malformed flag stays for strict decoding to reject.
    const malformed = planWith([
      { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first', rushed: 'yes' },
    ]);
    expect(splitShrineRush(malformed)).toEqual(malformed);
  });

  it('is lossless: a checked-in plan joined back into its stored shape splits to itself', () => {
    const current = withoutItemContent(
      JSON.parse(encodeProjectDocument(loadSurfaceShrineTravelDealCheckpoint())) as Raw,
    );
    const stored = joinShrineRush(current);
    expect(JSON.stringify(stored)).toContain('"rushed":true');
    const split = splitShrineRush(stored);
    expect(split).toEqual(current);
    expect(decodeProjectDocument(split, catalog)).toEqual(decodeProjectDocument(current, catalog));
  });
});
