import {
  assessStartingArcanaGrasp,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createKeepsakeEquipResultAddress,
  deriveRouteLoadout,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { useState } from 'react';

import { type RouteFeedbackPresentation } from '@planner/projections/evaluationProjection';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { type RootState, useAppDispatch } from '@planner/state/store';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import { workspaceInteractionKey } from '@planner/projections/structured-workspace';
import {
  useWorkspaceInteraction,
  useWorkspaceInteractionController,
} from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateSelectState,
} from '@planner/ui/feedback/candidatePresentation';
import { FindingCount, SemanticOwnerMarker, StatusBadge } from '../feedback/EvaluationFeedback';

type JeweledPomInteraction = Extract<
  import('@planner/projections/structured-workspace').WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'jeweledPom' } }
>;

const fearVowGridOrder = Object.freeze([
  'EnemyDamageShrineUpgrade',
  'EnemyHealthShrineUpgrade',
  'EnemyShieldShrineUpgrade',
  'EnemySpeedShrineUpgrade',
  'EnemyCountShrineUpgrade',
  'NextBiomeEnemyShrineUpgrade',
  'EnemyRespawnShrineUpgrade',
  'EnemyEliteShrineUpgrade',
  'HealingReductionShrineUpgrade',
  'ShopPricesShrineUpgrade',
  'MinibossCountShrineUpgrade',
  'BoonSkipShrineUpgrade',
  'BiomeSpeedShrineUpgrade',
  'LimitGraspShrineUpgrade',
  'BoonManaReserveShrineUpgrade',
  'BanUnpickedBoonsShrineUpgrade',
  'BossDifficultyShrineUpgrade',
] as const);

function jeweledPomLoadable(
  interaction: JeweledPomInteraction,
  value: NonNullable<JeweledPomInteraction['value']>,
): { readonly load: () => ReturnType<JeweledPomInteraction['load']> } {
  const load = interaction.load;
  return Object.freeze({ load: () => load(value) });
}

function RouteStartJeweledPomResultControl({
  interaction,
}: {
  readonly interaction: JeweledPomInteraction;
}) {
  const dispatch = useAppDispatch();
  const selected = interaction.value;
  const revision = selected?.traitKey ?? '';
  const [candidateInput, setCandidateInput] = useState(() => ({
    interaction,
    revision,
    loadable: jeweledPomLoadable(interaction, {
      traitKey: selected?.traitKey ?? '',
    }),
  }));
  if (candidateInput.interaction !== interaction || candidateInput.revision !== revision) {
    setCandidateInput({
      interaction,
      revision,
      loadable: jeweledPomLoadable(interaction, {
        traitKey: selected?.traitKey ?? '',
      }),
    });
  }
  const candidates = useWorkspaceInteraction(candidateInput.loadable);
  const candidateFor = (traitKey: string) =>
    candidates.result?.find((candidate) => candidate.value === traitKey);
  return (
    <fieldset className="field-control">
      <legend>Jeweled Pom result</legend>
      <select
        aria-label="Jeweled Pom result"
        id={`${interaction.owner.routeKey}-jeweled-pom`}
        value={selected?.traitKey ?? ''}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        onChange={(event) => {
          const traitKey = event.target.value;
          if (traitKey === '') return;
          const option = candidateFor(traitKey);
          if (candidateMayBeAuthored(option))
            dispatch(
              authoredProjectCommandDispatched(
                interaction.intentFor({
                  ...(selected ?? {}),
                  traitKey,
                }).command,
              ),
            );
        }}
      >
        <option value="">Choose Hades trait</option>
        {interaction.choices.map((choice) => {
          const option = candidateFor(choice.value);
          return (
            <option
              key={choice.value}
              value={choice.value}
              disabled={option !== undefined && !candidateMayBeAuthored(option)}
              {...candidateSelectState(option)}
            >
              {choice.label}
            </option>
          );
        })}
      </select>
    </fieldset>
  );
}

