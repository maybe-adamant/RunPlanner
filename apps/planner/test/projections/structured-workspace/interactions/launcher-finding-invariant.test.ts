import { beforeEach, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
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
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  loadNemesisFieldsCheckpoint,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { createStructuredWorkspaceTestServices } from '@planner-test/fixtures/structuredWorkspace';

const services = createStructuredWorkspaceTestServices();
/** Launchers the walk actually checked, so the invariant is never vacuous. */
const checked = { trait: 0, encounter: 0, pom: 0, nemesis: 0, roster: 0 };
const compositionFindingCodes = new Set([
  'encounterCustomizationUnavailable',
  'encounterCustomizationRequired',
  'encounterIntroductionRequired',
]);

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
    // The encounter selector, an inline picker, repairs the phase's other findings.
    if (owner.kind === 'encounterPhase' && compositionFindingCodes.has(finding.code)) {
      const interaction = interactions.encounterCustomizations.get(semanticAddressKey(owner));
      if (interaction !== undefined) checked.encounter += 1;
      const roster = finding.evidence.decisionKey === 'infiniteRoster';
      if (roster && interaction !== undefined) checked.roster += 1;
      if (
        roster
          ? interaction !== undefined && interaction.infiniteRosterDraftFor === undefined
          : interaction?.generatedComposition?.editable === true &&
            interaction.generatedAssessment === undefined
      )
        disabled.push(`encounter ${finding.code} ${semanticAddressKey(owner)}`);
    }
    if (owner.kind === 'levelResolution') {
      const interaction = interactions.levelResolutions.get(semanticAddressKey(owner));
      if (interaction !== undefined) checked.pom += 1;
      if (interaction !== undefined && !interaction.contextReached)
        disabled.push(`pom ${finding.code} ${semanticAddressKey(owner)}`);
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
  return disabled;
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
    const golden = createGoldenFGHIProject();
    for (const project of [
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
    expect(checked.roster).toBeGreaterThan(0);
    expect(checked.nemesis).toBeGreaterThan(0);
  });
});
