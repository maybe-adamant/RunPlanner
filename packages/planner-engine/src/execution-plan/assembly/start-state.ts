import type { RunStartPoint } from '../../authored-project/run-modifiers';
import type { Catalog } from '../../catalog-schema';
import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import type {
  StartInstallation,
  StartInstalledTrait,
} from '../../simulation/start-installation/model';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import type {
  ExecutionBiomeKey,
  ExecutionKeepsakeRarity,
  ExecutionRouteKey,
  ExecutionStartKeepsakeTrait,
  ExecutionStartRoomRecord,
  ExecutionStartState,
  ExecutionStartTrait,
  ExecutionStartingLoadout,
  ExecutionTraitRarity,
} from '../model';

/**
 * A Dream run's native history starts with its Dream_Intro prologue, whose
 * SelectNextDreamBiome sets NextRoomSet (RoomDataDream.lua, DreamRunLogic.lua).
 * Native run depth counts it; encounter depth does not, since its encounter is
 * non-combat.
 */
const DREAM_PROLOGUE: readonly ExecutionStartRoomRecord[] = Object.freeze([
  Object.freeze({ name: 'Dream_Intro', nextRoomSet: true as const }),
]);

function missing(detail: string): never {
  throw new CompilerError('executionCoverageMissing', `start state ${detail}`);
}

/** The selected occurrence the run starts in: a biome's first room, or its Preboss. */
function startOccurrence(
  installation: StartInstallation,
  selectedOccurrenceIds: readonly string[],
  roomById: ReadonlyMap<string, CanonicalAuthoredRoom>,
): CanonicalAuthoredRoom {
  const { biomeKey, kind } = installation.startPoint;
  const id =
    kind === 'preboss'
      ? installation.startOccurrence?.occurrenceId
      : selectedOccurrenceIds.find(
          (candidate) => roomById.get(candidate)?.origin.biomeKey === biomeKey,
        );
  const room = id === undefined ? undefined : roomById.get(id);
  if (room === undefined || !selectedOccurrenceIds.includes(room.occurrenceId))
    missing(`${biomeKey} ${kind} occurrence is not selected`);
  if (
    room.origin.biomeKey !== biomeKey ||
    room.gameName !== installation.startRoomGameName ||
    (kind === 'preboss' && room.roomKind !== 'Preboss')
  )
    missing(`${room.occurrenceId} is not the ${biomeKey} ${kind}`);
  return room;
}

function traitRow(
  trait: StartInstalledTrait,
  durationHammers: ReadonlyMap<string, number>,
  grantedTraitKey: string | undefined,
): ExecutionStartTrait {
  const rarity: ExecutionTraitRarity | undefined =
    trait.hammerRank === 'RankII' ? 'Legendary' : trait.rarity;
  const decay = trait.roomDecay;
  if (decay !== undefined && decay.startMaxima === undefined)
    missing(`${trait.traitKey} lacks its acquisition maxima`);
  const currentRoom =
    trait.steadyGrowthProgress ??
    trait.roomsPerUpgradeGrowth?.progress ??
    trait.pickupProducerProgress;
  const hammerUses = durationHammers.get(trait.traitKey);
  return Object.freeze({
    name: trait.traitKey,
    ...(rarity === undefined ? {} : { rarity }),
    ...(trait.level === undefined ? {} : { stackNum: trait.level }),
    ...(trait.rarityBlockedInRun === true ? { blockInRunRarify: true as const } : {}),
    ...(trait.upgradedTraitKey === undefined ? {} : { upgradedTraitName: trait.upgradedTraitKey }),
    ...(trait.selectedSlotTraitKey === undefined
      ? {}
      : { selectedTrait: trait.selectedSlotTraitKey }),
    ...(grantedTraitKey === trait.traitKey ? { grantedTrait: true as const } : {}),
    ...(trait.echoRepeatedKeepsakeKey === undefined
      ? {}
      : { repeatedKeepsake: trait.echoRepeatedKeepsakeKey }),
    ...(currentRoom === undefined ? {} : { currentRoom }),
    ...(trait.pickupProducerInterval === undefined
      ? {}
      : { roomsPerUpgradeAmount: trait.pickupProducerInterval }),
    ...(trait.roomsPerUpgradeGrowth === undefined
      ? {}
      : { roomsPerUpgradeMaxMana: trait.roomsPerUpgradeGrowth.maxManaPerGrant }),
    ...(decay?.startMaxima === undefined
      ? {}
      : {
          echoIncreaseStats: Object.freeze({
            statMultiplier: decay.fraction,
            blockDecay: decay.blocked,
            startMaxHealth: decay.startMaxima.maxHealth,
            startMaxMana: decay.startMaxima.maxMana,
          }),
        }),
    ...(hammerUses === undefined ? {} : { durationHammerUses: hammerUses }),
  });
}

