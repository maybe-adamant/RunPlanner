import { useState } from 'react';
import {
  assessStartingArcanaGrasp,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createKeepsakeEquipResultAddress,
  deriveRouteLoadout,
  routeInitialProfile,
  type BooleanRunModifierDeclaration,
  type NumberRunModifierDeclaration,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type RouteFeedbackPresentation } from '@planner/projections/evaluationProjection';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
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
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { FindingCount, StatusBadge } from '../feedback/EvaluationFeedback';
import { useFindingTarget } from '../feedback/useFindingTarget';
import { RouteWeaponPicker } from './RouteWeaponPicker';
import { ArcanaCard } from '@planner/ui/controls/arcana-fear/ArcanaCard';
import { FearCard } from '@planner/ui/controls/arcana-fear/FearCard';

import { ArcanaFearDialog } from '@planner/ui/controls/arcana-fear/ArcanaFearDialog';

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
  readonly project: ProjectDocument;
  readonly workspaceRoute: WorkspaceRoute;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const replacementRevision = useAppSelector(
    (state) => state.editorSession.workspaceReplacementRevision,
  );
  const configuredBiomeCount = workspaceRoute.biomes.length;
  const configuredBiomeLabels = navigation.biomePanels
    .slice(0, configuredBiomeCount)
    .map((biome) => biome.label);
  const lastConfiguredBiome = configuredBiomeLabels[configuredBiomeLabels.length - 1];
  const routeExtent =
    lastConfiguredBiome === undefined ? 'No biomes' : `Through ${lastConfiguredBiome}`;
  const authoredRoute =
    project.route.routeKey === workspaceRoute.routeKey ? project.route : undefined;
  if (authoredRoute === undefined)
    throw new Error(`Missing authored route ${workspaceRoute.routeKey}`);
  const initialProfile = routeInitialProfile(catalog, workspaceRoute.routeKey);
  return (
    <section
      className="route-overview"
      {...findingTarget(workspaceRoute.marker.address)}
      tabIndex={-1}
    >
      <header className="panel-heading">
        <h2 className="eyebrow route-loadout-heading">Loadout</h2>
        <div className="panel-heading-actions">
          <StatusBadge status={feedback.status} />
          <FindingCount count={feedback.findingCount} label={`${label} findings`} />
          <span className="neutral-status">{routeExtent}</span>
        </div>
      </header>
      <div className="route-scope field-control field-control-inline">
        <span>Plan up to</span>
        <div className="route-prefix-options" role="radiogroup" aria-label="Biomes to configure">
          {navigation.biomePanels.map((biome, index) => (
            <label key={biome.biomeKey} title={`Through ${biome.label}`}>
              <input
                type="radio"
                name={`${workspaceRoute.routeKey}-configured-prefix`}
                value={index + 1}
                checked={configuredBiomeCount === index + 1}
                onChange={() =>
                  dispatch(
                    authoredProjectCommandDispatched({
                      kind: 'ConfigureRoutePrefix',
                      route: createRouteAddress(workspaceRoute.routeKey),
                      configuredBiomeCount: index + 1,
                    }),
                  )
                }
              />
              {biome.label}
            </label>
          ))}
        </div>
      </div>
      {initialProfile.kind === 'freshFile' ? (
        <FreshFileLoadout catalog={catalog} fixedWeaponKey={initialProfile.fixedWeaponKey} />
      ) : (
        <MatureRouteLoadout
          authoredRoute={authoredRoute}
          catalog={catalog}
          interactions={interactions}
          workspaceRoute={workspaceRoute}
        />
      )}
      <RunModifiersEditor
        key={`${project.projectId}:${replacementRevision}`}
        workspaceRoute={workspaceRoute}
      />
    </section>
  );
}

