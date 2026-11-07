import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createNemesisRandomEventAddress,
  createOccurrenceId,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createRoomActionAddress,
  rerollAppendIndex,
  roomActionKey,
  type AuthoredNemesisRandomEventOutcome,
} from '@run-planner/engine/authored-project';
import {
  loadDreamHeraArtificerEchoCheckpoint,
  loadDreamMixedHandoffCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/dream';
import {
  loadSurfaceAnvilCheckpoint,
  loadSurfaceEncounterShowcaseCheckpoint,
  loadSurfaceNCheckpoint,
  loadSurfaceNOPQCheckpoint,
  loadSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceNPhialIntermediateFountainCheckpoint,
  loadSurfaceNResourcesCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
  loadSurfaceSeleneHexPathCheckpoint,
  loadSurfaceShrineTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadNemesisFieldsCheckpoint,
  loadNemesisPomSeaStarCheckpoint,
  loadNemesisTraitTradeCheckpoint,
  loadUnderworldAutomaticBossCheckpoint,
  loadUnderworldFGCheckpoint,
  loadUnderworldFGHICheckpoint,
  loadUnderworldFPoolCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
  loadUnderworldFigLeafCheckpoint,
  loadUnderworldGAnomalyRosterCheckpoint,
  loadUnderworldGorgonAthenaCheckpoint,
  loadUnderworldIxionChaosCheckpoint,
  loadUnderworldTwistScyllaCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
  loadUnderworldZagreusContractCheckpoint,
  underworldCheckpointArtifacts,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { catalog } from '@run-planner/hades2-catalog';
import {
  roomObjectAnchorSlotsForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type RoomAnchorObjectKind,
} from '@run-planner/engine/simulation';
import { createFreshFileRouteProject } from '@run-planner/test-fixtures/fresh-file';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { createReachableNaturalChaosProject } from '../structured-workspace/interaction-binding.test-support';
import {
  appendRoomAction,
  authoredOccurrence,
  hub,
  occurrenceAddress,
  room,
  withoutRoomActionOrder,
  type GalleryCase,
  type GalleryStep,
} from './galleryCase';

/** Adds an object on a free anchor through the engine's own placement command. */
function placeAnchorObject(
  biomeKey: string,
  occurrenceId: string,
  kind: RoomAnchorObjectKind,
): GalleryStep {
  return (project) => {
    const place = roomObjectAnchorSlotsForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, project),
      occurrenceAddress(project, biomeKey, occurrenceId),
    )?.objects.find((object) => object.kind === kind)?.place;
    if (place === undefined) throw new Error(`${occurrenceId} cannot place ${kind}`);
    return place;
  };
}

// The trait-order-checks F rooms carry generated ids.
const loadTraitOrderChecks = underworldCheckpointArtifacts['underworld-f-trait-order-checks'].load;
const traitOrderChecks = {
  artificerCombat: 'e9c1775e-a04b-4ed2-b749-7ef344614cbe',
  preboss: 'e157e3cb-37ae-40d9-92b0-f22621b672c3',
} as const;