function RouteStartTranscendentEmbryoResultControl({
  interaction,
}: {
  readonly interaction: Extract<
    import('@planner/projections/structured-workspace').WorkspaceKeepsakeEquipResultInteraction,
    { readonly owner: { readonly resultKind: 'transcendentEmbryo' } }
  >;
}) {
  const dispatch = useAppDispatch();
  const candidates = useWorkspaceInteraction(interaction);
  const candidateFor = (blessingKey: string) =>
    candidates.result?.find((candidate) => candidate.value === blessingKey);
  const summary = candidateFor(interaction.value?.blessingKey ?? '')?.transcendentEmbryoSummary;
  return (
    <fieldset className="field-control">
      <legend>Transcendent Embryo result</legend>
      <select
        aria-label="Transcendent Embryo result"
        id={`${interaction.owner.routeKey}-transcendent-embryo`}
        onChange={(event) => {
          const blessingKey = event.target.value;
          if (blessingKey === '') return;
          const option = candidateFor(blessingKey);
          if (candidateMayBeAuthored(option))
            dispatch(
              authoredProjectCommandDispatched(interaction.intentFor({ blessingKey }).command),
            );
        }}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        value={interaction.value?.blessingKey ?? ''}
      >
        <option value="">Choose Chaos blessing</option>
        {interaction.choices.map((choice) => {
          const option = candidateFor(choice.value);
          return (
            <option
              key={choice.value}
              value={choice.value}
              disabled={option !== undefined && !candidateMayBeAuthored(option)}
              {...candidateSelectState(option)}
            >
              {choice.label}
            </option>
          );
        })}
      </select>
      {summary === undefined ? null : (
        <p className="field-description">
          {summary.rarity} ·{' '}
          {summary.operands.map((operand) => `${operand.label}: ${operand.value}`).join(', ') ||
            'No numeric operands'}
        </p>
      )}
    </fieldset>
  );
}

function presentBiomeList(labels: readonly string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0]!;
  const last = labels[labels.length - 1]!;
  if (labels.length === 2) return `${labels[0]} and ${last}`;
  return `${labels.slice(0, -1).join(', ')}, and ${last}`;
}

