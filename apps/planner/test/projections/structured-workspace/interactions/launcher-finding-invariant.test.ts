import { beforeEach, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createFieldsSpatialAddress,
  createOccurrenceAddress,
  createNemesisRandomEventAddress,
  createOccurrenceId,
  createShopOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import {
  authorFreshFileRoomIssues,
  createFreshFileFProject,
  createFreshFileRouteProject,
  freshFileFBiome,
  newHFieldsRoomId,
  withNewHFieldsRoom,
} from '@run-planner/test-fixtures/fresh-file';
import {
  anomalyRosterPhase,
  createCompleteFGAnomalyProject,
  createCompleteFGProject,
  createEchoGoldIAnvilDuplicateProject,
  createGoldenFGHIProject,
  echoGoldIDuplicateAnvilResult,
  echoGoldIPrebossShopId,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  goldenIBiome,
  loadNemesisFieldsCheckpoint,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { createStructuredWorkspaceTestServices } from '@planner-test/fixtures/structuredWorkspace';
import { presentAssessmentIssue } from '@planner/projections/evaluationProjection';

const services = createStructuredWorkspaceTestServices();

/** The projected side-room decision of one Surface N room. */
function workspaceLocalVisit(project: ProjectDocument, occurrenceId: string) {
  const biome = services.structuredWorkspace
    .project(simulateProjectAssembly(catalog, project))
    .route.biomes.find((candidate) => candidate.biomeKey === 'N')!;
  for (const node of biome.nodes)
    if (node.kind === 'occurrenceWorkbench' && node.room.address.occurrenceId === occurrenceId)
      if (node.localVisit !== undefined) return node.localVisit;
  throw new Error(`${occurrenceId} has no projected side rooms`);
}
/** Launchers the walk actually checked, so the invariant is never vacuous. */
const checked = {
  trait: 0,
  encounter: 0,
  pom: 0,
  anvil: 0,
  nemesis: 0,
  roster: 0,
  wheel: 0,
  ship: 0,
  localVisit: 0,
  hubSlot: 0,
  fieldsSpatial: 0,
  collapsed: 0,
};
/** The trait offer whose dialog repairs a finding at this owner, if any. */
function repairingTraitOffer(owner: SemanticAddress): SemanticAddress | undefined {
  if (owner.kind === 'traitOffer') return owner;
  return 'trait' in owner && (owner as { trait?: SemanticAddress }).trait?.kind === 'traitOffer'
    ? (owner as { trait: SemanticAddress }).trait
    : undefined;
}

/**
 * Every published finding whose owner is a gated launcher leaves that launcher
 * enabled, so the route never asks for a repair the user cannot open.
 */
function disabledRepairLaunchers(assembly: ProjectEvaluationAssembly): readonly string[] {
  const { interactions } = services.structuredWorkspace.project(assembly);
  const owners = [
    ...assembly.evaluation.findings.filter((finding) => finding.severity === 'error'),
    ...(assembly.evaluation.issue?.reasons ?? []),
  ];
  const disabled: string[] = [];
  for (const finding of owners) {
    const owner = finding.origin;
    const trait = repairingTraitOffer(owner);
    if (trait !== undefined) {
      const interaction = interactions.traitOffers.get(semanticAddressKey(trait));
      if (interaction !== undefined) checked.trait += 1;
      if (interaction !== undefined && !interaction.contextReached)
        disabled.push(`trait ${finding.code} ${semanticAddressKey(owner)}`);
    }
    // A customization decision names itself in evidence; the encounter selector,
    // an inline picker, repairs the phase's other findings.
    if (owner.kind === 'encounterPhase' && 'decisionKey' in finding.evidence) {
      const interaction = interactions.encounterCustomizations.get(semanticAddressKey(owner));
      if (interaction !== undefined) checked.encounter += 1;
      const roster = finding.evidence.decisionKey === 'infiniteRoster';
      if (roster && interaction !== undefined) checked.roster += 1;
      if (interaction !== undefined && !customizationReached(interaction, roster))
        disabled.push(`encounter ${finding.code} ${semanticAddressKey(owner)}`);
    }
    if (owner.kind === 'levelResolution') {
      const interaction = interactions.levelResolutions.get(semanticAddressKey(owner));
      if (interaction !== undefined) checked.pom += 1;
      if (interaction !== undefined && !interaction.contextReached)
        disabled.push(`pom ${finding.code} ${semanticAddressKey(owner)}`);
    }
    if (owner.kind === 'acquisitionRole' && 'pickupEffect' in finding.evidence) {
      const anvil = interactions.acquisitionConversions.get(semanticAddressKey(owner))?.anvil;
      if (anvil !== undefined) checked.anvil += 1;
      if (anvil !== undefined && !anvil.contextReached)
        disabled.push(`anvil ${finding.code} ${semanticAddressKey(owner)}`);
    }
    // A Nemesis event's details are repaired at its encounter's interaction row.
    const nemesisEvent =
      owner.kind === 'nemesisRandomEvent'
        ? owner
        : owner.kind === 'roomAction' && JSON.parse(owner.actionKey)[0] === 'interactEncounter'
          ? createNemesisRandomEventAddress(
              createEncounterPhaseAddress(
                createBiomeAddress(owner.routeKey, owner.biomeKey),
                { kind: 'occurrence', occurrenceId: owner.occurrenceId },
                JSON.parse(owner.actionKey)[1] as string,
              ),
            )
          : undefined;
    if (nemesisEvent !== undefined) {
      const interaction = interactions.nemesisEvents.get(semanticAddressKey(nemesisEvent));
      if (interaction !== undefined) checked.nemesis += 1;
      if (interaction !== undefined && !interaction.contextReached)
        disabled.push(`nemesis ${finding.code} ${semanticAddressKey(owner)}`);
    }
  }
  for (const finding of owners)
    disabled.push(...blockedNativeSettings(interactions, finding.origin));
  disabled.push(...disabledCollapsedLauncher(interactions, assembly));
  return disabled;
}

type WorkspaceInteractions = ReturnType<
  typeof services.structuredWorkspace.project
>['interactions'];
type EncounterCustomizationInteraction = NonNullable<
  ReturnType<WorkspaceInteractions['encounterCustomizations']['get']>
>;

/** The customization decision a finding names can be opened for repair. */
function customizationReached(
  interaction: EncounterCustomizationInteraction,
  roster: boolean,
): boolean {
  return roster
    ? interaction.infiniteRosterDraftFor !== undefined
    : interaction.generatedComposition?.editable !== true ||
        interaction.generatedAssessment !== undefined;
}

/** The outer entry folds inner reasons onto its dialog launcher, which must stay enabled. */
function disabledCollapsedLauncher(
  interactions: WorkspaceInteractions,
  assembly: ProjectEvaluationAssembly,
): readonly string[] {
  const issue = assembly.evaluation.issue;
  if (issue === undefined) return [];
  const entry = presentAssessmentIssue(issue, (reason) => semanticAddressKey(reason.origin));
  if (entry.dialog === undefined) return [];
  expect(semanticAddressKey(entry.dialog.owner)).toBe(semanticAddressKey(issue.owner));
  const key = semanticAddressKey(entry.dialog.owner);
  const reached = (() => {
    switch (entry.dialog.kind) {
      case 'traitOffer':
        return interactions.traitOffers.get(key)?.contextReached;
      case 'levelResolution':
        return interactions.levelResolutions.get(key)?.contextReached;
      case 'encounterCustomization': {
        const interaction = interactions.encounterCustomizations.get(key);
        if (interaction === undefined) return undefined;
        return issue.reasons
          .filter((reason) => 'decisionKey' in reason.evidence)
          .every((reason) =>
            customizationReached(interaction, reason.evidence.decisionKey === 'infiniteRoster'),
          );
      }
    }
  })();
  if (reached === undefined) return [];
  checked.collapsed += 1;
  return reached ? [] : [`collapsed ${entry.title} ${key}`];
}

/** Hub visits and the fountain use are repaired through their Hub's action order. */
function hubOrderKey(owner: SemanticAddress): string | undefined {
  return owner.kind === 'hubVisit' || owner.kind === 'hubFountain'
    ? semanticAddressKey({
        kind: 'hubDecision',
        routeKey: owner.routeKey,
        biomeKey: owner.biomeKey,
        hubKey: owner.hubKey,
      })
    : undefined;
}

/** Native settings owned by this finding owner whose engine context is unreached. */
function blockedNativeSettings(
  interactions: WorkspaceInteractions,
  owner: SemanticAddress,
): readonly string[] {
  const key = semanticAddressKey(owner);
  const result: string[] = [];
  const settings = [
    ['wheel', interactions.rewardWheelOfferCounts.get(key)],
    ['wheel', interactions.rewardWheelPicks.get(key)],
    ['ship', interactions.shipCombatPhaseCounts.get(key)],
    ['localVisit', interactions.localVisitGenerations.get(key)],
    ['localVisit', interactions.localVisitOrders.get(`${key}:visit-order`)],
    ['fieldsSpatial', interactions.fieldsSpatialPoints.get(key)],
    ['hubSlot', interactions.hubSlots.get(key)],
    ['hubSlot', interactions.hubActionOrders.get(hubOrderKey(owner) ?? key)],
  ] as const;
  for (const [family, interaction] of settings) {
    if (interaction === undefined) continue;
    checked[family] += 1;
    if (!interaction.contextReached) result.push(`${family} ${key}`);
  }
  if (owner.kind === 'hubOpenSet')
    for (const slot of interactions.hubSlots.values())
      if (slot.owner.hubKey === owner.hubKey && slot.owner.biomeKey === owner.biomeKey) {
        checked.hubSlot += 1;
        if (!slot.contextReached) result.push(`hubSlot ${semanticAddressKey(slot.owner)}`);
      }
  return result;
}

function check(project: ProjectDocument): readonly string[] {
  return disabledRepairLaunchers(simulateProjectAssembly(catalog, project));
}

/** Clears the nth authored trait offer in one biome, as an unfinished save holds it. */
function withClearedTraitOffer(
  project: ProjectDocument,
  biomeKey: string,
  index: number,
): ProjectDocument {
  const raw = JSON.parse(encodeProjectDocument(project));
  const found: Record<string, unknown>[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const offers = record.traitOffersByAcquisitionRole as Record<string, unknown> | undefined;
    if (offers !== undefined)
      for (const role of Object.keys(offers)) if (offers[role] !== null) found.push(offers);
    Object.values(record).forEach(visit);
  };
  visit(raw.route.biomes.find((biome: { biomeKey: string }) => biome.biomeKey === biomeKey));
  const target = found[index];
  if (target === undefined) throw new Error(`${biomeKey} has no trait offer ${index}`);
  for (const role of Object.keys(target)) target[role] = null;
  return decodeProjectDocument(raw, catalog);
}

describe('a finding never disables the launcher that repairs it', () => {
  beforeEach(() => {
    for (const key of Object.keys(checked) as (keyof typeof checked)[]) checked[key] = 0;
  });

  it('holds at every issue of a new Fresh H Fields room', () => {
    const seen: string[] = [];
    authorFreshFileRoomIssues(
      withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'max'),
      'H',
      newHFieldsRoomId,
      (assembly) => {
        seen.push(...disabledRepairLaunchers(assembly));
        return '';
      },
    );
    expect(seen).toEqual([]);
    expect(checked.trait).toBeGreaterThan(0);
    expect(checked.encounter).toBeGreaterThan(0);
  });

  it('holds on Fresh routes with a cleared trait offer or composition', () => {
    const fresh = createFreshFileRouteProject();
    for (const project of [
      createFreshFileFProject(),
      withClearedTraitOffer(createFreshFileFProject(), 'F', 0),
      withClearedTraitOffer(fresh, 'F', 1),
      withClearedTraitOffer(fresh, 'G', 1),
      withClearedTraitOffer(fresh, 'H', 0),
      applyProjectCommand(fresh, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase: createEncounterPhaseAddress(
          freshFileFBiome,
          { kind: 'occurrence', occurrenceId: createOccurrenceId('fresh-4-0') },
          'Encounter',
        ),
        decisionKey: 'generatedComposition',
        value: null,
      }),
    ])
      expect(check(project)).toEqual([]);
    expect(checked.trait).toBeGreaterThan(0);
    expect(checked.encounter).toBeGreaterThan(0);
    expect(checked.collapsed).toBeGreaterThan(0);
  });

  it('holds on the golden Underworld and Surface routes with representative repairs', () => {
    const upstreamInvalid = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
        'Encounter',
      ),
      encounterKey: 'ArtemisCombatF',
    });
    let shopHammer = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat07', 4, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    shopHammer = applyProjectCommand(shopHammer, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon'),
      value: { rewardType: 'WeaponUpgradeDrop' },
    });
    shopHammer = applyProjectCommand(shopHammer, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon'),
      purchased: true,
    });
    // A fixed-giver offer (Icarus) with no authored value owns its missing-offer finding.
    const oBiome = createBiomeAddress('Surface', 'O');
    const icarusPhase = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-o-combat01') },
      'Combat1',
    );
    let icarus = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-combat01')),
      encounterCount: 3,
    });
    icarus = applyProjectCommand(icarus, catalog, {
      kind: 'SelectEncounter',
      phase: icarusPhase,
      encounterKey: 'IcarusCombatO',
    });
    const golden = createGoldenFGHIProject();
    for (const project of [
      icarus,
      upstreamInvalid,
      withClearedTraitOffer(golden, 'F', 2),
      withClearedTraitOffer(golden, 'G', 1),
      withClearedTraitOffer(golden, 'H', 1),
      withClearedTraitOffer(loadSurfaceNOPQProject(), 'O', 1),
      withClearedTraitOffer(loadSurfaceNOPQProject(), 'P', 1),
      shopHammer,
    ])
      expect(check(project)).toEqual([]);
    expect(checked.trait).toBeGreaterThan(0);
  });

  it('holds for Pom, Anomaly roster and Nemesis owners', () => {
    const pom = (() => {
      const raw = JSON.parse(encodeProjectDocument(createGoldenFGHIProject()));
      let cleared = false;
      const visit = (value: unknown): void => {
        if (cleared || value === null || typeof value !== 'object') return;
        if (Array.isArray(value)) return value.forEach(visit);
        const record = value as Record<string, unknown>;
        const resolutions = record.levelResolutionsByAcquisitionRole as
          Record<string, unknown> | undefined;
        if (resolutions !== undefined && Object.keys(resolutions).length > 0) {
          for (const role of Object.keys(resolutions))
            resolutions[role] = { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null };
          cleared = true;
          return;
        }
        Object.values(record).forEach(visit);
      };
      visit(raw.route.biomes);
      if (!cleared) throw new Error('golden route has no Pom resolution to clear');
      return decodeProjectDocument(raw, catalog);
    })();
    const roster = applyProjectCommand(createCompleteFGAnomalyProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: anomalyRosterPhase,
      decisionKey: 'infiniteRoster',
      value: { kind: 'infiniteRoster', typeKeys: ['SpreadShotUnit', 'SpreadShotUnit_Elite'] },
    });
    const nemesisPhase = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-combat05') },
      'Passive',
    );
    const nemesis = applyProjectCommand(loadNemesisFieldsCheckpoint(), catalog, {
      kind: 'ReplaceNemesisRandomEventInteraction',
      event: createNemesisRandomEventAddress(nemesisPhase),
      value: { kind: 'freeItem', reward: null },
    });
    for (const project of [pom, roster, nemesis]) expect(check(project)).toEqual([]);
    expect(checked.pom).toBeGreaterThan(0);
    expect(checked.collapsed).toBeGreaterThan(0);
    expect(checked.roster).toBeGreaterThan(0);
    expect(checked.nemesis).toBeGreaterThan(0);
  });

  it('holds for a missing or illegal Gold duplicate Anvil result', () => {
    const illegal = createEchoGoldIAnvilDuplicateProject({
      ...echoGoldIDuplicateAnvilResult,
      // The first Anvil already removed this Hammer.
      removedTraitKey: 'StaffDoubleAttackTrait',
    });
    expect(check(illegal)).toEqual([]);
    expect(checked.anvil).toBeGreaterThan(0);
    checked.anvil = 0;
    expect(check(createEchoGoldIAnvilDuplicateProject())).toEqual([]);
    expect(checked.anvil).toBeGreaterThan(0);
    // A Time Piece conversion is repaired at the pickup outcome, not the Anvil launcher.
    const duplicate = createAcquisitionRoleAddress(
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId),
          'roomExit',
        ),
        'echoDoubleShopReward',
      ),
      'self',
    );
    const timePiece = applyProjectCommand(createEchoGoldIAnvilDuplicateProject(), catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: duplicate,
      value: { kind: 'timePiece' },
    });
    expect(check(timePiece)).toEqual([]);
  });

  it('holds for wheel, ship-phase, side-room, Hub-slot and Fields-spatial owners', () => {
    const base = loadSurfaceNOPQProject();
    const combat05 = workspaceLocalVisit(base, 'surface-n-combat05');
    let sideRooms = applyProjectCommand(base, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: combat05.order,
      occurrenceIds: [],
    });
    for (const slot of combat05.slots)
      sideRooms = applyProjectCommand(sideRooms, catalog, {
        kind: 'SetLocalVisitGeneration',
        slot: slot.address,
        generation: 'notGenerated',
      });
    const fieldsSpatial = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(
        createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-combat02')),
        { kind: 'entry' },
      ),
      pointId: null,
    });
    const wheelStore = applyProjectCommand(base, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: {
        kind: 'rewardWheel',
        routeKey: 'Surface',
        biomeKey: 'O',
        occurrenceId: createOccurrenceId('surface-o-combat01'),
        wheelKey: 'wheel1',
      },
      storeKey: 'MetaProgress',
    });
    // An incomplete open set is repaired by opening a slot of its Hub.
    const hubOpenSet = applyProjectCommand(base, catalog, {
      kind: 'CloseHubSlot',
      slot: {
        kind: 'hubSlot',
        routeKey: 'Surface',
        biomeKey: 'N',
        hubKey: 'hub',
        hubSlotKey: 'combat10',
      },
    });
    // Ship phase count owns no producible finding: its topology value stays authorable.
    for (const project of [sideRooms, fieldsSpatial, wheelStore, hubOpenSet])
      expect(check(project)).toEqual([]);
    expect(checked.localVisit).toBeGreaterThan(0);
    expect(checked.fieldsSpatial).toBeGreaterThan(0);
    expect(checked.wheel).toBeGreaterThan(0);
    expect(checked.hubSlot).toBeGreaterThan(0);
  });
});
