import {
  createAcquisitionRoleAddress,
  createAdditionalExitAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createLocalVisitOrderAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createRoomActionAddress,
  createRewardWheelAddress,
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
  loadSurfaceNQuickBuckCheckpoint,
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
  loadUnderworldArachneCocoonsCheckpoint,
  loadUnderworldAutomaticBossCheckpoint,
  loadUnderworldFGCheckpoint,
  loadUnderworldFGHCheckpoint,
  loadUnderworldFGHICheckpoint,
  loadUnderworldFMidshopPomFrontierCheckpoint,
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
  roomLayoutAuthoringForProjectEvaluationAssembly,
  roomObjectAnchorSlotsForProjectEvaluationAssembly,
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
  type RoomAnchorObjectKind,
} from '@run-planner/engine/simulation';
import { createFreshFileRouteProject } from '@run-planner/test-fixtures/fresh-file';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { surfaceShrineDeliveriesProject } from '@run-planner/test-fixtures/surface';
import { createReachableNaturalChaosProject } from '../structured-workspace/interaction-binding.test-support';
import {
  appendRoomAction,
  authoredOccurrence,
  hub,
  occurrenceAddress,
  room,
  withoutRoomActionOrder,
  authoredHubActions,
  localVisitOrder,
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

/** Places a room's last unplaced spawned item through the engine's own placement command. */
function placeLastSpawned(biomeKey: string, occurrenceId: string): GalleryStep {
  return (project) => {
    const spawned = spawnedLootForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, project),
      occurrenceAddress(project, biomeKey, occurrenceId),
    );
    const command = spawned?.moments
      .flatMap((moment) => moment.items)
      .flatMap((item) =>
        item.placement.kind === 'unplaced' && item.placement.command !== undefined
          ? [item.placement.command]
          : [],
      )
      .at(-1);
    if (command === undefined) throw new Error(`${occurrenceId} has no unplaced spawned item`);
    return command;
  };
}

