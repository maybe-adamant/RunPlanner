import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  exchangeBlockedWheelOffers,
  type WheelSideOrderBlock,
} from '@run-planner/engine/project-migration';
import { simulateProject } from '@run-planner/engine/simulation';
import {
  loadSurfaceNOProject,
  nBiome,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';

const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
const offer = (offerKey: 'offer1' | 'offer2') =>
  createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', offerKey);
const left = { rewardType: 'MaxHealthDrop' } as const;
const right = { rewardType: 'RoomMoneyDrop' } as const;

/** The NO checkpoint with a two-offer wheel holding Left/Right and the Right offer picked. */
function twoOfferProject(
  base: ProjectDocument = loadSurfaceNOProject(),
  offers: { readonly left: unknown; readonly right: unknown } = { left, right },
): ProjectDocument {
  let project = applyProjectCommand(base, catalog, {
    kind: 'ReplaceRewardWheelOfferCount',
    wheel,
    offerCount: 2,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceRewardWheelOffer',
    offer: offer('offer1'),
    value: offers.left as typeof left,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceRewardWheelOffer',
    offer: offer('offer2'),
    value: offers.right as typeof right,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceRewardWheelPicked',
    wheel,
    pickedOfferIndex: 2,
  });
}

const raw = (project: ProjectDocument): unknown => JSON.parse(encodeProjectDocument(project));

function wheelState(project: ProjectDocument) {
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      if (
        occurrence.occurrenceId === oOccurrenceIds.combat04 &&
        occurrence.state.kind === 'shipCombat'
      )
        return occurrence.state.wheels.wheel1;
  throw new Error('NO checkpoint lost its first Ship');
}

/** A judge that blocks the wheel while the given reward leads it, or never. */
const blockWhileLeading =
  (leading: typeof left | typeof right | undefined) =>
  (project: ProjectDocument): WheelSideOrderBlock | undefined =>
    leading !== undefined &&
    wheelState(project)?.offers.offer1?.offer.rewardType === leading.rewardType
      ? { kind: 'invalid', owner: wheel, reasons: [{ origin: offer('offer1') }] }
      : undefined;

describe('blocked wheel offer exchange', () => {
  it('exchanges a wheel valid only the other way round, with its pick', () => {
    const migrated = exchangeBlockedWheelOffers(
      raw(twoOfferProject()),
      catalog,
      blockWhileLeading(left),
    );
    const state = wheelState(decodeProjectDocument(migrated, catalog));
    expect(state?.offers.offer1?.offer).toEqual(right);
    expect(state?.offers.offer2?.offer).toEqual(left);
    expect(state?.pickedOfferIndex).toBe(1);
    // Once side-ordered, the plan no longer names the wheel and stays as it is.
    expect(exchangeBlockedWheelOffers(migrated, catalog, blockWhileLeading(left))).toBe(migrated);
  });

  it('returns the document itself when nothing blocks or the exchange does not clear the block', () => {
    const document = raw(twoOfferProject());
    expect(exchangeBlockedWheelOffers(document, catalog, blockWhileLeading(undefined))).toBe(
      document,
    );
    const alwaysBlocked = (): WheelSideOrderBlock => ({
      kind: 'invalid',
      owner: wheel,
      reasons: [{ origin: offer('offer2') }],
    });
    expect(exchangeBlockedWheelOffers(document, catalog, alwaysBlocked)).toBe(document);
    expect(exchangeBlockedWheelOffers('not a document', catalog, alwaysBlocked)).toBe(
      'not a document',
    );
  });

  it('keeps the offers of a plan its judge cannot evaluate', () => {
    const document = raw(twoOfferProject());
    const throwing = (): WheelSideOrderBlock => {
      throw new Error('evaluation contract breach');
    };
    expect(exchangeBlockedWheelOffers(document, catalog, throwing)).toBe(document);
    let calls = 0;
    const throwsOnExchange = (project: ProjectDocument) => {
      calls += 1;
      if (calls > 1) throw new Error('evaluation contract breach');
      return blockWhileLeading(left)(project);
    };
    expect(exchangeBlockedWheelOffers(document, catalog, throwsOnExchange)).toBe(document);
  });
});

describe('blocked wheel offer exchange judged by the plan evaluation', () => {
  const judge = (project: ProjectDocument) => simulateProject(catalog, project).issue;
  const zeusBoon = { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } };

  /** Cloud Bangle from the N rack forces O's first Boon: Zeus must lead the wheel. */
  function forcedZeusWheel(): ProjectDocument {
    const forced = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(
        createOccurrenceAddress(nBiome, createOccurrenceId('surface-n-preboss:postboss')),
      ),
      keepsakeKey: 'ForceZeusBoonKeepsake',
    });
    return twoOfferProject(forced, { left, right: zeusBoon });
  }

  it('exchanges a wheel valid only right to left', () => {
    const saved = forcedZeusWheel();
    const block = judge(saved);
    expect(block?.kind).toBe('invalid');
    expect(block?.owner).toEqual(offer('offer1'));

    const migrated = decodeProjectDocument(
      exchangeBlockedWheelOffers(raw(saved), catalog, judge),
      catalog,
    );
    const state = wheelState(migrated);
    expect(state?.offers.offer1?.offer).toEqual(zeusBoon);
    expect(state?.offers.offer2?.offer).toEqual(left);
    expect(state?.pickedOfferIndex).toBe(1);
    // The Zeus Boon now leads; its trait screen is still to be authored.
    expect(judge(migrated)?.kind).toBe('incomplete');
  });

  it('leaves a wheel behind an earlier blocking stop unjudged and unexchanged', () => {
    const document = raw(forcedZeusWheel()) as {
      route: { biomes: { topology: { occurrences: Record<string, unknown>[] } | null }[] };
    };
    const combat11 = document.route.biomes
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.occurrenceId === 'surface-n-combat11') as {
      state: { reward: { traitOffersByAcquisitionRole: { source: unknown } } };
    };
    // The first N room's Boon screen is left unauthored.
    combat11.state.reward.traitOffersByAcquisitionRole.source = null;
    const earlier = judge(decodeProjectDocument(document, catalog));
    expect(earlier?.kind).toBe('incomplete');
    expect(exchangeBlockedWheelOffers(document, catalog, judge)).toBe(document);
  });
});
