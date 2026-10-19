import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import { biomeArtwork } from '@planner/ui/artwork/biomes/biomeArtwork';
import { combatRoomArtwork } from '@planner/ui/artwork/combat-rooms/combatRoomArtwork';
import { emptyRoomArtwork } from '@planner/ui/artwork/empty-rooms/emptyRoomArtwork';
import { bossArtwork } from '@planner/ui/artwork/bosses/bossArtwork';
import { boonArtwork } from '@planner/ui/artwork/boons/boonArtwork';
import { clockworkCountdownArtwork } from '@planner/ui/artwork/clockwork/clockworkCountdownArtwork';
import { chaosArtwork } from '@planner/ui/artwork/chaos/chaosArtwork';
import { doorArtwork } from '@planner/ui/artwork/doors/doorArtwork';
import { elementArtwork } from '@planner/ui/artwork/elements/elementArtwork';
import { encounterArtwork } from '@planner/ui/artwork/encounters/encounterArtwork';
import { fountainArtwork } from '@planner/ui/artwork/fountains/fountainArtwork';
import { hubFountainArtwork } from '@planner/ui/artwork/hub-fountains/hubFountainArtwork';
import { otherTraitArtwork } from '@planner/ui/artwork/other-traits/otherTraitArtwork';
import { roomObjectArtwork } from '@planner/ui/artwork/room-objects/roomObjectArtwork';
import { gatheringToolArtwork } from '@planner/ui/artwork/tools/gatheringToolArtwork';
import { enemyArtwork } from '@planner/ui/artwork/enemies/enemyArtwork';
import { fangsPerkArtwork } from '@planner/ui/artwork/fangs/fangsPerkArtwork';
import { hammerArtwork } from '@planner/ui/artwork/hammers/hammerArtwork';
import { hermesBoonArtwork } from '@planner/ui/artwork/hermes/hermesBoonArtwork';
import { hexLayoutArtwork } from '@planner/ui/artwork/hex-layouts/hexLayoutArtwork';
import { hexNodeArtwork } from '@planner/ui/artwork/hex-nodes/hexNodeArtwork';
import { hexSpellArtwork } from '@planner/ui/artwork/hex-spells/hexSpellArtwork';
import { minibossArtwork } from '@planner/ui/artwork/minibosses/minibossArtwork';
import { npcBoonArtwork } from '@planner/ui/artwork/npc-boons/npcBoonArtwork';
import { noRewardArtwork } from '@planner/ui/artwork/no-reward/noRewardArtwork';
import { npcArtwork } from '@planner/ui/artwork/npcs/npcArtwork';
import { rewardArtwork } from '@planner/ui/artwork/rewards/rewardArtwork';
import { traitGiverArtwork } from '@planner/ui/artwork/trait-givers/traitGiverArtwork';
import { wellArtwork } from '@planner/ui/artwork/well/wellArtwork';

const OLYMPIANS = [
  'Aphrodite',
  'Apollo',
  'Ares',
  'Demeter',
  'Hephaestus',
  'Hera',
  'Hestia',
  'Poseidon',
  'Zeus',
];
const NPCS = [
  'Artemis',
  'Athena',
  'Icarus',
  'Arachne',
  'Circe',
  'Dionysus',
  'Echo',
  'Hades',
  'Medea',
  'Narcissus',
];

const traitsOf = (givers: readonly string[]) =>
  catalog.traitGivers.values.filter((g) => givers.includes(g.key)).flatMap((g) => g.traitKeys);

const hexNodeKeys = catalog.hexes.values.flatMap((h) => [
  ...[h.rareCandidates, h.epicCandidates, h.repeatableCandidates].flatMap((c) =>
    c.values.map((n) => n.key),
  ),
  ...(h.godSent ? [h.godSent.olympianTalentKey, h.godSent.lineageTalentKey] : []),
]);

const npcKeys = catalog.encounterDefinitions.values.flatMap((definition) => [
  ...(definition.npcPresentationKey === undefined ? [] : [definition.npcPresentationKey]),
  ...(definition.kind === 'story' && definition.traitOfferProducer !== undefined
    ? [definition.traitOfferProducer.giverKey]
    : []),
]);

const selections = catalog.encounterDefinitions.values.flatMap(
  (definition) => definition.customization?.map((decision) => decision.selection) ?? [],
);
// Enemy keys cover every selectable identity and every Menace replacement target.
const enemyKeys = selections.flatMap((selection): string[] => {
  if (selection.kind === 'infiniteRoster') return selection.choices.map((choice) => choice.key);
  if (selection.kind !== 'generated') return [];
  return [
    ...selection.choices,
    ...selection.fixedEnemies,
    ...(selection.fixedWaves ?? []).flat(),
    ...(selection.generatedSeeds ?? []),
  ].flatMap((choice) => [
    choice.key,
    ...(choice.menace?.kind === 'mapped' ? [choice.menace.targetNativeId] : []),
    ...(choice.menace?.kind === 'random' ? choice.menace.targetNativeIds : []),
  ]);
});
const fangsPerkKeys = selections.flatMap((selection) =>
  selection.kind === 'generated' && selection.fangs !== undefined
    ? Object.keys(selection.fangs.perks)
    : [],
);