/** A fresh profile's fixed weapon; Arcana, Fear, keepsake and starting reward do not exist there. */
function FreshFileLoadout({
  catalog,
  fixedWeaponKey,
}: {
  readonly catalog: Catalog;
  readonly fixedWeaponKey: string;
}) {
  const weapon = catalog.weapons.byKey[fixedWeaponKey];
  return (
    <div className="route-loadout-panel route-fixed-loadout">
      <dl aria-label="Fixed starting loadout" className="route-fixed-loadout-facts">
        <div>
          <dt>Weapon</dt>
          <dd>{weapon?.label ?? fixedWeaponKey}, no Aspect</dd>
        </div>
      </dl>
    </div>
  );
}

function MatureRouteLoadout({
  authoredRoute,
  catalog,
  interactions,
  workspaceRoute,
}: {
  readonly authoredRoute: ProjectDocument['route'];
  readonly catalog: Catalog;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const startingReward = workspaceRoute.startingReward;
  if (startingReward === undefined)
    throw new Error(`Missing starting reward control for ${workspaceRoute.routeKey}`);
  const weaponKey = authoredRoute.loadout.weaponKey;
  const aspectKey = authoredRoute.loadout.aspectKey;
  const weapon = weaponKey === null ? undefined : catalog.weapons.byKey[weaponKey];
  if (weapon === undefined || aspectKey === null)
    throw new Error(`Missing weapon ${String(weaponKey)}`);
  const derivedLoadout = deriveRouteLoadout(catalog, authoredRoute.loadout);
  const arcanaCards = catalog.arcanaCards.values;
  const fearVows = fearVowGridOrder.flatMap((key) => {
    const vow = catalog.fearVows.byKey[key];
    return vow === undefined ? [] : [vow];
  });
  const manualArcanaKeys = authoredRoute.loadout.manualArcanaKeys;
  const fearRanks = authoredRoute.loadout.fearRanks;
  const activeFearCount = fearVows.filter((vow) => fearRanks[vow.key]! > 0).length;
  const maximumFear = fearVows.reduce(
    (total, vow) => total + vow.incrementalFear.reduce((sum, fear) => sum + fear, 0),
    0,
  );
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
  const [dialog, setDialog] = useState<'Arcana' | 'Fear'>();
  return (
    <>
      <div className="route-loadout-panel">
        <div className="route-loadout-controls">
          <RouteWeaponPicker
            catalog={catalog}
            id={`${workspaceRoute.routeKey}-weapon-aspect`}
            weaponKey={weapon.key}
            aspectKey={aspectKey}
            onSelect={(weaponKey, aspectKey) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceRouteLoadout',
                  route: createRouteAddress(workspaceRoute.routeKey),
                  weaponKey,
                  aspectKey,
                }),
              )
            }
          />
          <div className="field-control field-control-inline loadout-dialog-launcher">
            <label htmlFor={`${workspaceRoute.routeKey}-arcana`}>Starting Arcana</label>
            <button
              id={`${workspaceRoute.routeKey}-arcana`}
              className="contextual-picker-trigger"
              type="button"
              aria-label="Edit Arcana"
              aria-haspopup="dialog"
              onClick={() => setDialog('Arcana')}
            >
              Arcana · {derivedLoadout.activeArcanaKeys.length} active ·{' '}
              {derivedLoadout.startingArcanaGrasp.cost}/
              {derivedLoadout.startingArcanaGrasp.capacity} Grasp
            </button>
          </div>
          <div className="field-control field-control-inline loadout-dialog-launcher">
            <label htmlFor={`${workspaceRoute.routeKey}-fear`}>Starting Fear</label>
            <button
              id={`${workspaceRoute.routeKey}-fear`}
              className="contextual-picker-trigger"
              type="button"
              aria-label="Edit Fear"
              aria-haspopup="dialog"
              onClick={() => setDialog('Fear')}
            >
              Fear · {activeFearCount} active · {derivedLoadout.fearTotal}/{maximumFear} Fear
            </button>
          </div>
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
        {dialog === 'Arcana' ? (
          <ArcanaFearDialog title="Arcana" kind="arcana" onClose={() => setDialog(undefined)}>
            <section
              role="group"
              aria-label={`Arcana, ${derivedLoadout.activeArcanaKeys.length} active`}
              className="route-loadout-section"
            >
              <div className="arcana-summary-line">
                <p className="route-loadout-summary">
                  Arcana{' '}
                  <span>
                    {derivedLoadout.activeArcanaKeys.length} active ·{' '}
                    {derivedLoadout.startingArcanaGrasp.cost} /{' '}
                    {derivedLoadout.startingArcanaGrasp.capacity} Grasp
                  </span>
                </p>
                <p className="arcana-legend">Grayscale: inactive · Color: active</p>
              </div>
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
                    <ArcanaCard
                      key={card.key}
                      cardKey={card.key}
                      rarity={
                        workspaceRoute.startingArcana.find((active) => active.key === card.key)
                          ?.rarity
                      }
                      label={`${card.label}${automatic ? ' (automatic)' : ''}`}
                      data-automatic={automatic}
                      aria-pressed={selected}
                      disabled={automatic || exceedsGrasp}
                      type="button"
                      onClick={() =>
                        dispatch(
                          authoredProjectCommandDispatched({
                            kind: 'ReplaceManualArcanaSelection',
                            route: createRouteAddress(workspaceRoute.routeKey),
                            arcanaKeys: proposedManualArcanaKeys,
                          }),
                        )
                      }
                      title={
                        exceedsGrasp
                          ? `${proposal.cost} Grasp exceeds the starting capacity of ${proposal.capacity}`
                          : automatic
                            ? 'Activates automatically when its conditions are met.'
                            : undefined
                      }
                    />
                  );
                })}
              </div>
            </section>
          </ArcanaFearDialog>
        ) : null}
        {dialog === 'Fear' ? (
          <ArcanaFearDialog title="Fear" kind="fear" onClose={() => setDialog(undefined)}>
            <section
              role="group"
              aria-label={`Fear, ${derivedLoadout.fearTotal} total`}
              className="route-loadout-section"
            >
              <p className="route-loadout-summary">
                Fear <span>{derivedLoadout.fearTotal} total</span>
              </p>
              <p className="panel-description">Click to cycle ranks · Right-click to reset</p>
              <div className="fear-rank-list">
                {fearVows.map((vow) => {
                  const rank = fearRanks[vow.key] ?? 0;
                  const maximum = vow.incrementalFear.length;
                  const nextRank = rank >= maximum ? 0 : rank + 1;
                  const canSetRank = (value: number) =>
                    assessStartingArcanaGrasp(catalog, manualArcanaKeys, {
                      ...fearRanks,
                      [vow.key]: value,
                    }).legal;
                  const canAdvance = canSetRank(nextRank);
                  const setRank = (value: number) => {
                    if (value === rank || !canSetRank(value)) return;
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceFearVowRank',
                        route: createRouteAddress(workspaceRoute.routeKey),
                        vowKey: vow.key,
                        rank: value,
                      }),
                    );
                  };
                  return (
                    <FearCard
                      key={vow.key}
                      vowKey={vow.key}
                      label={vow.label}
                      rank={rank}
                      maximum={maximum}
                      type="button"
                      className="fear-rank-control"
                      aria-label={`${vow.label}, rank ${rank} of ${maximum}`}
                      aria-disabled={!canAdvance}
                      data-active={rank > 0 || undefined}
                      title={
                        canAdvance
                          ? undefined
                          : 'This rank would exceed your available Arcana Grasp. Lower Arcana Grasp first.'
                      }
                      data-fear-vow-key={vow.key}
                      data-rival={vow.key === 'BossDifficultyShrineUpgrade' || undefined}
                      onClick={() => setRank(nextRank)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setRank(0);
                      }}
                    />
                  );
                })}
              </div>
            </section>
          </ArcanaFearDialog>
        ) : null}
      </div>
      <div className="route-configuration">
        <RewardControlEditor
          control={startingReward}
          idPrefix={`${workspaceRoute.routeKey}-starting-reward`}
          interactions={interactions}
          label="Starting reward"
        />
      </div>
    </>
  );
}

