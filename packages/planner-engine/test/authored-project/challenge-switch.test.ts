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
      outcome: 'hitless',
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

  it('authors no Time gold and keeps the outcome across a variant change', () => {
    const time = occurrenceOf(observe(golden(), 'TimeChallengeSwitch_Money'));
    expect(time.challengeSwitch).toEqual({
      variantKey: 'TimeChallengeSwitch_Money',
      outcome: 'finished',
      nectarDropped: false,
    });
    expect(time.acquisitionSites?.challengeSwitch?.pickupEntries?.reward?.offer.rewardType).toBe(
      'Money',
    );
    const finished = applyProjectCommand(observe(golden(), 'TimeChallengeSwitch_Money'), catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: host,
      outcome: 'finished',
      nectarDropped: true,
    });
    // Elite ends finished as Time does; the claim keeps its Nectar.
    const elite = occurrenceOf(observe(finished, 'EliteChallengeSwitch_MaxMana'));
    expect(elite.challengeSwitch).toEqual({
      variantKey: 'EliteChallengeSwitch_MaxMana',
      outcome: 'finished',
      nectarDropped: true,
    });
    // PerfectClear cannot end finished: it starts from its own clean claim.
    expect(
      occurrenceOf(observe(finished, 'PerfectClearChallengeSwitch_Pom')).challengeSwitch,
    ).toEqual({
      variantKey: 'PerfectClearChallengeSwitch_Pom',
      outcome: 'hitless',
      nectarDropped: true,
    });
    // A left fight is a left fight of any kind, and carries no gold or Nectar.
    const left = applyProjectCommand(finished, catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: host,
      outcome: 'left',
      nectarDropped: false,
    });
    expect(occurrenceOf(left).challengeSwitch).toEqual({
      variantKey: 'TimeChallengeSwitch_Money',
      outcome: 'left',
      nectarDropped: false,
    });
    expect(
      occurrenceOf(observe(left, 'PerfectClearChallengeSwitch_Pom')).challengeSwitch?.outcome,
    ).toBe('left');
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
      outcome: 'failed',
      nectarDropped: false,
    });
    expect(
      occurrenceOf(hit).acquisitionSites?.challengeSwitch?.pickupEntries?.reward?.offer.rewardType,
    ).toBe('RoomRewardConsolationPrize');
    expect(occurrenceOf(hit).roomActions.order).toEqual(order);
    const nectar = applyProjectCommand(used, catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: host,
      outcome: 'hitless',
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
    // Leaving mid-fight claims nothing: its pickups leave the order.
    const left = applyProjectCommand(nectar, catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: host,
      outcome: 'left',
      nectarDropped: false,
    });
    expect(occurrenceOf(left).acquisitionSites?.challengeSwitch).toBeUndefined();
    expect(occurrenceOf(left).roomActions.order.at(-1)).toEqual(interaction);
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
    const outcome =
      (value: 'left' | 'finished' | 'hitless' | 'failed', nectarDropped: boolean) => () =>
        applyProjectCommand(observed, catalog, {
          kind: 'ReplaceChallengeSwitchOutcome',
          occurrence: host,
          outcome: value,
          nectarDropped,
        });
    expect(outcome('left', true)).toThrow(/bonus Nectar drops only on a claim with no damage/);
    expect(outcome('hitless', false)).toThrow(/elite switches cannot end hitless/);
    expect(outcome('failed', false)).toThrow(/elite switches cannot end failed/);
  });

  it('ignores a Time claim gold an earlier draft authored', () => {
    const time = observe(golden(), 'TimeChallengeSwitch_Money');
    const decoded = decodeProjectDocument(
      editOccurrence(time, hostId, (occurrence) => {
        occurrence.challengeSwitch.gold = 40;
      }),
      catalog,
    );
    expect(occurrenceOf(decoded).challengeSwitch).toEqual(occurrenceOf(time).challengeSwitch);
  });

  it('decodes strictly: host, shape, and an interaction without a switch', () => {
    const observed = observe(golden(), 'PerfectClearChallengeSwitch_MaxHealth');
    expect(() =>
      decodeProjectDocument(
        editOccurrence(observed, 'golden-f-start', (occurrence) => {
          occurrence.challengeSwitch = {
            variantKey: 'TimeChallengeSwitch_Money',
            outcome: 'finished',
            nectarDropped: false,
          };
        }),
        catalog,
      ),
    ).toThrow(/challengeSwitch: F_Opening01 hosts no challenge switch/);
    expect(() =>
      decodeProjectDocument(
        editOccurrence(observed, hostId, (occurrence) => {
          occurrence.challengeSwitch.nectarDropped = true;
          occurrence.challengeSwitch.outcome = 'failed';
        }),
        catalog,
      ),
    ).toThrow(/challengeSwitch: the bonus Nectar drops only on a claim with no damage taken/);
    expect(() =>
      decodeProjectDocument(
        editOccurrence(observed, hostId, (occurrence) => {
          occurrence.challengeSwitch.outcome = 'finished';
        }),
        catalog,
      ),
    ).toThrow(/challengeSwitch: perfectClear switches cannot end finished/);
    expect(() =>
      decodeProjectDocument(
        editOccurrence(observed, hostId, (occurrence) => {
          occurrence.challengeSwitch.hitless = true;
        }),
        catalog,
      ),
    ).toThrow(/challengeSwitch/);
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

  it('pins an Elite switch elite, keeps it across Elite variants and drops it otherwise', () => {
    const elite = (
      project: ProjectDocument,
      value: { enemyKey: string; attributeKeys: string[] } | null,
    ) =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceChallengeSwitchElite',
        occurrence: host,
        elite: value,
      });
    const observed = observe(golden(), 'EliteChallengeSwitch_Talent');
    const pinned = elite(observed, {
      enemyKey: 'Brawler_Elite',
      attributeKeys: ['Frenzy', 'Blink'],
    });
    expect(occurrenceOf(pinned).challengeSwitch?.elite).toEqual({
      enemyKey: 'Brawler_Elite',
      attributeKeys: ['Frenzy', 'Blink'],
    });
    const encoded = encodeProjectDocument(pinned);
    expect(encodeProjectDocument(decodeProjectDocument(JSON.parse(encoded), catalog))).toBe(
      encoded,
    );
    expect(
      occurrenceOf(observe(pinned, 'EliteChallengeSwitch_MaxMana')).challengeSwitch?.elite,
    ).toEqual({ enemyKey: 'Brawler_Elite', attributeKeys: ['Frenzy', 'Blink'] });
    expect(
      occurrenceOf(observe(pinned, 'TimeChallengeSwitch_Money')).challengeSwitch?.elite,
    ).toBeUndefined();
    expect(occurrenceOf(elite(pinned, null)).challengeSwitch?.elite).toBeUndefined();
    expect(elite(pinned, { enemyKey: 'Brawler_Elite', attributeKeys: ['Frenzy', 'Blink'] })).toBe(
      pinned,
    );
    expect(() =>
      elite(observe(golden(), 'TimeChallengeSwitch_Money'), {
        enemyKey: 'Brawler_Elite',
        attributeKeys: [],
      }),
    ).toThrow(/only an Elite switch pins its elite/);
    expect(() =>
      elite(observed, { enemyKey: 'Brawler_Elite', attributeKeys: ['Blink', 'Blink'] }),
    ).toThrow(/repeats an attribute/);
    expect(() =>
      elite(observed, { enemyKey: 'Brawler_Elite', attributeKeys: ['Blink', 'Frenzy', 'Fog'] }),
    ).toThrow(/more attributes than any Elite switch draws/);
  });

  it('keeps its anchor across variant, outcome and elite edits', () => {
    const anchorId =
      catalog.rooms.byKey[occurrenceOf(golden()).gameName]!.mapPoints!.challengeSwitchAnchors[0]!
        .id;
    const placed = applyProjectCommand(observe(golden(), 'EliteChallengeSwitch_Talent'), catalog, {
      kind: 'ReplaceRoomObjectAnchor',
      occurrence: host,
      object: 'challengeSwitch',
      anchorId,
    });
    const edits = [
      observe(placed, 'EliteChallengeSwitch_MaxMana'),
      observe(placed, 'PerfectClearChallengeSwitch_Pom'),
      applyProjectCommand(placed, catalog, {
        kind: 'ReplaceChallengeSwitchOutcome',
        occurrence: host,
        outcome: 'left',
        nectarDropped: false,
      }),
      applyProjectCommand(placed, catalog, {
        kind: 'ReplaceChallengeSwitchElite',
        occurrence: host,
        elite: { enemyKey: 'Brawler_Elite', attributeKeys: ['Frenzy'] },
      }),
    ];
    for (const edited of edits) {
      expect(edited).not.toBe(placed);
      expect(occurrenceOf(edited).challengeSwitch?.anchorId).toBe(anchorId);
    }
    expect(occurrenceOf(observe(placed, null)).challengeSwitch).toBeUndefined();
  });

  it('customizes the switch encounter within its kind and drops it across kinds', () => {
    const composition = Object.freeze({
      kind: 'generated' as const,
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Mage'] }],
    });
    const customize = (project: ProjectDocument, decisionKey: string, value: unknown) =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceChallengeSwitchCustomization',
        occurrence: host,
        decisionKey,
        value: value as never,
      });
    const observed = observe(golden(), 'PerfectClearChallengeSwitch_Pom');
    const customized = customize(observed, 'generatedComposition', composition);
    expect(occurrenceOf(customized).challengeSwitch?.customization).toEqual({
      generatedComposition: composition,
    });
    const encoded = encodeProjectDocument(customized);
    expect(encodeProjectDocument(decodeProjectDocument(JSON.parse(encoded), catalog))).toBe(
      encoded,
    );
    expect(customize(customized, 'generatedComposition', composition)).toBe(customized);
    // The kind fixes the encounter: another PerfectClear variant keeps it, another kind drops it.
    expect(
      occurrenceOf(observe(customized, 'PerfectClearChallengeSwitch_MaxHealth')).challengeSwitch
        ?.customization,
    ).toEqual({ generatedComposition: composition });
    expect(
      occurrenceOf(observe(customized, 'TimeChallengeSwitch_Money')).challengeSwitch?.customization,
    ).toBeUndefined();
    // The outcome keeps it.
    expect(
      occurrenceOf(
        applyProjectCommand(customized, catalog, {
          kind: 'ReplaceChallengeSwitchOutcome',
          occurrence: host,
          outcome: 'failed',
          nectarDropped: false,
        }),
      ).challengeSwitch?.customization,
    ).toEqual({ generatedComposition: composition });
    expect(
      occurrenceOf(customize(customized, 'generatedComposition', null)).challengeSwitch,
    ).toEqual(occurrenceOf(observed).challengeSwitch);
    expect(() => customize(observed, 'cocoonCount', composition)).toThrow(
      /cocoonCount is not a declared decision/,
    );
    expect(() =>
      customize(observed, 'generatedComposition', {
        ...composition,
        waves: [{ waveIndex: 1, typeKeys: ['Brute'] }],
      }),
    ).toThrow(/outside its declaration domain/);
    expect(() =>
      customize(
        observe(golden(), 'EliteChallengeSwitch_Talent'),
        'generatedComposition',
        composition,
      ),
    ).toThrow(/not a declared decision/);
    expect(() => customize(golden(), 'generatedComposition', composition)).toThrow(
      /no challenge switch/,
    );
    // Decoding refuses a decision the Elite encounter does not declare.
    expect(() =>
      decodeProjectDocument(
        editOccurrence(customized, 'golden-f-b5-e1', (raw) => {
          raw.challengeSwitch.variantKey = 'EliteChallengeSwitch_Talent';
        }),
        catalog,
      ),
    ).toThrow(/not a declared decision/);
  });

  it('keeps a left press its room’s last action and refuses placing past it', () => {
    const reward = occurrenceOf(golden()).roomActions.order[0]!;
    const pressFirst = applyProjectCommand(
      observe(golden(), 'TimeChallengeSwitch_Money'),
      catalog,
      {
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(fBiome, hostId, roomActionKey(interaction)),
        reference: interaction,
        index: 0,
      },
    );
    const leave = (project: ProjectDocument) =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceChallengeSwitchOutcome',
        occurrence: host,
        outcome: 'left',
        nectarDropped: false,
      });
    // Leaving moves the press last in the same step; its claim rows are gone.
    const history = applyProjectHistoryCommand(createProjectHistory(pressFirst), catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: host,
      outcome: 'left',
      nectarDropped: false,
    });
    expect(history.past).toHaveLength(1);
    const left = history.present;
    expect(occurrenceOf(left).roomActions.order).toEqual([reward, interaction]);
    const move = (project: ProjectDocument, actionKey: string, toIndex: number) =>
      applyProjectCommand(project, catalog, {
        kind: 'MoveRoomAction',
        action: createRoomActionAddress(fBiome, hostId, actionKey),
        toIndex,
      });
    expect(() => move(left, roomActionKey(reward), 1)).toThrow(
      /nothing follows leaving the switch fight/,
    );
    expect(() => move(left, roomActionKey(interaction), 0)).toThrow(
      /nothing follows leaving the switch fight/,
    );
    // Without the press, it can only go in last.
    const unpressed = applyProjectCommand(left, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(fBiome, hostId, roomActionKey(interaction)),
    });
    expect(() =>
      applyProjectCommand(unpressed, catalog, {
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(fBiome, hostId, roomActionKey(interaction)),
        reference: interaction,
        index: 0,
      }),
    ).toThrow(/nothing follows leaving the switch fight/);
    expect(occurrenceOf(insertInteraction(unpressed)).roomActions.order).toEqual([
      reward,
      interaction,
    ]);
    // A preserved order with actions after a left press decodes unchanged.
    const preserved = editOccurrence(left, 'golden-f-b5-e1', (raw) => {
      raw.roomActions.order = [interaction, reward];
    });
    expect(occurrenceOf(decodeProjectDocument(preserved, catalog)).roomActions.order).toEqual([
      interaction,
      reward,
    ]);
    expect(leave(left)).toBe(left);
  });
});