const coveredTraitKeys = new Set([
  ...catalog.traitGivers.values.flatMap((g) => g.traitKeys),
  ...[...catalog.chaos.blessings.values, ...catalog.chaos.curses.values].map((x) => x.key),
  ...catalog.hexes.values.map((h) => h.spellTraitKey),
  ...catalog.arcanaCards.values.map((a) => a.traitKey),
  ...catalog.rewards.rewardTypes.values.map((r) => r.gameName),
]);

const roomShop = catalog.rewards.shops.values.find((s) => s.key === 'RoomShop');

// Each record lists every catalog key in its category, with an icon or an explicit null.
const records: [string, Readonly<Record<string, string | null>>, readonly string[]][] = [
  ['boons', boonArtwork, traitsOf(OLYMPIANS)],
  ['hermes', hermesBoonArtwork, traitsOf(['Hermes'])],
  ['hammers', hammerArtwork, traitsOf(['WeaponUpgrade'])],
  ['npc-boons', npcBoonArtwork, traitsOf(NPCS)],
  [
    'chaos',
    chaosArtwork,
    [...catalog.chaos.blessings.values, ...catalog.chaos.curses.values].map((x) => x.key),
  ],
  ['hex-spells', hexSpellArtwork, catalog.hexes.values.map((h) => h.spellTraitKey)],
  [
    'hex-layouts',
    hexLayoutArtwork,
    catalog.hexes.values.flatMap((h) => h.layouts.values.map((l) => l.key)),
  ],
  ['hex-nodes', hexNodeArtwork, hexNodeKeys],
  ['rewards', rewardArtwork, catalog.rewards.rewardTypes.values.map((r) => r.gameName)],
  ['clockwork', clockworkCountdownArtwork, ['0', '1', '2', '3', '4', '5', '6']],
  ['trait-givers', traitGiverArtwork, catalog.traitGivers.values.map((g) => g.key)],
  [
    'well',
    wellArtwork,
    (roomShop?.groups.values ?? []).flatMap((g) => g.options.values.map((o) => o.key)),
  ],
  ['elements', elementArtwork, [...catalog.traitElements]],
  ['npcs', npcArtwork, npcKeys],
  ['no-reward', noRewardArtwork, catalog.biomes.values.map((b) => b.key)],
  ['bosses', bossArtwork, catalog.biomes.values.map((b) => b.key)],
  ['biomes', biomeArtwork, catalog.biomes.values.map((b) => b.key)],
  ['combat-rooms', combatRoomArtwork, catalog.biomes.values.map((b) => b.key)],
  ['empty-rooms', emptyRoomArtwork, catalog.biomes.values.map((b) => b.key)],
  ['doors', doorArtwork, catalog.exitTypes.values.map((e) => e.key)],
  ['enemies', enemyArtwork, enemyKeys],
  [
    'minibosses',
    minibossArtwork,
    catalog.encounterDefinitions.values.filter((d) => d.kind === 'miniboss').map((d) => d.key),
  ],
  ['fangs', fangsPerkArtwork, fangsPerkKeys],
  [
    'room-objects',
    roomObjectArtwork,
    ['stygianWell', 'purgingPool', 'hermesShrine', 'keepsakeRack'],
  ],
  ['fountains', fountainArtwork, catalog.biomes.values.map((b) => b.key)],
  [
    'hub-fountains',
    hubFountainArtwork,
    catalog.rooms.values.filter((r) => r.kind === 'Hub').map((r) => r.roomSetKey),
  ],
  [
    'tools',
    gatheringToolArtwork,
    catalog.rooms.values.flatMap((r) => r.resourcePointSupport?.families ?? []),
  ],
  [
    'encounters',
    encounterArtwork,
    catalog.encounterDefinitions.values
      .filter((d) => d.kind === 'combat' && d.npcPresentationKey === 'Arachne')
      .map((d) => d.key),
  ],
  [
    'other-traits',
    otherTraitArtwork,
    catalog.traits.values.filter((t) => !coveredTraitKeys.has(t.key)).map((t) => t.key),
  ],
];

describe('artwork records', () => {
  it.each(records)('%s marks every catalog key and has no stale keys', (_name, record, keys) => {
    expect(keys.length).toBeGreaterThan(0);
    expect(Object.keys(record).sort()).toEqual([...new Set(keys)].sort());
  });
});