function RunModifiersEditor({ workspaceRoute }: { readonly workspaceRoute: WorkspaceRoute }) {
  const control = workspaceRoute.runModifiers;
  const prefix = `${workspaceRoute.routeKey}-run-modifiers`;
  return (
    <section
      className="route-run-modifiers route-loadout-section"
      aria-labelledby={`${prefix}-heading`}
    >
      <header className="panel-heading">
        <h2 id={`${prefix}-heading`} className="eyebrow route-loadout-heading">
          Modifiers
        </h2>
      </header>
      <div className="route-run-modifier-controls">
        {control.declarations.map((declaration) =>
          declaration.kind === 'boolean' ? (
            <BooleanRunModifierToggle
              key={declaration.key}
              control={control}
              declaration={declaration}
            />
          ) : (
            <NumberRunModifierSlider
              key={declaration.key}
              control={control}
              declaration={declaration}
              id={`${prefix}-${declaration.key}`}
            />
          ),
        )}
      </div>
    </section>
  );
}

function BooleanRunModifierToggle({
  control,
  declaration,
}: {
  readonly control: WorkspaceRoute['runModifiers'];
  readonly declaration: BooleanRunModifierDeclaration;
}) {
  const dispatch = useAppDispatch();
  const values: Readonly<Record<string, boolean | number>> = control.value;
  return (
    <label className="route-run-modifier-toggle" title={declaration.description}>
      <span>{declaration.label}</span>
      <input
        type="checkbox"
        aria-description={declaration.description}
        checked={values[declaration.key] === true}
        onChange={(event) =>
          dispatch(
            authoredProjectCommandDispatched(
              control.setValue(declaration, event.target.checked).command,
            ),
          )
        }
      />
    </label>
  );
}

