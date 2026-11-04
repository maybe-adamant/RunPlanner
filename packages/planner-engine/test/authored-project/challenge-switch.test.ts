import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  undoProjectHistory,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- encoded JSON edited before strict decoding
type RawJson = any;

const fBiome = createBiomeAddress('Underworld', 'F');
const hostId = createOccurrenceId('golden-f-b5-e1');
const host = createOccurrenceAddress(fBiome, hostId);
const interaction: RoomActionReference = Object.freeze({ kind: 'interactChallengeSwitch' });

let cached: ProjectDocument | undefined;
const golden = () => (cached ??= loadUnderworldFGHICheckpoint());

function occurrenceOf(project: ProjectDocument, occurrenceId = hostId) {
  return project.route.biomes
    .flatMap((plan) => plan.topology?.occurrences ?? [])
    .find((occurrence) => occurrence.occurrenceId === occurrenceId)!;
}

function observe(project: ProjectDocument, variantKey: string | null) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceChallengeSwitch',
    occurrence: host,
    variantKey,
  });
}

function insertInteraction(project: ProjectDocument) {
  return applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(fBiome, hostId, roomActionKey(interaction)),
    reference: interaction,
    index: occurrenceOf(project).roomActions.order.length,
  });
}

function editOccurrence(
  project: ProjectDocument,
  occurrenceId: string,
  edit: (raw: RawJson) => void,
) {
  const raw = JSON.parse(encodeProjectDocument(project));
  for (const biome of raw.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      if (occurrence.occurrenceId === occurrenceId) edit(occurrence);
  return raw;
}

describe('challenge switch observation', () => {
  it('observes a switch with its claim defaults and the claim pickup site', () => {
    const observed = observe(golden(), 'PerfectClearChallengeSwitch_Pom');
    const occurrence = occurrenceOf(observed);
    expect(occurrence.challengeSwitch).toEqual({
      variantKey: 'PerfectClearChallengeSwitch_Pom',
      hitless: true,
      nectarDropped: false,
    });
    expect(Object.keys(occurrence.acquisitionSites?.challengeSwitch?.pickupEntries ?? {})).toEqual([
      'reward',
    ]);
    expect(
      occurrence.acquisitionSites?.challengeSwitch?.pickupEntries?.reward?.offer.rewardType,
    ).toBe('StackUpgrade');
    // Observing a switch does not use it.
    expect(occurrence.roomActions.order).toEqual(occurrenceOf(golden()).roomActions.order);
    const encoded = encodeProjectDocument(observed);
    expect(encodeProjectDocument(decodeProjectDocument(JSON.parse(encoded), catalog))).toBe(
      encoded,
    );
  });

  it('defaults Time gold and keeps the outcome across a variant change', () => {
    const time = occurrenceOf(observe(golden(), 'TimeChallengeSwitch_Money'));
    expect(time.challengeSwitch).toEqual({
      variantKey: 'TimeChallengeSwitch_Money',
      hitless: true,
      nectarDropped: false,
      gold: 90,
    });
    expect(time.acquisitionSites?.challengeSwitch?.pickupEntries?.reward?.offer.rewardType).toBe(
      'Money',
    );
    const hit = applyProjectCommand(observe(golden(), 'TimeChallengeSwitch_Money'), catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: host,
      hitless: false,
      nectarDropped: false,
      gold: 40,
    });
    const elite = occurrenceOf(observe(hit, 'EliteChallengeSwitch_MaxMana'));
    expect(elite.challengeSwitch).toEqual({
      variantKey: 'EliteChallengeSwitch_MaxMana',
      hitless: false,
      nectarDropped: false,
    });
    expect(occurrenceOf(observe(hit, 'TimeChallengeSwitch_Money')).challengeSwitch?.gold).toBe(40);
  });

  it('takes the claim pickups with the interaction and follows the outcome', () => {
    const used = insertInteraction(observe(golden(), 'PerfectClearChallengeSwitch_Pom'));
    const order = occurrenceOf(used).roomActions.order;
    expect(order.slice(-2)).toEqual([
      interaction,
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'reward' },
    ]);
    const hit = applyProjectCommand(used, catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: host,
      hitless: false,
      nectarDropped: false,
    });
    expect(
      occurrenceOf(hit).acquisitionSites?.challengeSwitch?.pickupEntries?.reward?.offer.rewardType,
    ).toBe('RoomRewardConsolationPrize');
    expect(occurrenceOf(hit).roomActions.order).toEqual(order);
    const nectar = applyProjectCommand(used, catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: host,
      hitless: true,
      nectarDropped: true,
    });
    expect(occurrenceOf(nectar).roomActions.order.slice(-3)).toEqual([
      interaction,
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'reward' },
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'nectar' },
    ]);
    expect(
      occurrenceOf(nectar).acquisitionSites?.challengeSwitch?.pickupEntries?.nectar?.offer
        .rewardType,
    ).toBe('GiftDrop');
    const cleared = observe(nectar, null);
    expect(occurrenceOf(cleared).challengeSwitch).toBeUndefined();
    expect(occurrenceOf(cleared).acquisitionSites?.challengeSwitch).toBeUndefined();
    expect(occurrenceOf(cleared).roomActions.order).toEqual(
      occurrenceOf(golden()).roomActions.order,
    );
  });

  it('records each edit as one undoable history step', () => {
    const history = applyProjectHistoryCommand(createProjectHistory(golden()), catalog, {
      kind: 'ReplaceChallengeSwitch',
      occurrence: host,
      variantKey: 'EliteChallengeSwitch_Talent',
    });
    expect(history.past).toHaveLength(1);
    expect(undoProjectHistory(history).present).toBe(golden());
    expect(observe(history.present, 'EliteChallengeSwitch_Talent')).toBe(history.present);
    expect(observe(golden(), null)).toBe(golden());
  });

  it('refuses a room without a switch host and an impossible outcome', () => {
    const intro = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-start'));
    expect(() =>
      applyProjectCommand(golden(), catalog, {
        kind: 'ReplaceChallengeSwitch',
        occurrence: intro,
        variantKey: 'TimeChallengeSwitch_Money',
      }),
    ).toThrow(/hosts no challenge switch/);
    expect(() => observe(golden(), 'ChallengeSwitch')).toThrow(/unknown challenge switch/);
    const observed = observe(golden(), 'EliteChallengeSwitch_Talent');
    const outcome = (hitless: boolean, nectarDropped: boolean, gold?: number) => () =>
      applyProjectCommand(observed, catalog, {
        kind: 'ReplaceChallengeSwitchOutcome',
        occurrence: host,
        hitless,
        nectarDropped,
        ...(gold === undefined ? {} : { gold }),
      });
    expect(outcome(false, true)).toThrow(/bonus Nectar drops only on a hitless claim/);
    expect(outcome(true, false, 50)).toThrow(/only a Time switch claims gold/);
    const time = observe(golden(), 'TimeChallengeSwitch_Money');
    expect(() =>
      applyProjectCommand(time, catalog, {
        kind: 'ReplaceChallengeSwitchOutcome',
        occurrence: host,
        hitless: true,
        nectarDropped: false,
        gold: 120,
      }),
    ).toThrow(/gold must be an integer from 10 through 100/);
  });

  it('decodes strictly: host, shape, and an interaction without a switch', () => {
    const observed = observe(golden(), 'PerfectClearChallengeSwitch_MaxHealth');
    expect(() =>
      decodeProjectDocument(
        editOccurrence(observed, 'golden-f-start', (occurrence) => {
          occurrence.challengeSwitch = {
            variantKey: 'TimeChallengeSwitch_Money',
            hitless: true,
            nectarDropped: false,
            gold: 90,
          };
        }),
        catalog,
      ),
    ).toThrow(/challengeSwitch: F_Opening01 hosts no challenge switch/);
    expect(() =>
      decodeProjectDocument(
        editOccurrence(observed, hostId, (occurrence) => {
          occurrence.challengeSwitch.nectarDropped = true;
          occurrence.challengeSwitch.hitless = false;
        }),
        catalog,
      ),
    ).toThrow(/challengeSwitch: the bonus Nectar drops only on a hitless claim/);
    expect(() =>
      decodeProjectDocument(
        editOccurrence(observed, hostId, (occurrence) => {
          delete occurrence.challengeSwitch;
          delete occurrence.acquisitionSites;
          occurrence.roomActions.order.push({ kind: 'interactChallengeSwitch' });
        }),
        catalog,
      ),
    ).toThrow(/at most one interactChallengeSwitch action/);
    expect(() =>
      decodeProjectDocument(
        editOccurrence(observed, hostId, (occurrence) => {
          delete occurrence.acquisitionSites;
        }),
        catalog,
      ),
    ).toThrow(/acquisitionSites\.challengeSwitch\.pickupEntries: does not match selected/);
  });
});