/** A room's object anchors by ascending id, as the Objects line numbers them. */
function anchorIds(gameName: string): readonly number[] {
  return (catalog.rooms.byKey[gameName]?.mapPoints?.challengeSwitchAnchors ?? [])
    .map((anchor) => anchor.id)
    .sort((left, right) => left - right);
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
  {
    id: 'optional-actions-fields',
    label: 'Optional actions: the Fields Optional rewards list',
    shows: ['Optional actions', 'Actions group picker items'],
    project: loadNemesisFieldsCheckpoint,
    target: room('H', 'golden-h-combat05'),
    openPicker: 'Optional rewards',
  },
  ...nemesisFamilyCases(),
  {
    id: 'optional-actions-nemesis',
    label: 'Optional actions: a Nemesis pickup on the Actions line',
    shows: ['Optional actions', 'Actions group picker items'],
    project: loadUnderworldFGCheckpoint,
    commands: [
      { kind: 'SelectEncounter', phase: nemesisPhase, encounterKey: 'NemesisRandomEvent' },
      {
        kind: 'SelectNemesisRandomEventFamily',
        event: createNemesisRandomEventAddress(nemesisPhase),
        family: 'damageContest',
      },
      {
        kind: 'ReplaceNemesisRandomEventInteraction',
        event: createNemesisRandomEventAddress(nemesisPhase),
        value: { kind: 'damageContest', result: 'failure', reward: null },
      },
    ],
    target: room('F', 'golden-f-b5-e1'),
    openPicker: 'Nemesis',
  },
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
    id: 'fields-doors-table',
    doorsExpanded: true,
    label: 'Fields doors table: each door with its cage rewards',
    shows: ['door table', 'local reward per cage'],
    project: createGoldenFGHIProject,
    target: room('H', 'golden-h-combat02'),
  },
  {
    id: 'fields-doors-table-max',
    doorsExpanded: true,
    label: 'Fields doors table rolled at its maximum: three cage rewards per door',
    shows: ['door table', 'three cage rewards', 'Fields settings line'],
    project: createGoldenFGHIProject,
    commands: [
      // Combat 09 holds two cages; a three-cage room lets the roll reach three.
      {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(
          createBiomeAddress('Underworld', 'H'),
          createOccurrenceId('golden-h-combat09'),
        ),
        gameName: 'H_Combat10',
      },
      {
        kind: 'ReplaceFieldsCageOutcome',
        decision: createExitDecisionAddress(createBiomeAddress('Underworld', 'H'), {
          kind: 'occurrence',
          occurrenceId: createOccurrenceId('golden-h-combat02'),
        }),
        cageOutcome: 'max',
      },
    ],
    target: room('H', 'golden-h-combat02'),
  },
  {
    id: 'doors-table',
    doorsExpanded: true,
    label: 'Doors table: one reward per door',
    shows: ['door table', 'door reward chips'],
    project: createGoldenFGHIProject,
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'doors-table-fixed',
    doorsExpanded: true,
    label: 'Doors table with a fixed reward door',
    shows: ['door table', 'fixed door reward chip'],
    project: loadSurfaceNOPQCheckpoint,
    target: room('P', 'surface-p-6-1-p_combat10'),
  },
  {
    id: 'side-room-doors',
    overview: true,
    label: 'Ephyra main room: side doors in Spawns, a Leave room picker per side visit',
    shows: ['side-door spawns', 'side-visit Leave rows', 'side-room returns'],
    project: loadSurfaceNOPQCheckpoint,
    target: room('N', 'surface-n-combat05'),
  },
  {
    id: 'side-room-page',
    overview: true,
    label: 'Ephyra side room on its calibrated map, leaving back to its main room',
    shows: ['side room map', 'side-room return'],
    project: loadSurfaceNOPQCheckpoint,
    target: room('N', 'surface-n-combat05-sideDoor2'),
  },
  {
    id: 'flipped-ephyra-room',
    overview: true,
    label: 'Ephyra main room that always flips, its map mirrored with its side door',
    shows: ['flipped room map', 'side door'],
    project: loadSurfaceNOPQCheckpoint,
    target: room('N', 'surface-n-combat11'),
  },
  {
    id: 'ephyra-prehub',
    overview: true,
    label: 'Ephyra PreHub on its calibrated map',
    shows: ['PreHub map'],
    project: loadSurfaceNOPQCheckpoint,
    target: room('N', 'surface-n-prehub'),
  },
  {
    id: 'side-visit-repeat',
    label: 'Ephyra main room whose later side visit repeats an earlier one',
    shows: ['side-visit Leave rows', 'already visited finding'],
    project: loadSurfaceNOPQCheckpoint,
    commands: [
      (project) => {
        const visits = localVisitOrder(project, 'N', 'surface-n-combat05');
        return {
          kind: 'ReplaceLocalVisitOrder',
          order: createLocalVisitOrderAddress(
            createBiomeAddress('Surface', 'N'),
            createOccurrenceId('surface-n-combat05'),
            'sideRooms',
          ),
          occurrenceIds: [visits[1]!, ...visits.slice(1)],
        };
      },
    ],
    target: room('N', 'surface-n-combat05'),
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
    id: 'spawned-combat-end',
    label: 'Spawned at an encounter end: reward, delivery and Supply Chain drops',
    shows: ['spawn notice', 'unplaced optional spawned item'],
    project: loadSurfaceScheduledLifecycleCheckpoint,
    target: room('P', 'surface-p-1-1-p_combat03'),
  },
  {
    id: 'spawned-combat-end-placed',
    label: 'Spawned at an encounter end: the second Supply Chain drop placed from its chip',
    shows: ['spawn notice'],
    project: loadSurfaceScheduledLifecycleCheckpoint,
    commands: [placeLastSpawned('P', 'surface-p-1-1-p_combat03')],
    target: room('P', 'surface-p-1-1-p_combat03'),
  },
  {
    id: 'spawned-ship-phase',
    roomTab: 'shipCombat1Actions',
    label: 'Ship combat phase: spawned at its end and after its wheel reward',
    shows: ['spawn notice', 'ship phase'],
    project: surfaceShrineDeliveriesProject,
    target: room('O', 'surface-o-combat04'),
  },
  {
    id: 'spawned-fields-entry',
    label: 'Fields room: cage rewards locked on entry, each unlocked at its cage fight’s end',
    shows: ['spawn notice', 'Fields slot marks', 'locked loot', 'unlocks row'],
    project: loadUnderworldFGHCheckpoint,
    target: room('H', 'golden-h-combat02'),
  },
  {
    id: 'spawned-h-miniboss',
    label: 'H miniboss: reward caged at the encounter start, unlocked at its end',
    shows: ['spawn notice', 'locked loot', 'unlocks row'],
    project: loadUnderworldFGHCheckpoint,
    target: room('H', 'golden-h-miniboss01'),
  },
  {
    id: 'spawned-quick-buck',
    label: 'Quick Buck’s gold spawned under its boon pickup',
    shows: ['action spawn row'],
    project: loadSurfaceNQuickBuckCheckpoint,
    target: room('N', 'surface-n-opening'),
  },
  {
    id: 'ship-phase-wheel',
    roomTab: 'shipIntroActions',
    label: 'Ship room Intro phase: the wheel and its offers',
    shows: ['ship phase', 'wheel offers table'],
    project: loadSurfaceEncounterShowcaseCheckpoint,
    commands: [
      {
        kind: 'ReplaceRewardWheelOfferCount',
        wheel: createRewardWheelAddress(
          createBiomeAddress('Surface', 'O'),
          createOccurrenceId('surface-o-combat04'),
          'wheel1',
        ),
        offerCount: 2,
      },
    ],
    target: room('O', 'surface-o-combat04'),
  },
  {
    id: 'ship-phase-combat',
    roomTab: 'shipCombat1Actions',
    label: 'Ship room combat phase with its doors',
    shows: ['ship phase', 'doors'],
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
    id: 'chaos-gate-position',
    overview: true,
    label: 'Chaos Gate with a chosen spawn position',
    shows: ['Chaos Gate', 'gate position picker'],
    project: createGoldenFGHIProject,
    commands: [
      {
        kind: 'AddChaos',
        additional: createAdditionalExitAddress(
          createBiomeAddress('Underworld', 'G'),
          createOccurrenceId('golden-g-b2-e1'),
          'chaos',
        ),
        occurrenceId: createOccurrenceId('gallery-chaos'),
      },
      {
        kind: 'SetChaosSpawnPoint',
        additional: createAdditionalExitAddress(
          createBiomeAddress('Underworld', 'G'),
          createOccurrenceId('golden-g-b2-e1'),
          'chaos',
        ),
        spawnPointIndex: 3,
      },
    ],
    target: room('G', 'golden-g-b2-e1'),
  },
  {
    id: 'room-map-f-combat',
    overview: true,
    label: 'F combat room beside its map, with a Chaos Gate',
    shows: ['room map', 'doors', 'Chaos Gate point', 'entries', 'anchors'],
    project: createGoldenFGHIProject,
    commands: [
      {
        kind: 'AddChaos',
        additional: createAdditionalExitAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-b4-e1'),
          'chaos',
        ),
        occurrenceId: createOccurrenceId('gallery-f-chaos'),
      },
      {
        kind: 'SetChaosSpawnPoint',
        additional: createAdditionalExitAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-b4-e1'),
          'chaos',
        ),
        spawnPointIndex: 1,
      },
    ],
    target: room('F', 'golden-f-b4-e1'),
  },
  {
    id: 'room-map-f-single-chaos-point',
    overview: true,
    label: 'F room whose one Chaos point places its Chaos Gate',
    shows: ['room map', 'Chaos Gate at the only point'],
    project: createGoldenFGHIProject,
    commands: [
      {
        kind: 'AddChaos',
        additional: createAdditionalExitAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-b2-e1'),
          'chaos',
        ),
        occurrenceId: createOccurrenceId('gallery-f-chaos'),
      },
    ],
    target: room('F', 'golden-f-b2-e1'),
  },
  {
    id: 'room-map-f-chaos-points',
    overview: true,
    doorsExpanded: true,
    label: 'F room with three Chaos points, its gate at the second',
    shows: ['room map', 'Chaos Gate position picker preview', 'door rows'],
    project: createGoldenFGHIProject,
    commands: [
      {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-b4-e1'),
        ),
        gameName: 'F_Combat17',
      },
      {
        kind: 'AddChaos',
        additional: createAdditionalExitAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-b4-e1'),
          'chaos',
        ),
        occurrenceId: createOccurrenceId('gallery-f-chaos'),
      },
      {
        kind: 'SetChaosSpawnPoint',
        additional: createAdditionalExitAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-b4-e1'),
          'chaos',
        ),
        spawnPointIndex: 2,
      },
    ],
    target: room('F', 'golden-f-b4-e1'),
  },
  {
    id: 'room-map-f-overview',
    overview: true,
    label: 'F combat room: the Well stood on A2, the switch on the last free spot',
    shows: ['Overview sections', 'Anchors chip row', 'anchor occupants on the map'],
    project: createGoldenFGHIProject,
    commands: [
      placeAnchorObject('F', 'golden-f-b5-e1', 'stygianWell'),
      (project) => ({
        kind: 'ReplaceRoomObjectAnchor',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-b5-e1'),
        object: 'stygianWell',
        anchorId: anchorIds('F_Combat06')[1]!,
      }),
      placeAnchorObject('F', 'golden-f-b5-e1', 'challengeSwitch'),
    ],
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'room-map-f-postboss-pinned',
    overview: true,
    label: 'F Postboss: the Well on its pinned spot, the Pool on the spot it leaves',
    shows: ['pinned Well chip', 'derived Pool chip', 'derived occupant on the map'],
    project: createGoldenFGHIProject,
    target: room('F', 'golden-f-preboss-shop:postboss'),
  },
  {
    id: 'room-map-f-roll-entry',
    overview: true,
    label: 'F room whose flip rolls: each entry with the flip it needs',
    shows: ['Entry pairs', 'unset entry tie on the map'],
    project: createGoldenFGHIProject,
    target: room('F', 'golden-f-b7-e1'),
  },
  {
    id: 'room-map-f-roll-entry-flipped',
    overview: true,
    label: 'F room entered at the entry that flips it: the map mirrored',
    shows: ['Entry chosen', 'Melinoë at the entry', 'flipped map'],
    project: createGoldenFGHIProject,
    commands: [
      (project) => {
        const occurrence = occurrenceAddress(project, 'F', 'golden-f-b7-e1');
        const entry = roomLayoutAuthoringForProjectEvaluationAssembly(
          simulateProjectAssembly(catalog, project),
          occurrence,
        )?.entries.find((choice) => choice.option.flipped === true);
        if (entry === undefined) throw new Error('golden-f-b7-e1 has no entry that flips it');
        return entry.command;
      },
    ],
    target: room('F', 'golden-f-b7-e1'),
  },
  {
    id: 'room-map-f-door-decided',
    overview: true,
    label: 'F room whose door decides its flip and entry: shown, mirrored',
    shows: ['door-decided entry', 'flipped map'],
    project: createGoldenFGHIProject,
    target: room('F', 'golden-f-b1-e1'),
  },
  {
    id: 'room-map-f-stale-entry',
    overview: true,
    label: 'F room holding a flip its door no longer gives: the Entry list clears it',
    shows: ['door-decided entry held unflipped', 'clearing option'],
    project: createGoldenFGHIProject,
    commands: [
      (project) => ({
        kind: 'ReplaceRoomLayout',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-b1-e1'),
        layout: { flipped: false },
      }),
    ],
    target: room('F', 'golden-f-b1-e1'),
    openOverviewPicker: 'Entry',
  },
  {
    id: 'room-map-f-stale-fixed-entry',
    overview: true,
    label: 'F Postboss, one entry, holding the flip it never takes: the Entry list clears it',
    shows: ['fixed entry held with the other flip', 'clearing option'],
    project: createGoldenFGHIProject,
    commands: [
      (project) => ({
        kind: 'ReplaceRoomLayout',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-preboss-shop:postboss'),
        layout: { flipped: true },
      }),
    ],
    target: room('F', 'golden-f-preboss-shop:postboss'),
    openOverviewPicker: 'Entry',
  },
  {
    id: 'room-map-f-independent-pairs',
    overview: true,
    label: 'F room whose entries allow either flip: two pairs per entry',
    shows: ['Entry pairs', 'unset entry tie on the map'],
    project: createGoldenFGHIProject,
    target: room('F', 'golden-f-b4-e1'),
  },
  {
    id: 'room-map-g-cocoons',
    overview: true,
    label: 'G Arachne combat room beside its map',
    shows: ['room map', 'doors', 'entries', 'anchors', 'Customize encounter'],
    project: loadUnderworldArachneCocoonsCheckpoint,
    target: room('G', 'golden-g-b4-e1'),
  },
  {
    id: 'room-map-i-combat',
    overview: true,
    label: 'I combat room beside its map',
    shows: ['room map', 'doors', 'entries', 'anchors'],
    project: createGoldenFGHIProject,
    target: room('I', 'golden-i-combat01'),
  },
  {
    id: 'room-map-p-indoor-outdoor',
    overview: true,
    label: 'P room with an indoor and an outdoor door beside its map',
    shows: ['room map', 'indoor and outdoor doors', 'entries', 'anchors'],
    project: loadSurfaceNOPQCheckpoint,
    target: room('P', 'surface-p-1-1-p_combat03'),
  },
  {
    id: 'room-map-q-fork',
    overview: true,
    label: 'Q fork room beside its map',
    shows: ['room map', 'doors', 'entries', 'anchors'],
    project: loadSurfaceNOPQCheckpoint,
    target: room('Q', 'surface-q-first-fork'),
  },
  {
    id: 'room-map-chaos',
    overview: true,
    label: 'Chaos room beside its map',
    shows: ['room map', 'Chaos exits'],
    project: loadUnderworldIxionChaosCheckpoint,
    target: room('G', 'golden-g-intro:chaos'),
  },
  {
    id: 'room-map-anomaly',
    overview: true,
    label: 'Anomaly room beside its map',
    shows: ['room map', 'automatic exit', 'anchor'],
    project: loadUnderworldGAnomalyRosterCheckpoint,
    target: room('G', 'golden-g-b3-e2'),
  },
  {
    id: 'postboss-next-biome',
    label: 'F Postboss: its way on into Oceanus, shown by the biome',
    shows: ['next-biome exit chip', 'Leave room picker'],
    project: createGoldenFGHIProject,
    target: room('F', 'golden-f-preboss-shop:postboss'),
  },
  {
    id: 'run-complete-exit',
    label: 'Tartarus boss: the run complete as its way on',
    shows: ['run-complete Leave room picker'],
    project: createGoldenFGHIProject,
    target: room('I', 'golden-i-preboss:boss'),
  },
  {
    id: 'room-map-dream-postboss',
    overview: true,
    label: 'Dream Postboss beside its map: the Well on its pinned spot',
    shows: ['room map', 'pinned Well'],
    project: loadDreamHeraArtificerEchoCheckpoint,
    target: room('H', 'dream-user-h-preboss:postboss'),
  },
  {
    id: 'room-map-h-fields-slots',
    overview: true,
    label: 'H Fields room: cage and reward points as chip rows',
    shows: ['Cages chip row', 'Rewards chip row', 'Nemesis'],
    project: loadNemesisFieldsCheckpoint,
    target: room('H', 'golden-h-combat05'),
  },
  {
    id: 'room-map-h-fields-flipped',
    overview: true,
    label: 'H Fields room entered at the entry that flips it: cages mirrored with the map',
    shows: ['flipped map', 'cage and reward occupants'],
    project: createGoldenFGHIProject,
    commands: [
      (project) => {
        const occurrence = occurrenceAddress(project, 'H', 'golden-h-combat02');
        const entry = roomLayoutAuthoringForProjectEvaluationAssembly(
          simulateProjectAssembly(catalog, project),
          occurrence,
        )?.entries.find((choice) => choice.option.flipped === true);
        if (entry === undefined) throw new Error('golden-h-combat02 has no entry that flips it');
        return entry.command;
      },
    ],
    target: room('H', 'golden-h-combat02'),
  },
  {
    id: 'room-map-h-postboss-pinned',
    overview: true,
    label: 'H Postboss: the Well on its pinned spot, the Pool on the spot it leaves',
    shows: ['pinned Well chip', 'derived Pool chip', 'occupants on the map'],
    project: createGoldenFGHIProject,
    target: room('H', 'golden-h-preboss-shop:postboss'),
  },
  {
    id: 'room-map-q-combat05',
    overview: true,
    label: 'Q Combat05 beside its map',
    shows: ['room map', 'doors', 'entries', 'anchors'],
    project: loadSurfaceNOPQCheckpoint,
    commands: [
      {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(
          createBiomeAddress('Surface', 'Q'),
          createOccurrenceId('surface-q-ordinary'),
        ),
        gameName: 'Q_Combat05',
      },
    ],
    target: room('Q', 'surface-q-ordinary'),
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
    id: 'optional-actions-switch',
    label: 'Optional actions: an unused challenge switch',
    shows: ['Optional actions', 'challenge switch'],
    project: createGoldenFGHIProject,
    commands: [
      (project) => ({
        kind: 'ReplaceChallengeSwitch',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-b5-e1'),
        variantKey: 'TimeChallengeSwitch_Money',
      }),
    ],
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'perfect-clear-switch',
    label: 'Unseen Sigil used, succeeding with its Nectar',
    shows: ['challenge switch outcome'],
    project: createGoldenFGHIProject,
    commands: [
      (project) => ({
        kind: 'ReplaceChallengeSwitch',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-b5-e1'),
        variantKey: 'PerfectClearChallengeSwitch_Pom',
      }),
      (project) => ({
        kind: 'ReplaceChallengeSwitchOutcome',
        occurrence: occurrenceAddress(project, 'F', 'golden-f-b5-e1'),
        outcome: 'hitless',
        nectarDropped: true,
      }),
      appendRoomAction('F', 'golden-f-b5-e1', { kind: 'interactChallengeSwitch' }),
    ],
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'keepsake-rack-swap',
    label: 'Keepsake Rack swapping the held keepsake',
    shows: ['Keepsake Rack'],
    project: loadUnderworldFGCheckpoint,
    commands: [
      (project) => ({
        kind: 'ReplacePostbossKeepsake',
        selection: createPostbossKeepsakeSelectionAddress(
          occurrenceAddress(project, 'F', 'golden-f-preboss-shop:postboss'),
        ),
        keepsakeKey: 'BlockDeathKeepsake',
      }),
    ],
    target: room('F', 'golden-f-preboss-shop:postboss'),
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
    id: 'anchors-well-empty',
    overview: true,
    label: 'Two anchors: a Stygian Well and an empty spot',
    shows: ['anchor slots', 'empty spot'],
    project: createGoldenFGHIProject,
    commands: [placeAnchorObject('F', 'golden-f-b5-e1', 'stygianWell')],
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
    id: 'optional-actions-rush-unplaced',
    label: 'Optional actions: a rushed Shrine item left behind beside a challenge switch',
    shows: ['Optional actions', 'Hermes Shrine rush', 'spawned row unplaced chip'],
    project: loadSurfaceNOPQCheckpoint,
    commands: [
      placeAnchorObject('O', 'surface-o-combat02', 'challengeSwitch'),
      placeAnchorObject('O', 'surface-o-combat02', 'hermesShrine'),
      (project) => ({
        kind: 'ReplaceHermesShrineOffer',
        occurrence: occurrenceAddress(project, 'O', 'surface-o-combat02'),
        slotKey: 'first',
        value: { rewardType: 'HealBigDrop' },
      }),
      (project) => ({
        kind: 'PurchaseHermesShrineOffer',
        occurrence: occurrenceAddress(project, 'O', 'surface-o-combat02'),
        generationKey: 'initial:first',
        rushed: true,
      }),
      (project) => {
        const pickup = authoredOccurrence(
          project,
          'O',
          'surface-o-combat02',
        ).roomActions.order.find(
          (reference) =>
            reference.kind === 'interactAcquisitionEntry' &&
            reference.siteKey === 'hermesShrineDelivery',
        );
        if (pickup === undefined) throw new Error('the rush placed no pickup');
        return {
          kind: 'RemoveRoomAction',
          action: createRoomActionAddress(
            createBiomeAddress('Surface', 'O'),
            createOccurrenceId('surface-o-combat02'),
            roomActionKey(pickup),
          ),
        };
      },
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
  {
    id: 'plan-end-past-end-room',
    label: 'Room past the plan end: its Leave room picker moves the end here',
    shows: ['leave row', 'End plan'],
    project: loadUnderworldFGCheckpoint,
    commands: [
      {
        kind: 'ReplacePlanEnd',
        route: createRouteAddress('Underworld'),
        planEnd: { biomeKey: 'F', occurrenceId: createOccurrenceId('golden-f-b3-e1') },
      },
    ],
    target: room('F', 'golden-f-b5-e1'),
  },
  {
    id: 'plan-end-unentered-room',
    label: 'Room behind a door not taken: its Leave room picker waits',
    shows: ['leave row', 'waiting'],
    project: loadUnderworldFMidshopPomFrontierCheckpoint,
    target: room('F', 'midshop-pom-b4-e2'),
  },
  {
    id: 'plan-end-pending',
    label: 'Saved plan end in a room still to be completed',
    shows: ['leave row', 'End plan'],
    project: loadUnderworldFMidshopPomFrontierCheckpoint,
    commands: [
      {
        kind: 'ReplacePlanEnd',
        route: createRouteAddress('Underworld'),
        planEnd: { biomeKey: 'F', occurrenceId: createOccurrenceId('midshop-pom-b5-e1') },
      },
    ],
    target: room('F', 'midshop-pom-b5-e1'),
  },
  {
    id: 'plan-end-prehub',
    label: 'Plan ends in the Ephyra PreHub, continued through its Hub',
    shows: ['leave row', 'End plan', 'Hub'],
    project: loadSurfaceNOPQCheckpoint,
    commands: [
      {
        kind: 'ReplacePlanEnd',
        route: createRouteAddress('Surface'),
        planEnd: { biomeKey: 'N', occurrenceId: createOccurrenceId('surface-n-prehub') },
      },
    ],
    target: room('N', 'surface-n-prehub'),
  },
  {
    id: 'plan-end-side-visit',
    label: 'Plan ends as the hero leaves a side room: its return is past the end',
    shows: ['side-visit Leave rows', 'side-room returns', 'End plan'],
    project: loadSurfaceNOPQCheckpoint,
    commands: [
      (project) => ({
        kind: 'ReplacePlanEnd',
        route: createRouteAddress('Surface'),
        planEnd: {
          biomeKey: 'N',
          occurrenceId: localVisitOrder(project, 'N', 'surface-n-combat05')[0]!,
        },
      }),
    ],
    target: room('N', 'surface-n-combat05'),
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
    id: 'optional-actions-well',
    label: 'Optional actions: the Stygian Well list',
    shows: ['Optional actions', 'Well picker items'],
    project: loadUnderworldFStygianWellCheckpoint,
    target: room('F', 'golden-f-preboss-shop:postboss'),
    openPicker: 'Stygian Well',
  },
  {
    id: 'optional-actions-pool',
    label: 'Optional actions: the Purging Pool list',
    shows: ['Optional actions', 'Pool picker items'],
    project: loadUnderworldFPoolCheckpoint,
    target: room('F', 'golden-f-preboss-shop:postboss'),
    openPicker: 'Pool of Purging',
  },
  {
    id: 'optional-actions-shop',
    label: 'Optional actions: the World Shop list',
    shows: ['Optional actions', 'World Shop picker items'],
    project: loadTraitOrderChecks,
    target: room('F', traitOrderChecks.preboss),
    openPicker: 'World Shop',
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
    id: 'optional-actions-shrine',
    label: 'Optional actions: the Hermes Shrine list',
    shows: ['Optional actions', 'Hermes Shrine picker items'],
    project: loadSurfaceShrineTravelDealCheckpoint,
    target: room('N', 'surface-n-preboss:postboss'),
    openPicker: 'Hermes Shrine',
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
    id: 'hub-doors',
    overview: true,
    label: 'Hub board doors and their rewards',
    shows: ['Hub door reward chips'],
    project: loadSurfaceNCheckpoint,
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
    id: 'hub-repeat-visit',
    label: 'Hub Timeline whose second visit repeats the first',
    shows: ['Hub segments', 'already visited finding'],
    project: loadSurfaceNCheckpoint,
    commands: [
      (project) => {
        const surfaceHub = createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub');
        const actions = authoredHubActions(project, 'N');
        const visits = actions.flatMap((action) => (action.kind === 'roomVisit' ? [action] : []));
        const first = visits[0];
        const second = visits[1];
        if (first === undefined || second === undefined)
          throw new Error('the N Hub has fewer than two visits');
        return {
          kind: 'ReplaceHubActionOrder',
          hub: surfaceHub,
          actions: actions.map((action) =>
            action === first ? { kind: 'roomVisit', hubSlotKey: second.hubSlotKey } : action,
          ),
        };
      },
    ],
    target: hub('N', 2),
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