export function RouteOverview({
  catalog,
  label,
  navigation,
  feedback,
  project,
  workspaceRoute,
  interactions,
}: {
  readonly catalog: Catalog;
  readonly label: string;
  readonly navigation: RouteEditorNavigation;
  readonly feedback: RouteFeedbackPresentation;
  readonly project: RootState['projectWorkspace']['history']['present'];
  readonly workspaceRoute: WorkspaceRoute;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const dispatch = useAppDispatch();
  const configuredBiomeCount = workspaceRoute.biomes.length;
  const configuredBiomeLabels = navigation.biomePanels
    .slice(0, configuredBiomeCount)
    .map((biome) => biome.label);
  const lastConfiguredBiome = configuredBiomeLabels[configuredBiomeLabels.length - 1];
  const routeExtent =
    lastConfiguredBiome === undefined ? 'No biomes' : `Through ${lastConfiguredBiome}`;
  const routeDescription =
    configuredBiomeLabels.length === 0
      ? 'No biomes configured.'
      : `Configuring ${presentBiomeList(configuredBiomeLabels)}.`;
  const authoredRoute = project.routes.find((route) => route.routeKey === workspaceRoute.routeKey);
  if (authoredRoute === undefined)
    throw new Error(`Missing authored route ${workspaceRoute.routeKey}`);
  const weapon = catalog.weapons.byKey[authoredRoute.loadout.weaponKey];
  if (weapon === undefined) throw new Error(`Missing weapon ${authoredRoute.loadout.weaponKey}`);
  const derivedLoadout = deriveRouteLoadout(catalog, authoredRoute.loadout);
  const arcanaCards = catalog.arcanaCards.values;
  const fearVows = fearVowGridOrder.flatMap((key) => {
    const vow = catalog.fearVows.byKey[key];
    return vow === undefined ? [] : [vow];
  });
  const manualArcanaKeys = authoredRoute.loadout.manualArcanaKeys;
  const fearRanks = authoredRoute.loadout.fearRanks;
  const startingKeepsake = createRouteStartKeepsakeSelectionAddress(workspaceRoute.routeKey);
  const keepsake = interactions.keepsakeSelections.get(workspaceInteractionKey(startingKeepsake));
  if (keepsake === undefined)
    throw new Error(`Missing starting keepsake interaction for ${workspaceRoute.routeKey}`);
  const keepsakeCandidates = useWorkspaceInteraction(keepsake);
  const pomAddress = createKeepsakeEquipResultAddress(startingKeepsake, 'jeweledPom');
  const pom = interactions.keepsakeEquipResults.get(workspaceInteractionKey(pomAddress)) as
    | Extract<
        import('@planner/projections/structured-workspace').WorkspaceKeepsakeEquipResultInteraction,
        { readonly owner: { readonly resultKind: 'jeweledPom' } }
      >
    | undefined;
  const experimentalHammerAddress = createKeepsakeEquipResultAddress(
    startingKeepsake,
    'experimentalHammer',
  );
  const experimentalHammer = interactions.keepsakeEquipResults.get(
    workspaceInteractionKey(experimentalHammerAddress),
  ) as
    | Extract<
        import('@planner/projections/structured-workspace').WorkspaceKeepsakeEquipResultInteraction,
        { readonly owner: { readonly resultKind: 'experimentalHammer' } }
      >
    | undefined;
  const transcendentEmbryoAddress = createKeepsakeEquipResultAddress(
    startingKeepsake,
    'transcendentEmbryo',
  );
  const transcendentEmbryo = interactions.keepsakeEquipResults.get(
    workspaceInteractionKey(transcendentEmbryoAddress),
  ) as
    | Extract<
        import('@planner/projections/structured-workspace').WorkspaceKeepsakeEquipResultInteraction,
        { readonly owner: { readonly resultKind: 'transcendentEmbryo' } }
      >
    | undefined;
  const experimentalHammerCandidateController =
    useWorkspaceInteractionController<
      readonly import('@planner/projections/candidateProjection').CandidateOptionProjection<string>[]
    >();
  const experimentalHammerCandidates =
    experimentalHammerCandidateController.observe(experimentalHammer);
  const experimentalHammerCandidateFor = (traitKey: string) =>
    experimentalHammerCandidates.result?.find((candidate) => candidate.value === traitKey);
  return (
    <section className="route-overview">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Route settings</p>
          <h2>{label}</h2>
        </div>
        <div className="panel-heading-actions">
          <SemanticOwnerMarker address={workspaceRoute.marker.address} />
          <StatusBadge status={feedback.status} />
          <FindingCount count={feedback.findingCount} label={`${label} findings`} />
          <span className="neutral-status">{routeExtent}</span>
        </div>
      </header>
      <label className="field-control" htmlFor={`${workspaceRoute.routeKey}-configured-prefix`}>
        <span>Configure route up to</span>
        <select
          disabled={navigation.biomePanels.length === 0 && configuredBiomeCount === 0}
          id={`${workspaceRoute.routeKey}-configured-prefix`}
          onChange={(event) => {
            const nextConfiguredBiomeCount = Number(event.target.value);
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ConfigureRoutePrefix',
                route: createRouteAddress(workspaceRoute.routeKey),
                configuredBiomeCount: nextConfiguredBiomeCount,
              }),
            );
          }}
          value={configuredBiomeCount}
        >
          <option value={0}>No biomes</option>
          {navigation.biomePanels.map((biome, index) => (
            <option key={biome.biomeKey} value={index + 1}>
              {biome.label}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-description">{routeDescription}</p>
      <div className="route-loadout-controls">
        <div className="route-keepsake-controls">
          <label className="field-control" htmlFor={`${workspaceRoute.routeKey}-starting-keepsake`}>
            <span>Starting keepsake</span>
            <select
              aria-busy={keepsakeCandidates.pending || undefined}
              id={`${workspaceRoute.routeKey}-starting-keepsake`}
              onChange={(event) => {
                const key = event.target.value;
                const option = keepsakeCandidates.result?.find(
                  (candidate) => candidate.value === key,
                );
                if (candidateMayBeAuthored(option))
                  dispatch(authoredProjectCommandDispatched(keepsake.replaceIntent(key).command));
              }}
              onFocus={keepsakeCandidates.activate}
              onPointerDown={keepsakeCandidates.activate}
              value={authoredRoute.loadout.startingKeepsakeKey}
            >
              {keepsake.choices.map((choice) => {
                const option = keepsakeCandidates.result?.find(
                  (candidate) => candidate.value === choice.value,
                );
                return (
                  <option
                    key={choice.value}
                    value={choice.value}
                    disabled={option !== undefined && !candidateMayBeAuthored(option)}
                    {...candidateSelectState(option)}
                  >
                    {choice.label}
                  </option>
                );
              })}
            </select>
          </label>
          {pom === undefined ? null : <RouteStartJeweledPomResultControl interaction={pom} />}
          {experimentalHammer === undefined ? null : (
            <fieldset className="field-control">
              <legend>Experimental Hammer result</legend>
              <select
                aria-busy={experimentalHammerCandidates.pending || undefined}
                aria-label="Experimental Hammer result"
                id={`${workspaceRoute.routeKey}-experimental-hammer`}
                onChange={(event) => {
                  const traitKey = event.target.value;
                  if (traitKey === '') return;
                  const option = experimentalHammerCandidateFor(traitKey);
                  if (candidateMayBeAuthored(option))
                    dispatch(
                      authoredProjectCommandDispatched(
                        experimentalHammer.intentFor(
                          traitKey === '__exhausted'
                            ? { kind: 'exhausted' }
                            : { kind: 'selected', traitKey },
                        ).command,
                      ),
                    );
                }}
                onFocus={() =>
                  experimentalHammer !== undefined &&
                  experimentalHammerCandidateController.activate(experimentalHammer)
                }
                onPointerDown={() =>
                  experimentalHammer !== undefined &&
                  experimentalHammerCandidateController.activate(experimentalHammer)
                }
                value={
                  experimentalHammer.value?.kind === 'selected'
                    ? experimentalHammer.value.traitKey
                    : experimentalHammer.value?.kind === 'exhausted'
                      ? '__exhausted'
                      : ''
                }
              >
                <option value="">Choose compatible Hammer</option>
                {experimentalHammer.choices.map((choice) => {
                  const option = experimentalHammerCandidateFor(choice.value);
                  return (
                    <option
                      key={choice.value}
                      value={choice.value}
                      disabled={option !== undefined && !candidateMayBeAuthored(option)}
                      {...candidateSelectState(option)}
                    >
                      {choice.label}
                    </option>
                  );
                })}
              </select>
            </fieldset>
          )}
          {transcendentEmbryo === undefined ? null : (
            <RouteStartTranscendentEmbryoResultControl interaction={transcendentEmbryo} />
          )}
        </div>
        <div className="route-weapon-controls">
          <label className="field-control" htmlFor={`${workspaceRoute.routeKey}-weapon`}>
            <span>Weapon</span>
            <select
              id={`${workspaceRoute.routeKey}-weapon`}
              onChange={(event) => {
                const next = catalog.weapons.byKey[event.target.value];
                if (next === undefined) return;
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ReplaceRouteLoadout',
                    route: createRouteAddress(workspaceRoute.routeKey),
                    weaponKey: next.key,
                    aspectKey: next.defaultAspectKey,
                  }),
                );
              }}
              value={weapon.key}
            >
              {catalog.weapons.values.map((candidate) => (
                <option key={candidate.key} value={candidate.key}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-control" htmlFor={`${workspaceRoute.routeKey}-aspect`}>
            <span>Aspect</span>
            <select
              id={`${workspaceRoute.routeKey}-aspect`}
              onChange={(event) =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ReplaceRouteLoadout',
                    route: createRouteAddress(workspaceRoute.routeKey),
                    weaponKey: weapon.key,
                    aspectKey: event.target.value,
                  }),
                )
              }
              value={authoredRoute.loadout.aspectKey}
            >
              {weapon.aspectKeys.map((aspectKey) => {
                const aspect = catalog.aspects.byKey[aspectKey];
                if (aspect === undefined) return null;
                return (
                  <option key={aspect.key} value={aspect.key}>
                    {aspect.label}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
      </div>
      <details
        aria-label={`Arcana, ${derivedLoadout.activeArcanaKeys.length} active`}
        className="route-loadout-section"
      >
        <summary>
          Arcana{' '}
          <span>
            {derivedLoadout.activeArcanaKeys.length} active ·{' '}
            {derivedLoadout.startingArcanaGrasp.cost} /{' '}
            {derivedLoadout.startingArcanaGrasp.capacity} Grasp
          </span>
        </summary>
        <div className="arcana-board">
          {arcanaCards.map((card) => {
            const automatic = card.activation.kind === 'automatic';
            const selected = automatic
              ? derivedLoadout.automaticArcanaKeys.includes(card.key)
              : manualArcanaKeys.includes(card.key);
            const proposedManualArcanaKeys = selected
              ? manualArcanaKeys.filter((key) => key !== card.key)
              : [...manualArcanaKeys, card.key];
            const proposal = automatic
              ? undefined
              : assessStartingArcanaGrasp(catalog, proposedManualArcanaKeys, fearRanks);
            const exceedsGrasp = !selected && proposal?.legal === false;
            return (
              <label
                key={card.key}
                className="arcana-card-control"
                data-automatic={automatic}
                title={
                  exceedsGrasp
                    ? `${proposal.cost} Grasp exceeds the starting capacity of ${proposal.capacity}`
                    : undefined
                }
              >
                <span>
                  {card.label}
                  {automatic ? ' (automatic)' : ''}
                </span>
                <input
                  checked={selected}
                  disabled={automatic || exceedsGrasp}
                  onChange={() =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceManualArcanaSelection',
                        route: createRouteAddress(workspaceRoute.routeKey),
                        arcanaKeys: proposedManualArcanaKeys,
                      }),
                    )
                  }
                  type="checkbox"
                />
              </label>
            );
          })}
        </div>
      </details>
      <details
        aria-label={`Fear, ${derivedLoadout.fearTotal} total`}
        className="route-loadout-section"
      >
        <summary>
          Fear <span>{derivedLoadout.fearTotal} total</span>
        </summary>
        <div className="fear-rank-list">
          {fearVows.map((vow) => (
            <label
              key={vow.key}
              className="field-control fear-rank-control"
              data-fear-vow-key={vow.key}
              data-rival={vow.key === 'BossDifficultyShrineUpgrade' || undefined}
            >
              <span>{vow.label}</span>
              <select
                aria-label={`${vow.label} rank`}
                value={fearRanks[vow.key]}
                onChange={(event) =>
                  dispatch(
                    authoredProjectCommandDispatched({
                      kind: 'ReplaceFearVowRank',
                      route: createRouteAddress(workspaceRoute.routeKey),
                      vowKey: vow.key,
                      rank: Number(event.target.value),
                    }),
                  )
                }
              >
                {Array.from({ length: vow.incrementalFear.length + 1 }, (_, rank) => (
                  <option
                    key={rank}
                    value={rank}
                    disabled={
                      !assessStartingArcanaGrasp(catalog, manualArcanaKeys, {
                        ...fearRanks,
                        [vow.key]: rank,
                      }).legal
                    }
                  >
                    {rank}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