/** Installed traits, less those native `StartNewRun` installs and the Spell, which `hex` carries. */
function traits(installation: StartInstallation): readonly ExecutionStartTrait[] {
  const { keepsake } = installation;
  const spell = installation.hex.spellTraitKey;
  const durationHammers = new Map(
    keepsake.experimentalHammers
      .filter((hammer) => hammer.active)
      .map((hammer) => [hammer.traitKey, hammer.remainingUses] as const),
  );
  const installed = installation.traits.filter(
    (trait) => trait.grantedByRunStart !== true && trait.traitKey !== spell,
  );
  for (const traitKey of durationHammers.keys())
    if (!installed.some((trait) => trait.traitKey === traitKey))
      missing(`Experimental Hammer ${traitKey} is not held`);
  const granted =
    keepsake.jeweledPom?.active === true ? keepsake.jeweledPom.grantedTraitKey : undefined;
  const spellTrait = installation.traits.find((trait) => trait.traitKey === spell);
  if (
    spellTrait !== undefined &&
    Object.keys(traitRow(spellTrait, durationHammers, granted)).length > 1
  )
    missing(`${spell} carries per-instance fields the Hex section does not`);
  return Object.freeze(installed.map((trait) => traitRow(trait, durationHammers, granted)));
}

type KeepsakeCounters = Omit<ExecutionStartKeepsakeTrait, 'name' | 'rarity' | 'slotted'>;

/** The per-instance counters of one held keepsake, renamed to its native fields. */
function keepsakeCounters(
  catalog: Catalog,
  keepsake: StartInstallation['keepsake'],
  key: string,
): KeepsakeCounters {
  const one = (status: string) => (status === 'pending' ? 1 : 0);
  const effect = catalog.keepsakes.byKey[key]?.effect;
  switch (effect?.kind) {
    case 'olympianRewardPressure': {
      const source = keepsake.olympianSources.find((entry) => entry.keepsakeKey === key);
      return source === undefined
        ? {}
        : { uses: source.remainingForceUses, rarityUpgradeUses: source.remainingRarificationUses };
    }
    case 'callingCard':
      return keepsake.callingCard === undefined
        ? {}
        : { rarityUpgradeUses: keepsake.callingCard.remainingCharges };
    case 'timePiece':
      return keepsake.timePiece === undefined
        ? {}
        : { boonConversionUses: keepsake.timePiece.remainingCharges };
    case 'discordantBell':
      return keepsake.discordantBell === undefined
        ? {}
        : { escalatingKeepsakeValue: keepsake.discordantBell.multiplier };
    case 'lionFang':
      return keepsake.lionFang === undefined
        ? {}
        : { currentKeepsakeDamageBonus: keepsake.lionFang.multiplier };
    case 'gorgonAmulet':
      return keepsake.gorgon === undefined ? {} : { remainingUses: one(keepsake.gorgon.status) };
    case 'crystalFigurine':
      return keepsake.figurine === undefined
        ? {}
        : { remainingUses: one(keepsake.figurine.status) };
    case 'concaveStone':
      return keepsake.stone === undefined ? {} : { uses: one(keepsake.stone.status) };
    case 'fountainRarity':
      return keepsake.phial === undefined ? {} : { uses: one(keepsake.phial.status) };
    case 'transcendentEmbryo':
      return keepsake.transcendentEmbryo === undefined
        ? {}
        : { currentRoom: keepsake.transcendentEmbryo.progress };
    case 'maxHealthCap':
      return keepsake.maxHealthCap?.keepsakeKey !== key
        ? {}
        : { uses: keepsake.maxHealthCap.status === 'active' ? 1 : 0 };
    default:
      return {};
  }
}

