import {
  assessStartingArcanaGrasp,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createKeepsakeEquipResultAddress,
  deriveRouteLoadout,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
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
  KeepsakeEquipResultPicker,
  KeepsakeSelectionPicker,
} from '@planner/ui/editor/KeepsakePickers';
import { HexTreeEditor } from '@planner/ui/editor/rewards/HexTreeEditor';
import { FindingCount, SemanticOwnerMarker, StatusBadge } from '../feedback/EvaluationFeedback';

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
          <KeepsakeSelectionPicker
            id={`${workspaceRoute.routeKey}-starting-keepsake`}
            interaction={keepsake}
            label="Starting keepsake"
          />
          {pom === undefined ? null : (
            <KeepsakeEquipResultPicker
              id={`${workspaceRoute.routeKey}-jeweled-pom`}
              interaction={pom}
            />
          )}
          {experimentalHammer === undefined ? null : (
            <KeepsakeEquipResultPicker
              id={`${workspaceRoute.routeKey}-experimental-hammer`}
              interaction={experimentalHammer}
            />
          )}
          {transcendentEmbryo === undefined ? null : (
            <KeepsakeEquipResultPicker
              id={`${workspaceRoute.routeKey}-transcendent-embryo`}
              interaction={transcendentEmbryo}
            />
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
      {workspaceRoute.aspectHexTree === undefined ? null : (
        <HexTreeEditor
          address={workspaceRoute.aspectHexTree.address}
          domain={workspaceRoute.aspectHexTree.domain}
          onChange={(value) =>
            dispatch(
              authoredProjectCommandDispatched(
                workspaceRoute.aspectHexTree!.intentFor(value).command,
              ),
            )
          }
          transitionFor={workspaceRoute.aspectHexTree.transitionFor}
        />
      )}
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