const SLIDER_COMMIT_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
];

function NumberRunModifierSlider({
  control,
  declaration,
  id,
}: {
  readonly control: WorkspaceRoute['runModifiers'];
  readonly declaration: NumberRunModifierDeclaration;
  readonly id: string;
}) {
  const dispatch = useAppDispatch();
  const values: Readonly<Record<string, boolean | number>> = control.value;
  const authored = Number(values[declaration.key]);
  const [draft, setDraft] = useState<{
    readonly source: number;
    readonly text: string;
    readonly error?: string;
  }>();
  // An authored replacement (including history restoration) supersedes its draft.
  if (draft !== undefined && draft.source !== authored) setDraft(undefined);
  const currentDraft = draft?.source === authored ? draft : undefined;
  const shown = currentDraft?.text ?? String(authored);
  const vanilla = Number(shown) === declaration.default ? ' (Vanilla)' : '';
  const commit = () => {
    if (currentDraft === undefined) return;
    const result = control.draftIntent(declaration, currentDraft.text);
    if (result.kind === 'invalid') {
      setDraft({ ...currentDraft, error: result.message });
      return;
    }
    setDraft(undefined);
    dispatch(authoredProjectCommandDispatched(result.intent.command));
  };
  const error = currentDraft?.error;
  return (
    <div className="route-run-modifier-number" title={error ?? declaration.description}>
      <label htmlFor={id}>{declaration.label}</label>
      <div className="route-run-modifier-multiplier">
        <input
          id={id}
          aria-description={error ?? declaration.description}
          aria-invalid={error === undefined ? undefined : true}
          type="range"
          min={declaration.min}
          max={declaration.max}
          step={declaration.step}
          value={shown}
          aria-valuetext={`${shown}${declaration.unit}${vanilla}`}
          onChange={(event) => setDraft({ source: authored, text: event.target.value })}
          onPointerUp={commit}
          onKeyUp={(event) => {
            if (SLIDER_COMMIT_KEYS.includes(event.key)) commit();
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(undefined);
            }
          }}
        />
        <output htmlFor={id}>
          {shown}
          {declaration.unit}
          {vanilla}
        </output>
      </div>
    </div>
  );
}