function keepsakeState(
  catalog: Catalog,
  keepsake: StartInstallation['keepsake'],
): ExecutionStartState['keepsake'] {
  const slotted = keepsake.held.filter((row) => row.slotted);
  if (slotted.map((row) => row.key).join() !== (keepsake.currentKey ?? ''))
    missing('held keepsakes disagree with the slotted keepsake');
  return Object.freeze({
    keepsakeCache: keepsake.usedKeys,
    blockedKeepsakes: keepsake.removedKeys,
    traits: Object.freeze(
      keepsake.held.map((row) =>
        Object.freeze({
          name: row.key,
          rarity: row.rank satisfies ExecutionKeepsakeRarity,
          ...(row.slotted ? { slotted: true as const } : {}),
          ...keepsakeCounters(catalog, keepsake, row.key),
        }),
      ),
    ),
    ...(keepsake.figLeafRemainingUses === undefined
      ? {}
      : {
          persistentDionysusSkip: Object.freeze({ remainingUses: keepsake.figLeafRemainingUses }),
        }),
  });
}

function hex(catalog: Catalog, value: StartInstallation['hex']): ExecutionStartState['hex'] {
  const spellTraitName = value.spellTraitKey;
  if (spellTraitName === undefined) {
    if (value.tree !== undefined || value.investedNodeKeys.length > 0 || value.talentPoints > 0)
      missing('holds Hex progress without a Spell');
    return undefined;
  }
  const godSent =
    value.godSentAdded === true ? catalog.hexes.byKey[spellTraitName]?.godSent : undefined;
  if (value.godSentAdded === true && godSent === undefined)
    missing(`${spellTraitName} has no God Sent declaration`);
  return Object.freeze({
    spellTraitName,
    ...(value.tree === undefined
      ? {}
      : {
          tree: Object.freeze({
            layoutKey: value.tree.layoutKey,
            nodes: value.tree.nodes,
            ...(godSent === undefined
              ? {}
              : {
                  godSent: Object.freeze({
                    olympianTalentKey: godSent.olympianTalentKey,
                    lineageTalentKey: godSent.lineageTalentKey,
                  }),
                }),
          }),
        }),
    investedNodes: value.investedNodeKeys,
    talentPoints: value.talentPoints,
    allSpellInvested: value.talentDropsClosed === true,
  });
}

/**
 * Translates the engine's start installation into the native terms the game
 * module installs, selecting and renaming the engine's facts.
 */