// A plain F combat room that Nemesis takes over in the family cases.
const nemesisPhase = createEncounterPhaseAddress(
  createBiomeAddress('Underworld', 'F'),
  { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-f-b5-e1') },
  'Encounter',
);

/** One case per Nemesis event family, each with its setup row and end outcome. */
function nemesisFamilyCases(): readonly GalleryCase[] {
  const event = createNemesisRandomEventAddress(nemesisPhase);
  const entry = (
    id: string,
    label: string,
    value: AuthoredNemesisRandomEventOutcome,
  ): GalleryCase => ({
    id,
    label,
    shows: ['Nemesis setup row', 'encounter end outcome'],
    project: loadUnderworldFGCheckpoint,
    commands: [
      { kind: 'SelectEncounter', phase: nemesisPhase, encounterKey: 'NemesisRandomEvent' },
      { kind: 'SelectNemesisRandomEventFamily', event, family: value.kind },
      { kind: 'ReplaceNemesisRandomEventInteraction', event, value: { ...value, reward: null } },
    ],
    target: room('F', 'golden-f-b5-e1'),
  });
  return [
    entry('nemesis-free-item', 'Nemesis free item', { kind: 'freeItem' }),
    entry('nemesis-gold-trade', 'Nemesis gold trade, declined', {
      kind: 'goldTrade',
      response: 'decline',
    }),
    entry('nemesis-damage-trade', 'Nemesis damage trade', {
      kind: 'damageTrade',
      response: 'accept',
    }),
    entry('nemesis-damage-contest', 'Nemesis damage contest', {
      kind: 'damageContest',
      result: 'success',
    }),
    entry('nemesis-damage-contest-failed', 'Nemesis damage contest, failed', {
      kind: 'damageContest',
      result: 'failure',
    }),
  ];
}

/**
 * Every Timeline gallery case, in page order. Adding a case is one entry: a project builder
 * (a checkpoint or route fixture), optional semantic commands, and the room or Hub it opens.
 */
export const galleryCases: readonly GalleryCase[] = [
  // Rewards and their offers.
  {
    id: 'boon-offer-picked',
    label: 'Incoming boon with its offer picked',
    shows: [
      'room entered',
      'encounter start/end',
      'incoming reward',
      'trait offer picked + dimmed',
    ],
    project: loadUnderworldFGCheckpoint,
    target: room('F', 'golden-f-start'),
  },
  {
    id: 'boon-offer-unset',
    label: 'Incoming boon whose offer is not chosen yet',
    shows: ['incoming reward', 'trait offer unset', 'stale repair row', 'later rooms waiting'],
    project: loadUnderworldFGCheckpoint,
    commands: [
      {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-b1-e1'),
        ),
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
      },
    ],
    target: room('F', 'golden-f-b1-e1'),
  },
  {
    id: 'stale-incoming-reward',
    label: 'Stale incoming reward kept for repair',
    shows: ['Timeline repairs (stale row)', 'finding'],
    project: loadUnderworldFGCheckpoint,
    target: room('G', 'golden-g-b1-e1'),
  },
  {
    id: 'required-unplaced',
    label: 'Required reward pickup not placed',
    shows: ['Timeline repairs (required unplaced)', 'Restore required action'],
    project: () => withoutRoomActionOrder(loadUnderworldFGCheckpoint(), 'F', 'golden-f-b1-e1'),
    target: room('F', 'golden-f-b1-e1'),
  },
  {
    id: 'artificer-transform',
    label: 'Artificer transform beside an incoming reward',
    shows: ['Artificer/Transform outcome', 'generated pickup'],
    project: loadTraitOrderChecks,
    target: room('F', traitOrderChecks.artificerCombat),
  },
  {
    id: 'chaos-offer',
    label: 'Chaos room: Chaos blessing offer',
    shows: ['Chaos offer'],
    project: loadUnderworldIxionChaosCheckpoint,
    target: room('G', 'golden-g-intro:chaos'),
  },
  {
    id: 'chaos-time-piece',
    label: 'Chaos reward taken as Goldify · Time Piece',
    shows: ['Time Piece / Goldify outcome', 'waiting on earlier choice'],
    project: createReachableNaturalChaosProject,
    commands: [
      {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey: 'GoldifyKeepsake',
      },
      {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: createAcquisitionRoleAddress(
          createIncomingRewardAddress(
            createBiomeAddress('Underworld', 'F'),
            createOccurrenceId('fixture-chaos-room'),
          ),
          'self',
        ),
        value: { kind: 'timePiece' },
      },
    ],
    target: room('F', 'fixture-chaos-room'),
  },
  {
    id: 'hex-path-of-stars',
    label: "Selene's Gift: Hex spell offer and Path of Stars",
    shows: ['Hex spell offer', 'Path of Stars'],
    project: loadSurfaceSeleneHexPathCheckpoint,
    target: room('N', 'surface-n-combat09'),
  },
  {
    id: 'gorgon-athena',
    label: 'Gorgon Athena offer',
    shows: ['Gorgon offer', 'encounter start with Gorgon'],
    project: loadUnderworldGorgonAthenaCheckpoint,
    target: room('G', 'golden-g-b1-e1'),
  },
  {
    id: 'fig-leaf-skip',
    label: 'Encounter start with a Fig Leaf skip',
    shows: ['encounter start with Fig Leaf'],
    project: loadUnderworldFigLeafCheckpoint,
    target: room('F', 'golden-f-b2-e1'),
  },
  {
    id: 'pom-sea-star-nemesis',
    label: 'Nemesis Pom trade with Sea Star Double Up',
    shows: ['Nemesis event row', 'Pom', 'Double Up'],
    project: loadNemesisPomSeaStarCheckpoint,
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'nemesis-trait-trade',
    label: 'Nemesis trait trade',
    shows: ['Nemesis event row', 'generated pickup'],
    project: loadNemesisTraitTradeCheckpoint,
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'nemesis-fields',
    overview: true,
    label: 'Nemesis in a Fields room',
    shows: ['Nemesis event row', 'Fields cages'],
    project: loadNemesisFieldsCheckpoint,
    target: room('H', 'golden-h-combat05'),
  },
  ...nemesisFamilyCases(),
  {
    id: 'nemesis-bet',
    label: 'Nemesis combat with its kill-race bet',
    shows: ['encounter end outcome (bet)'],
    project: loadUnderworldFGCheckpoint,
    commands: [
      {
        kind: 'SelectEncounter',
        phase: nemesisPhase,
        encounterKey: 'NemesisCombatF',
      },
    ],
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'anvil-removed',
    label: 'World Shop Anvil purchase with its removed trait',
    shows: ['shop purchase', 'Anvil (removed)'],
    project: loadSurfaceAnvilCheckpoint,
    target: room('Q', 'surface-q-preboss'),
  },
  // Rooms and lifecycle.
  {
    id: 'fields-cages',
    overview: true,
    label: 'Fields room: cage clears, cage order and cage rewards',
    shows: ['Fields cage clear', 'Fields cage order', 'local reward per cage'],
    project: loadUnderworldFGHICheckpoint,
    target: room('H', 'golden-h-combat09'),
  },
  {
    id: 'boss-steady-growth',
    label: 'Boss room: required boss reward and Steady Growth',
    shows: ['boss defeated', 'collect required reward (boss)', 'Steady Growth'],
    project: loadSurfaceScheduledLifecycleCheckpoint,
    target: room('O', 'surface-o-preboss:boss'),
  },
  {
    id: 'boss-dream-shiny-stars',
    label: 'Dream boss room: Shiny Stars ramped by route position',
    shows: ['collect required reward (Dream boss)'],
    project: loadDreamMixedHandoffCheckpoint,
    target: room('N', 'dream-n-preboss:boss'),
  },
  {
    id: 'boss-zagreus-gemstones',
    label: 'Zagreus contract room: Gemstones',
    shows: ['collect required reward (Zagreus)'],
    project: loadUnderworldZagreusContractCheckpoint,
    target: room('G', 'zagreus-contract-showcase'),
  },
  {
    id: 'boss-judgment-figurine',
    label: 'Boss room: Judgment and Crystal Figurine',
    shows: ['boss defeated', 'Judgment/Figurine'],
    project: loadUnderworldAutomaticBossCheckpoint,
    target: room('F', 'golden-f-preboss-shop:boss'),
  },
  {
    id: 'transcendent-embryo',
    label: 'Transcendent Embryo outcome',
    shows: ['Transcendent Embryo'],
    project: loadSurfaceScheduledLifecycleCheckpoint,
    target: room('N', 'surface-n-combat03'),
  },
  {
    id: 'wheel-next-phase',
    label: 'Wheel room: select wheel, wheel reward and next phase',
    shows: ['select wheel', 'wheel reward', 'next phase'],
    project: loadSurfaceEncounterShowcaseCheckpoint,
    target: room('O', 'surface-o-combat04'),
  },
  {
    id: 'anomaly-encounter-end',
    label: 'Anomaly encounter end',
    shows: ['encounter end supplement'],
    project: loadUnderworldGAnomalyRosterCheckpoint,
    target: room('G', 'golden-g-b3-e2'),
  },
  {
    id: 'talk-narcissus',
    label: 'Narcissus: Talk with its optional pickup',
    shows: ['Talk (NPC)', 'optional action in the Add area'],
    project: loadUnderworldFGCheckpoint,
    target: room('G', 'golden-g-b3-e1'),
  },
  {
    id: 'talk-circe',
    label: 'Circe story room',
    shows: ['Talk (NPC) with offer'],
    project: loadSurfaceEncounterShowcaseCheckpoint,
    target: room('O', 'surface-o-story'),
  },
  {
    id: 'echo',
    label: 'Echo room',
    shows: ['Echo', 'generated pickup'],
    project: loadDreamHeraArtificerEchoCheckpoint,
    target: room('H', '78369aea-a352-409f-9ab6-0694e96e0339'),
  },
  {
    id: 'eris',
    label: 'Eris spawned in an entrance',
    shows: ['Eris'],
    project: createFreshFileRouteProject,
    target: room('G', 'golden-g-intro'),
  },
  {
    id: 'challenge-switch',
    overview: true,
    label: 'Challenge switch used after the doors open',
    shows: ['challenge switch'],
    project: createGoldenFGHIProject,
    commands: [
      (project) => ({
        kind: 'ReplaceChallengeSwitch',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-b5-e1'),
        variantKey: 'TimeChallengeSwitch_Money',
      }),
      appendRoomAction('F', 'golden-f-b5-e1', { kind: 'interactChallengeSwitch' }),
    ],
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'anchors-well-switch',
    overview: true,
    label: 'Two anchors holding a Stygian Well and a challenge switch',
    shows: ['anchor slots', 'Well inventory', 'challenge switch'],
    project: createGoldenFGHIProject,
    commands: [
      placeAnchorObject('F', 'golden-f-b5-e1', 'challengeSwitch'),
      placeAnchorObject('F', 'golden-f-b5-e1', 'stygianWell'),
    ],
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'anchors-shrine-switch',
    overview: true,
    label: 'Two anchors holding a Hermes Shrine and a challenge switch',
    shows: ['anchor slots', 'Shrine inventory', 'challenge switch'],
    project: loadSurfaceNOPQCheckpoint,
    commands: [
      placeAnchorObject('O', 'surface-o-combat02', 'challengeSwitch'),
      placeAnchorObject('O', 'surface-o-combat02', 'hermesShrine'),
    ],
    target: room('O', 'surface-o-combat02'),
  },
  {
    id: 'anchors-postboss-shrine',
    overview: true,
    label: 'Postboss: forced Hermes Shrine on its anchor',
    shows: ['fixed anchor object', 'Shrine inventory'],
    project: loadSurfaceNOPQCheckpoint,
    target: room('O', 'surface-o-preboss:postboss'),
  },
  {
    id: 'unlock-exit',
    overview: true,
    doorsExpanded: true,
    label: 'Locked door pressed open',
    shows: ['unlock exit'],
    project: createGoldenFGHIProject,
    commands: [
      (project) => ({
        kind: 'ReplaceLockedExit',
        occurrence: occurrenceAddress(project, 'G', 'golden-g-b1-e1'),
        exitKey: 'exit2',
        locked: true,
      }),
      appendRoomAction('G', 'golden-g-b1-e1', { kind: 'unlockExit', exitKey: 'exit2' }),
    ],
    target: room('G', 'golden-g-b1-e1'),
  },
  {
    id: 'door-reroll',
    label: 'Door reroll',
    shows: ['door reroll'],
    project: loadUnderworldFGCheckpoint,
    commands: [
      {
        kind: 'ReplaceManualArcanaSelection',
        route: createRouteAddress('Underworld'),
        arcanaKeys: ['DoorReroll'],
      },
      (project) => ({
        kind: 'InsertReroll',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-b2-e1'),
        target: {
          kind: 'door',
          exitKey: 'exit1',
          occurrenceId: createOccurrenceId('golden-f-b3-e1'),
        },
        reward: { rewardType: 'StackUpgrade' },
        index: authoredOccurrence(project, 'F', 'golden-f-b2-e1').roomActions.order.length,
      }),
    ],
    target: room('F', 'golden-f-b2-e1'),
  },
  {
    id: 'plan-end',
    label: 'Plan ends in this room',
    shows: ['leave row', 'End plan'],
    project: loadUnderworldFGCheckpoint,
    commands: [
      {
        kind: 'ReplacePlanEnd',
        route: createRouteAddress('Underworld'),
        planEnd: { biomeKey: 'F', occurrenceId: createOccurrenceId('golden-f-b3-e1') },
      },
    ],
    target: room('F', 'golden-f-b3-e1'),
  },
  // Shops and room objects.
  {
    id: 'world-shop-travel-deal',
    overview: true,
    label: 'World Shop purchase with a Travel Deal refill',
    shows: ['shop purchase + affordability', 'Travel Deal continuation'],
    project: loadUnderworldWorldShopTravelDealCheckpoint,
    target: room('F', 'golden-f-preboss-shop'),
  },
  {
    id: 'pedestal-mystery-boon',
    overview: true,
    label: 'Pedestal Mystery Boon and shop purchases',
    shows: ['Pedestal', 'Mystery Boon god picker', 'shop purchase', 'Travel Deal'],
    project: loadTraitOrderChecks,
    target: room('F', traitOrderChecks.preboss),
  },
  {
    id: 'pedestal-contract',
    overview: true,
    label: 'Pedestal after a Zagreus Contract',
    shows: ['Pedestal'],
    project: loadUnderworldZagreusContractCheckpoint,
    target: room('G', 'zagreus-contract-preboss-shop'),
  },
  {
    id: 'resource-placed-elsewhere',
    overview: true,
    label: 'Resources placed in other rooms',
    shows: ['resource placed elsewhere', 'resource unavailable here'],
    project: loadSurfaceNResourcesCheckpoint,
    target: room('N', 'surface-n-opening'),
  },
  {
    id: 'well-twist',
    overview: true,
    label: 'Stygian Well purchases with a Fateful Twist',
    shows: ['Well purchase', 'Fateful Twist', 'fountain + Phial', 'Keepsake Rack'],
    project: loadUnderworldTwistScyllaCheckpoint,
    target: room('F', 'golden-f-preboss-shop:postboss'),
  },
  {
    id: 'room-phial-fountain',
    label: 'Room fountain with its Phial target',
    shows: ['fountain + Phial target'],
    project: loadUnderworldTwistScyllaCheckpoint,
    commands: [
      {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey: 'FountainRarityKeepsake',
      },
      {
        kind: 'ReplaceFountainRarityTarget',
        outcome: createFountainRarityOutcomeAddress(
          createRoomActionAddress(
            createBiomeAddress('Underworld', 'F'),
            createOccurrenceId('golden-f-preboss-shop:postboss'),
            roomActionKey({ kind: 'useFountain' }),
          ),
        ),
        targetTraitKey: 'ApolloWeaponBoon',
      },
    ],
    target: room('F', 'golden-f-preboss-shop:postboss'),
  },
  {
    id: 'well-pool-rerolls',
    overview: true,
    label: 'Well and Pool rerolls',
    shows: ['Well reroll', 'Pool reroll', 'Well purchase'],
    project: loadUnderworldFStygianWellCheckpoint,
    commands: [
      // The Boss's Judgment holds the screen-reroll card, so both objects can reroll.
      {
        kind: 'ReplaceManualArcanaSelection',
        route: createRouteAddress('Underworld'),
        arcanaKeys: ['DoorReroll'],
      },
      {
        kind: 'ReplaceJudgmentArcana',
        judgment: {
          kind: 'judgmentArcana',
          routeKey: 'Underworld',
          biomeKey: 'F',
          occurrenceId: createOccurrenceId('golden-f-preboss-shop:boss'),
          phaseKey: 'Encounter',
        },
        arcanaKeys: ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
      },
      (project) => ({
        kind: 'InsertStygianWellReroll',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-preboss-shop:postboss'),
        index: authoredOccurrence(project, 'F', 'golden-f-preboss-shop:postboss').roomActions.order
          .length,
      }),
      (project) => ({
        kind: 'InsertPurgingPoolReroll',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-preboss-shop:postboss'),
        index: authoredOccurrence(project, 'F', 'golden-f-preboss-shop:postboss').roomActions.order
          .length,
      }),
    ],
    target: room('F', 'golden-f-preboss-shop:postboss'),
  },
  {
    id: 'pool-sell',
    overview: true,
    label: 'Purging Pool sales',
    shows: ['Pool sell'],
    project: loadUnderworldFPoolCheckpoint,
    target: room('F', 'golden-f-preboss-shop:postboss'),
  },
  {
    id: 'shrine-rush-travel-deal',
    overview: true,
    label: 'Postboss: Hermes Shrine rush and Travel Deal',
    shows: ['fountain + Phial', 'Keepsake Rack', 'Hermes Shrine rush', 'Travel Deal'],
    project: loadSurfaceShrineTravelDealCheckpoint,
    target: room('N', 'surface-n-preboss:postboss'),
  },
  {
    id: 'shrine-purchases',
    overview: true,
    label: 'Hermes Shrine purchases in a wheel room',
    shows: ['Hermes Shrine purchase', 'Hermes Shrine rush', 'select wheel'],
    project: loadSurfaceNOHermesShrineDeliveryCheckpoint,
    target: room('O', 'surface-o-combat07'),
  },
  {
    id: 'shrine-delivery',
    overview: true,
    label: 'Hermes Shrine delivery placed',
    shows: ['Hermes Shrine delivery'],
    project: loadSurfaceNOHermesShrineDeliveryCheckpoint,
    target: room('O', 'surface-o-devotion'),
  },
  {
    id: 'shrine-delivery-unplaced',
    label: 'Hermes Shrine delivery not placed',
    shows: ['Hermes Shrine delivery', 'required unplaced'],
    project: loadSurfaceNOHermesShrineDeliveryCheckpoint,
    commands: [
      (project) => {
        const delivery = authoredOccurrence(
          project,
          'O',
          'surface-o-devotion',
        ).roomActions.order.find(
          (reference) =>
            reference.kind === 'interactAcquisitionEntry' &&
            reference.siteKey === 'hermesShrineDelivery',
        );
        if (delivery === undefined) throw new Error('O Trial has no Shrine delivery');
        return {
          kind: 'UnplaceGeneratedDelivery',
          action: createRoomActionAddress(
            createBiomeAddress('Surface', 'O'),
            createOccurrenceId('surface-o-devotion'),
            roomActionKey(delivery),
          ),
        };
      },
    ],
    target: room('O', 'surface-o-devotion'),
  },
  // The Hub.
  {
    id: 'hub-timeline',
    label: 'Hub Timeline with its fountain',
    shows: ['Hub segments', 'fountain'],
    project: loadSurfaceShrineTravelDealCheckpoint,
    target: hub('N'),
  },
  {
    id: 'hub-phial-fountain',
    label: 'Hub fountain with its Phial target',
    shows: ['fountain + Phial target', 'Hub segments'],
    project: loadSurfaceNPhialIntermediateFountainCheckpoint,
    target: hub('N'),
  },
  {
    id: 'hub-reroll',
    label: 'Hub Timeline reroll row',
    shows: ['Hub reroll rows'],
    project: loadSurfaceNCheckpoint,
    commands: [
      {
        kind: 'ReplaceManualArcanaSelection',
        route: createRouteAddress('Surface'),
        arcanaKeys: ['DoorReroll'],
      },
      (project) => {
        const surfaceHub = createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub');
        const index = rerollAppendIndex(project, {
          kind: 'hubStay',
          hub: surfaceHub,
          precedingVisitCount: 1,
        });
        if (index === undefined) throw new Error('the N Hub has no reroll position');
        return {
          kind: 'InsertHubReroll',
          hub: surfaceHub,
          hubSlotKey: 'combat03',
          reward: {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
          },
          index,
        };
      },
    ],
    target: hub('N', 1),
  },
];