export function executionStartState(
  catalog: Catalog,
  routeKey: ExecutionRouteKey,
  startPoint: RunStartPoint,
  installation: StartInstallation,
  selectedOccurrenceIds: readonly string[],
  roomById: ReadonlyMap<string, CanonicalAuthoredRoom>,
  startingLoadout: ExecutionStartingLoadout,
): ExecutionStartState {
  const room = startOccurrence(installation, selectedOccurrenceIds, roomById);
  const { equipment, counters, route, biomeRecords, arcana } = installation;
  if (route.enteredBiomes !== route.visitedBiomeKeys.length)
    missing('entered biomes disagree with the visit order');
  if (
    equipment.weaponKey !== startingLoadout.weaponKey ||
    (equipment.aspectKey ?? undefined) !== startingLoadout.aspectKey
  )
    missing('equipment disagrees with the starting loadout');
  const preboss = installation.startPoint.kind === 'preboss';
  if (biomeRecords.form !== (preboss ? 'current' : 'postReset'))
    missing('biome records are not in their start form');
  const temporaryCards = new Set(
    arcana.active.filter((card) => card.origin === 'temporary').map((card) => card.key),
  );
  const artificerCard = catalog.arcanaCards.values.find(
    (card) => card.artificerCapacityByRarity !== undefined,
  )?.key;
  const { maxStats } = installation;
  const prologue = routeKey === 'Dream' ? DREAM_PROLOGUE : [];
  return Object.freeze({
    point: installation.startPoint.kind,
    biomeKey: installation.startPoint.biomeKey as ExecutionBiomeKey,
    occurrenceId: room.occurrenceId,
    roomName: room.gameName,
    gold: startPoint.gold ?? 0,
    biomeVisitOrder: route.visitedBiomeKeys,
    roomHistory: Object.freeze([
      ...prologue,
      ...installation.roomHistory.map((record) =>
        Object.freeze({
          name: record.gameName,
          ...(record.nextRoomSet ? { nextRoomSet: true as const } : {}),
        }),
      ),
    ]),
    encounterDepth: counters.routeEncounterDepth,
    ...(counters.lastDevotionDepth === undefined
      ? {}
      : { lastDevotionDepth: counters.lastDevotionDepth + prologue.length }),
    ...(preboss
      ? {
          biome: Object.freeze({
            biomeDepthCache: counters.biomeDepthCache,
            biomeEncounterDepth: counters.biomeEncounterDepth,
            biomeUseRecord: biomeRecords.biomeUseRecord,
            forfeitConsumed: biomeRecords.forfeitConsumed,
            dionysusSkipActivated: biomeRecords.figLeafActivatedThisBiome,
            ...(counters.clockwork === undefined
              ? {}
              : {
                  clockwork: Object.freeze({
                    remainingClockworkGoals: counters.clockwork.goalsRemaining,
                    maxClockworkNonGoalRewards: counters.clockwork.maxNonGoalRewards,
                  }),
                }),
          }),
        }
      : {}),
    aspectPerfect: equipment.aspectPerfect,
    ...(equipment.familiarKey === null
      ? {}
      : {
          familiar: Object.freeze({
            name: equipment.familiarKey,
            stackMultiplier: equipment.familiarStackMultiplier,
          }),
        }),
    traits: traits(installation),
    chaosCurses: Object.freeze(
      installation.chaos.active.map((curse) =>
        Object.freeze({
          name: curse.curseKey,
          remainingUses: curse.remaining,
          curseValues: curse.curseValues,
          blessing: Object.freeze({
            name: curse.blessingKey,
            rarity: curse.rarity,
            blessingValues: curse.blessingValues,
          }),
        }),
      ),
    ),
    chaosBlessings: Object.freeze(
      installation.chaos.matured.map((blessing) =>
        Object.freeze({
          name: blessing.blessingKey,
          rarity: blessing.rarity,
          blessingValues: blessing.blessingValues,
          ...(blessing.fromChaosKeepsake ? { fromChaosKeepsake: true as const } : {}),
        }),
      ),
    ),
    keepsake: keepsakeState(catalog, installation.keepsake),
    arcana: Object.freeze(
      arcana.active.map((card) => {
        const growth = arcana.roomEntryGrowth[card.key];
        return Object.freeze({
          name: card.key,
          rarity: card.rarity,
          ...(temporaryCards.has(card.key) ? { temporary: true as const } : {}),
          ...(growth === undefined ? {} : { currentRoom: growth.progress }),
          ...(card.key === artificerCard && arcana.artificer !== undefined
            ? { metaConversionUses: arcana.artificer.remainingCount }
            : {}),
        });
      }),
    ),
    arcanaBarren: arcana.barrenActive,
    disabledVows: installation.fear.disabledVowKeys,
    maxStats: Object.freeze({
      maxHealth: maxStats.maxHealth,
      maxMana: maxStats.maxMana,
      hiddenGrants: Object.freeze(
        maxStats.grants.map(({ source, maxHealth, maxMana }) =>
          Object.freeze({ source: Object.freeze({ ...source }), maxHealth, maxMana }),
        ),
      ),
    }),
    stygianWell: Object.freeze({
      timedTraits: Object.freeze(
        installation.stygianWell.timedInstances.map(({ traitKey, clock, remainingUses }) =>
          Object.freeze({ name: traitKey, clock, remainingUses }),
        ),
      ),
      sparkUses: installation.stygianWell.sparkUses,
      yarnUses: installation.stygianWell.yarnUses,
      hymnUses: installation.stygianWell.hymnUses,
      extendedUses: installation.stygianWell.extendedUses,
      wellShopPurchases: installation.stygianWell.directPurchases,
    }),
    hermesDeliveries: Object.freeze(
      installation.hermesDeliveries.map(({ rewardType, remainingUses }) =>
        Object.freeze({ rewardType, remainingUses }),
      ),
    ),
    ...(() => {
      const value = hex(catalog, installation.hex);
      return value === undefined ? {} : { hex: value };
    })(),
    rewardPriorities: installation.rewardPriorities,
    useRecord: installation.runRecords.useRecord,
    lootTypeHistory: installation.runRecords.lootTypeHistory,
    consumableRecord: installation.runRecords.consumableRecord,
    rewardStores: Object.freeze(
      installation.rewardStores.stores.map(({ storeKey, remainingEntryCounts }) =>
        Object.freeze({ name: storeKey, remainingEntryCounts }),
      ),
    ),
  });
}
