import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_DRAFT_PURCHASES_PER_BIOME,
  DEFAULT_DRAFT_RESOURCE_ROOM_CHANCE,
  DEFAULT_DRAFT_RETRIES_PER_BIOME,
  DEFAULT_DRAFT_ROOM_FORCING,
  DRAFT_PURCHASES_PER_BIOME_RANGE,
  DRAFT_RESOURCE_ROOM_CHANCE_RANGE,
  DRAFT_RETRIES_PER_BIOME_RANGE,
  createRouteAddress,
  draftAdvancedChanged,
  routeInitialProfile,
  withDraftAdvancedDefaults,
  withDraftGodBoons,
  withDraftPerGodCap,
  withDraftPreferMidshops,
  withDraftPurchasesPerBiome,
  withDraftPursueTartarusGoal,
  withDraftResourceRoomChance,
  withDraftRetriesPerBiome,
  withDraftRoomForcing,
  type AuthoredDraftSpec,
  type DraftRoomForcing,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  draftRefusals,
  forcesGod,
  type DraftNpcOption,
  type DraftRefusal,
  type DraftTargetResult,
  type DraftWorldOptions,
} from '@run-planner/engine/simulation';

import {
  draftSlotList,
  draftWorldHasNpcs,
  projectDraftFirstBoonTag,
  projectDraftGodTags,
  type DraftRuleTag,
  projectDraftBasket,
  projectDraftSpec,
  withDraftBasketTraitToggled,
  withDraftFieldNpcToggled,
  withDraftGodToggled,
  projectDraftBudget,
  withDraftRackKeepsake,
  withDraftStoryNpcToggled,
  type DraftBasketChipGroup,
  type DraftRackSlot,
} from '@planner/projections/draftSpec';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import type { DraftRunState } from '@planner/state/draftSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { npcArtwork } from '@planner/ui/artwork/npcs/npcArtwork';
import { traitGiverArtwork } from '@planner/ui/artwork/trait-givers/traitGiverArtwork';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { biomeIcon } from '@planner/ui/artwork/roomArtwork';
import { KeepsakeLauncher, KeepsakeRackDialog } from '@planner/ui/controls/keepsakes/KeepsakeRack';
import { ActionIcon } from '@planner/ui/controls/ActionIcon';
import { hintProps } from '@planner/ui/controls/hint';
import type { DraftRunController } from '@planner/workspace/draftRun';
import { DraftBasketDialog } from './DraftBasketDialog';
import { DraftCapCount } from './DraftCapCount';
import { DraftShareControls } from './DraftShareControls';
import { RouteLoadoutControls } from './RouteLoadoutControls';
import { FreshFileLoadout } from './RouteLoadoutPanel';
import { RoutePrefixControl } from './RoutePrefixControl';
import { useCommonItemWidth } from './useCommonItemWidth';

/** Why a draft cannot start, when nothing else on the panel already shows it. */
function refusalHint(catalog: Catalog, refusal: DraftRefusal | undefined): string | undefined {
  if (refusal === undefined) return undefined;
  switch (refusal.kind) {
    case 'godStartingKeepsake':
      return `${catalog.keepsakes.byKey[refusal.keepsakeKey]?.label ?? refusal.keepsakeKey} brings in a god, so it can't start a draft.`;
    case 'rackKeepsake':
      return refusal.reason === 'forcesGod'
        ? `${catalog.keepsakes.byKey[refusal.keepsakeKey]?.label ?? refusal.keepsakeKey} brings in a god, so a rack can't take it.`
        : undefined;
    case 'invalidLoadout':
      return 'The loadout is not complete.';
    case 'tooFewGods':
      return `Choose at least ${refusal.minGods} gods.`;
    case 'requiredGod':
    case 'godUnreachable':
    case 'firstOfferBlocked':
      return godRefusalNote(catalog, refusal);
    case 'basketTrait':
    case 'unknownTrait':
      return 'Remove the marked basket traits first.';
    case 'startingKeepsakeResult':
      return keepsakeResultNote(catalog, refusal);
    default:
      return undefined;
  }
}

/** Why the starting keepsake's chosen result contradicts the basket. */
function keepsakeResultNote(
  catalog: Catalog,
  refusal: Extract<DraftRefusal, { readonly kind: 'startingKeepsakeResult' }>,
): string {
  const trait = (key: string) => catalog.traits.byKey[key]?.label ?? key;
  const chosen = `The starting keepsake's ${trait(refusal.traitKey)}`;
  switch (refusal.conflict.kind) {
    case 'slotTaken':
      return `${chosen} takes ${trait(refusal.conflict.traitKey)}'s slot.`;
    case 'hammerOrder':
      return `${chosen} comes after ${trait(refusal.conflict.traitKey)} in the basket.`;
    case 'hammerCap':
      return `${chosen} is one Hammer past the cap of ${refusal.conflict.cap}.`;
    case 'supplyCap':
      return `${chosen} is one Hermes or Hammer trait past the cap of ${refusal.conflict.cap}.`;
  }
}

/** A god pool or first-boon refusal, as the Draft button's reason. */
function godRefusalNote(catalog: Catalog, refusal: DraftRefusal): string | undefined {
  const god = (key: string) => catalog.traitGivers.byKey[key]?.label ?? key;
  switch (refusal.kind) {
    case 'requiredGod':
      return `The run opens with ${god(refusal.godKey)}'s boon, so ${god(refusal.godKey)} leads the pool.`;
    case 'godUnreachable':
      return `${god(refusal.godKey)} needs ${refusal.needsGodKeys.map(god).join(' or ')} in the pool.`;
    case 'firstOfferBlocked':
      return `${god(refusal.godKey)}'s first boon needs a free ${draftSlotList(catalog, refusal.traitKeys)} slot.`;
    default:
      return undefined;
  }
}

/** A section's fixed rule tags on its title line: faint, outlined while the saved draft breaks one. */
function RuleTags({
  label,
  tags,
}: {
  readonly label: string;
  readonly tags: readonly DraftRuleTag[];
}) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label={label} className="draft-tags">
      {tags.map((tag) => (
        <li data-active={tag.active || undefined} key={tag.key}>
          {tag.label}
        </li>
      ))}
    </ul>
  );
}

/** An NPC's trait-giver label; NPCs that give no traits have no catalog label beyond their key. */
function npcLabel(catalog: Catalog, npc: DraftNpcOption): string {
  return (
    (npc.giverKey === undefined ? undefined : catalog.traitGivers.byKey[npc.giverKey]?.label) ??
    npc.npcKey
  );
}

function targetLabel(
  catalog: Catalog,
  worldOptions: DraftWorldOptions,
  target: DraftTargetResult,
): string {
  const biome = target.biomeKey === undefined ? '' : catalog.biomes.byKey[target.biomeKey]?.label;
  switch (target.kind) {
    case 'basketTrait':
      return catalog.traits.byKey[target.key]?.label ?? target.key;
    case 'storyNpc':
    case 'fieldNpc': {
      const options = worldOptions.biomes.find((b) => b.biomeKey === target.biomeKey);
      const npc = [options?.storyNpc, ...(options?.fieldNpcs ?? [])].find(
        (candidate) => candidate?.npcKey === target.key,
      );
      return `${npc === undefined ? target.key : npcLabel(catalog, npc)} (${biome})`;
    }
    case 'rackKeepsake':
      return `${catalog.keepsakes.byKey[target.key]?.label ?? target.key} after ${biome}`;
    case 'startingKeepsakeResult': {
      const keepsake = catalog.keepsakes.values.find((k) => k.effect?.kind === target.key);
      return `Starting keepsake result (${keepsake?.label ?? target.key})`;
    }
  }
}

function useElapsedSeconds(run: DraftRunState): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.kind !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [run.kind]);
  return run.kind === 'running' ? Math.max(0, Math.floor((now - run.startedAt) / 1000)) : 0;
}

function DraftOutcome({
  catalog,
  run,
  worldOptions,
}: {
  readonly catalog: Catalog;
  readonly run: DraftRunState;
  readonly worldOptions: DraftWorldOptions;
}) {
  switch (run.kind) {
    case 'idle':
    case 'running':
      return null;
    case 'superseded':
      return (
        <p className="draft-outcome">The project changed while drafting; nothing was applied.</p>
      );
    case 'refused':
      return <p className="draft-outcome">This spec can't be drafted.</p>;
    case 'error':
      return <p className="draft-outcome">Drafting stopped unexpectedly.</p>;
    case 'failed':
      return (
        <p className="draft-outcome">
          No plan found
          {run.biomeKey === ''
            ? ''
            : ` in ${catalog.biomes.byKey[run.biomeKey]?.label ?? run.biomeKey}`}
          . Try another seed or a smaller basket.
        </p>
      );
    case 'drafted': {
      const unmet = run.report.targets.filter((target) => !target.met);
      return (
        <section aria-label="Draft report" className="draft-report">
          <p>
            {run.report.met} of {run.report.targets.length} targets met.
          </p>
          {unmet.length === 0 ? null : (
            <ul aria-label="Unmet targets" className="draft-chip-list">
              {unmet.map((target) => (
                <li
                  className="draft-chip"
                  data-unmet
                  key={`${target.kind}:${target.biomeKey ?? ''}:${target.key}`}
                >
                  {targetLabel(catalog, worldOptions, target)}
                </li>
              ))}
            </ul>
          )}
          {run.report.extras.length === 0 ? null : (
            <ul aria-label="Extras" className="draft-chip-list">
              {run.report.extras.map((extra) => (
                <li className="draft-chip" data-unmet key={`${extra.kind}:${extra.key}`}>
                  {catalog.traitGivers.byKey[extra.key]?.label ?? extra.key}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }
  }
}

const godKeepsakeReason = "Drafting can't use god keepsakes.";

/** One Postboss rack's keepsake; it shows the keepsake held there, inherited or chosen. */
function DraftRackKeepsake({
  catalog,
  index,
  label,
  onSelect,
  slot,
}: {
  readonly catalog: Catalog;
  readonly index: number;
  readonly label: string;
  readonly onSelect: (keepsakeKey: string) => void;
  readonly slot: DraftRackSlot;
}) {
  const [open, setOpen] = useState(false);
  const id = `draft-rack-${index}`;
  const held = slot.effectiveKeepsakeKey;
  const heldLabel = held === null ? undefined : (catalog.keepsakes.byKey[held]?.label ?? held);
  return (
    <>
      <KeepsakeLauncher
        id={id}
        keepsakeKey={held ?? undefined}
        label={label}
        onOpen={() => setOpen(true)}
        text={
          heldLabel === undefined
            ? 'Choose keepsake'
            : slot.keepsakeKey === null
              ? `${heldLabel} (Unchanged)`
              : heldLabel
        }
      />
      {open ? (
        <KeepsakeRackDialog
          entries={catalog.keepsakes.values.map((keepsake) => {
            const allowed = slot.keepsakeKeys.includes(keepsake.key);
            return {
              key: keepsake.key,
              label: keepsake.label,
              selected: keepsake.key === held,
              disabled: !allowed,
              hint: allowed ? undefined : godKeepsakeReason,
            };
          })}
          onClose={() => setOpen(false)}
          onSelect={onSelect}
          returnFocusId={id}
          title={label}
        />
      ) : null}
    </>
  );
}

const npcIcon = (npcKey: string): string | undefined => npcArtwork[npcKey] ?? undefined;

/** Describes a world and basket; drafting fills the route's biomes and sets the loadout. */
export function RouteDraftPanel({
  catalog,
  draftRun,
  interactions,
  project,
  workspaceRoute,
}: {
  readonly catalog: Catalog;
  readonly draftRun: DraftRunController;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly project: ProjectDocument;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const run = useAppSelector((state) => state.draftSession.run);
  const [basketOpen, setBasketOpen] = useState(false);
  const [tab, setTab] = useState<'draft' | 'advanced'>('draft');
  // Racks line up under Arcana, Fear and Keepsake at one shared width.
  const rows = useCommonItemWidth<HTMLFieldSetElement>();
  const projection = useMemo(() => projectDraftSpec(catalog, project), [catalog, project]);
  const draft = project.route.draft;
  const replaceDraft = (next: AuthoredDraftSpec) =>
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceDraftSpec',
        route: createRouteAddress(project.route.routeKey),
        draft: next,
      }),
    );
  const { spec, worldOptions, rackSlots } = projection;
  const refusals = useMemo(
    () => (spec === undefined ? [] : draftRefusals(catalog, project, spec)),
    [catalog, project, spec],
  );
  const budget = useMemo(
    () => (spec === undefined ? undefined : projectDraftBudget(catalog, project, spec)),
    [catalog, project, spec],
  );
  const basket = useMemo(
    () =>
      spec === undefined ? undefined : projectDraftBasket(catalog, project, spec, worldOptions),
    [catalog, project, spec, worldOptions],
  );
  const running = run.kind === 'running';
  const elapsed = useElapsedSeconds(run);
  const godKeys = projection.gods.filter((god) => god.selected).map((god) => god.godKey);
  const orderedGodKeys = spec?.world.godKeys ?? godKeys;
  const blocked = spec === undefined || refusals.length > 0;
  const draftHint =
    spec === undefined ? 'The loadout is not complete.' : refusalHint(catalog, refusals[0]);
  const initialProfile = routeInitialProfile(catalog, project.route.routeKey);
  const godTags = projectDraftGodTags(catalog, project, godKeys, refusals);
  const firstBoonTag =
    spec === undefined ? undefined : projectDraftFirstBoonTag(catalog, project, spec, refusals);
  const overwrites = project.route.biomes.some((biome) => biome.topology !== null);
  const biomeLabel = (biomeKey: string) => catalog.biomes.byKey[biomeKey]?.label ?? biomeKey;
  const godKeepsakeHint = (keepsakeKey: string) =>
    forcesGod(catalog, keepsakeKey) ? godKeepsakeReason : undefined;
  // Each planned biome's Postboss holds its rack; racks of later biomes are left out.
  const plannedRacks = rackSlots.filter((slot) =>
    projection.plannedBiomeKeys.includes(slot.afterBiomeKey),
  );
  const chipGroup = (group: DraftBasketChipGroup) => (
    <div className="draft-chip-group" data-queued={group.queued || undefined} key={group.key}>
      <span className="draft-chip-group-label">
        <ArtworkIcon
          className="draft-toggle-icon"
          source={traitGiverArtwork[group.key] ?? undefined}
        />
        {group.label}
      </span>
      <ol aria-label={`${group.label} basket traits`} className="draft-chip-list">
        {group.chips.map((chip) => {
          // A chip shows the trait's icon; its name is the accessible name and the hint.
          const icon = traitIcon(chip.traitKey);
          const refusedHint = chip.refused ? chip.hint : undefined;
          return (
            <li
              className="draft-chip"
              data-refused={chip.refused || undefined}
              data-ordered={chip.order === undefined ? undefined : true}
              key={chip.traitKey}
              {...(icon === undefined
                ? hintProps(refusedHint)
                : {
                    'aria-label': chip.label,
                    ...hintProps(
                      refusedHint === undefined ? chip.label : `${chip.label}: ${refusedHint}`,
                      undefined,
                      chip.label,
                    ),
                  })}
            >
              {chip.order === undefined ? null : (
                <button
                  aria-label={`Move ${chip.label} earlier`}
                  className="draft-chip-move"
                  disabled={chip.order.earlierBasket === undefined}
                  onClick={() => {
                    const basketTraitKeys = chip.order?.earlierBasket;
                    if (basketTraitKeys !== undefined) replaceDraft({ ...draft, basketTraitKeys });
                  }}
                  type="button"
                >
                  <ActionIcon name="chevronLeft" />
                </button>
              )}
              {icon === undefined ? (
                <span>{chip.label}</span>
              ) : (
                <ArtworkIcon className="draft-chip-icon" source={icon} />
              )}
              {chip.order === undefined ? null : (
                <button
                  aria-label={`Move ${chip.label} later`}
                  className="draft-chip-move"
                  disabled={chip.order.laterBasket === undefined}
                  onClick={() => {
                    const basketTraitKeys = chip.order?.laterBasket;
                    if (basketTraitKeys !== undefined) replaceDraft({ ...draft, basketTraitKeys });
                  }}
                  type="button"
                >
                  <ActionIcon name="chevronRight" />
                </button>
              )}
              <button
                aria-label={`Remove ${chip.label}`}
                className="draft-chip-remove"
                onClick={() => replaceDraft(withDraftBasketTraitToggled(draft, chip.traitKey))}
                type="button"
              >
                <ActionIcon name="close" />
              </button>
            </li>
          );
        })}
      </ol>
      {group.orderNotes.map((note) => (
        <p className="draft-chip-group-note" key={note}>
          {note}
        </p>
      ))}
    </div>
  );
  return (
    <section className="route-overview route-draft" aria-label="Draft">
      <header className="panel-heading draft-heading">
        <div aria-label="Draft settings" className="draft-tabs" role="tablist">
          {(['draft', 'advanced'] as const).map((key) => (
            <button
              aria-controls="draft-tab-panel"
              aria-selected={tab === key}
              className="draft-tab"
              id={`draft-tab-${key}`}
              key={key}
              onClick={() => setTab(key)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const next = key === 'draft' ? 'advanced' : 'draft';
                setTab(next);
                document.getElementById(`draft-tab-${next}`)?.focus();
              }}
              role="tab"
              tabIndex={tab === key ? 0 : -1}
              type="button"
            >
              {key === 'draft' ? 'Draft' : 'Advanced'}
            </button>
          ))}
        </div>
        {overwrites ? (
          <span className="draft-heading-meta" role="note">
            Drafting replaces the current route plan.
          </span>
        ) : null}
        {tab === 'advanced' ? (
          <button
            className="secondary-action draft-advanced-reset"
            disabled={!draftAdvancedChanged(draft)}
            onClick={() => replaceDraft(withDraftAdvancedDefaults(draft))}
            type="button"
          >
            Reset to defaults
          </button>
        ) : null}
      </header>
      <fieldset
        aria-labelledby={`draft-tab-${tab}`}
        className="draft-fieldset"
        disabled={running}
        id="draft-tab-panel"
        ref={rows}
        role="tabpanel"
      >
        {tab === 'draft' ? (
          <>
            <RoutePrefixControl
              biomes={project.route.itineraryBiomeKeys.map((biomeKey) => ({
                biomeKey,
                label: biomeLabel(biomeKey),
              }))}
              configuredBiomeCount={project.route.biomes.length}
              routeKey={project.route.routeKey}
            />
            {initialProfile.kind === 'freshFile' ? (
              <FreshFileLoadout catalog={catalog} fixedWeaponKey={initialProfile.fixedWeaponKey} />
            ) : (
              <RouteLoadoutControls
                authoredRoute={project.route}
                catalog={catalog}
                interactions={interactions}
                keepsakeUnavailableHint={godKeepsakeHint}
                workspaceRoute={workspaceRoute}
              />
            )}
            <section className="draft-section" aria-labelledby="draft-gods-heading">
              <div className="draft-title-row">
                <h3 className="draft-section-heading" id="draft-gods-heading">
                  Gods{' '}
                  <span>
                    {godKeys.length}/{worldOptions.maxGods}
                  </span>
                </h3>
                <RuleTags label="God pool rules" tags={godTags} />
              </div>
              <div className="draft-toggle-row" role="group" aria-label="Gods">
                {projection.gods.map(({ godKey, selected, selectable }) => {
                  // Click order is pool order: new gods arrive in it, #1 first.
                  const poolNumber = selected ? orderedGodKeys.indexOf(godKey) + 1 : undefined;
                  return (
                    <button
                      aria-pressed={selected}
                      className="draft-toggle"
                      data-has-icon
                      disabled={!selectable}
                      key={godKey}
                      onClick={() =>
                        replaceDraft(
                          withDraftGodToggled(draft, godKey, worldOptions.requiredGodKeys),
                        )
                      }
                      type="button"
                    >
                      <ArtworkIcon
                        className="draft-toggle-icon"
                        source={traitGiverArtwork[godKey] ?? undefined}
                      />
                      {catalog.traitGivers.byKey[godKey]?.label ?? godKey}
                      {poolNumber === undefined ? null : (
                        <span className="draft-order-number" aria-hidden="true">
                          {poolNumber}
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  aria-label="Reset god order"
                  className="draft-chip-remove draft-pool-reset"
                  disabled={draft.godKeys.length === 0}
                  onClick={() => replaceDraft({ ...draft, godKeys: [] })}
                  type="button"
                >
                  <ActionIcon name="reset" />
                </button>
              </div>
            </section>
            {!draftWorldHasNpcs(worldOptions) ? null : (
              <section className="draft-section" aria-labelledby="draft-npcs-heading">
                {/* The title shares the header row with the Story and Field column labels. */}
                <table className="draft-npc-table" aria-labelledby="draft-npcs-heading">
                  <thead>
                    <tr>
                      <th scope="col">
                        <h3 className="draft-section-heading" id="draft-npcs-heading">
                          NPCs
                        </h3>
                      </th>
                      <th className="draft-section-heading" scope="col">
                        Story
                      </th>
                      <th className="draft-section-heading draft-npc-field" scope="col">
                        Field
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* A biome past the planned prefix is not drafted, so its NPC row is left out. */}
                    {worldOptions.biomes
                      .filter((biome) => projection.plannedBiomeKeys.includes(biome.biomeKey))
                      .map((biome) => {
                        const storyNpc = biome.storyNpc;
                        const label = biomeLabel(biome.biomeKey);
                        return (
                          <tr key={biome.biomeKey}>
                            <th className="draft-npc-biome" scope="row">
                              {label}
                            </th>
                            <td>
                              {storyNpc === undefined ? null : (
                                <button
                                  aria-label={`${npcLabel(catalog, storyNpc)}, story room in ${label}`}
                                  aria-pressed={
                                    spec?.world.storyNpcByBiome[biome.biomeKey] === storyNpc.npcKey
                                  }
                                  className="draft-toggle"
                                  data-has-icon
                                  onClick={() =>
                                    replaceDraft(
                                      withDraftStoryNpcToggled(
                                        draft,
                                        biome.biomeKey,
                                        storyNpc.npcKey,
                                      ),
                                    )
                                  }
                                  type="button"
                                >
                                  <ArtworkIcon
                                    className="draft-toggle-icon"
                                    source={npcIcon(storyNpc.npcKey)}
                                  />
                                  {npcLabel(catalog, storyNpc)}
                                </button>
                              )}
                            </td>
                            <td className="draft-npc-field">
                              <span className="draft-toggle-row">
                                {biome.fieldNpcs.map((npc) => (
                                  <button
                                    aria-label={`${npcLabel(catalog, npc)} in ${label}`}
                                    aria-pressed={
                                      spec?.world.fieldNpcsByBiome[biome.biomeKey]?.includes(
                                        npc.npcKey,
                                      ) === true
                                    }
                                    className="draft-toggle"
                                    data-has-icon
                                    key={npc.npcKey}
                                    onClick={() =>
                                      replaceDraft(
                                        withDraftFieldNpcToggled(draft, biome.biomeKey, npc.npcKey),
                                      )
                                    }
                                    type="button"
                                  >
                                    <ArtworkIcon
                                      className="draft-toggle-icon"
                                      source={npcIcon(npc.npcKey)}
                                    />
                                    {npcLabel(catalog, npc)}
                                  </button>
                                ))}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </section>
            )}
            {plannedRacks.length === 0 ? null : (
              <section className="draft-section" aria-labelledby="draft-racks-heading">
                <h3 className="draft-section-heading" id="draft-racks-heading">
                  Rack keepsakes
                </h3>
                <div className="route-loadout-row">
                  {plannedRacks.map((slot, index) => (
                    <DraftRackKeepsake
                      catalog={catalog}
                      index={index}
                      key={`${slot.afterBiomeKey}-${index}`}
                      label={`After ${biomeLabel(slot.afterBiomeKey)}`}
                      onSelect={(keepsakeKey) =>
                        replaceDraft(withDraftRackKeepsake(draft, slot, keepsakeKey))
                      }
                      slot={slot}
                    />
                  ))}
                </div>
              </section>
            )}
            <section className="draft-section" aria-labelledby="draft-basket-heading">
              <div className="draft-section-header">
                <div className="draft-title-row">
                  <h3 className="draft-section-heading" id="draft-basket-heading">
                    Basket
                  </h3>
                  <RuleTags
                    label="Basket rules"
                    tags={firstBoonTag === undefined ? [] : [firstBoonTag]}
                  />
                </div>
                <button
                  aria-haspopup="dialog"
                  className="secondary-action"
                  disabled={basket === undefined}
                  id="draft-basket-edit"
                  onClick={() => setBasketOpen(true)}
                  type="button"
                >
                  Edit basket
                </button>
              </div>
              {basket === undefined ? null : (
                <ul aria-label="Basket caps" className="draft-cap-list">
                  {basket.summary.map(({ key, label, cap }) => (
                    <li key={key}>
                      {label}
                      <DraftCapCount cap={cap} />
                    </li>
                  ))}
                </ul>
              )}
              {basket === undefined || basket.chipGroups.length === 0 ? null : (
                <div className="draft-chip-groups">
                  {basket.chipGroups.some((group) => group.queued) ? (
                    <div className="draft-chip-table-scroll">
                      <div className="draft-chip-table">
                        {basket.chipGroups.filter((group) => group.queued).map(chipGroup)}
                      </div>
                    </div>
                  ) : null}
                  {basket.chipGroups.filter((group) => !group.queued).map(chipGroup)}
                </div>
              )}
            </section>
          </>
        ) : budget === undefined ? null : (
          <>
            <section className="draft-section" aria-labelledby="draft-targets-heading">
              <div className="draft-title-row">
                <h3 className="draft-section-heading" id="draft-targets-heading">
                  Targets · {budget.effectiveTotal ?? budget.total} god boons
                </h3>
                {/* Fixed tags: each always present, outlined when it applies. */}
                <ul aria-label="God boon rules" className="draft-tags">
                  <li data-active>Above default → more misses</li>
                  <li data-active={budget.rules.forfeit || undefined}>Forfeit −1/biome</li>
                  <li data-active={budget.rules.reachableBinding || undefined}>
                    Reachable {budget.rules.reachable}
                  </li>
                </ul>
              </div>
              {budget.biomes.map((biome) => {
                const label = biomeLabel(biome.biomeKey);
                return (
                  <DraftSlider
                    key={biome.biomeKey}
                    accessibleLabel={`God boons in ${label}`}
                    defaultValue={biome.defaultValue}
                    hint={biome.expected === undefined ? undefined : `expected ${biome.expected}`}
                    label={
                      <>
                        <ArtworkIcon
                          className="artwork-label-icon"
                          source={biomeIcon(biome.biomeKey)}
                        />
                        {label}
                      </>
                    }
                    range={budget.range}
                    value={biome.value}
                    valueText={
                      biome.effective === undefined
                        ? undefined
                        : `${biome.value} → ${biome.effective}`
                    }
                    onChange={(value) =>
                      replaceDraft(
                        withDraftGodBoons(draft, project.route.routeKey, biome.biomeKey, value),
                      )
                    }
                  />
                );
              })}
              <DraftSlider
                accessibleLabel="Most boons from one god"
                hint={`Recommended: ${budget.perGod.defaults.withoutDenial} without Denial · ${budget.perGod.defaults.withDenial} with Denial`}
                label="Traits per god"
                range={budget.perGod.range}
                value={budget.perGod.value}
                onChange={(value) =>
                  replaceDraft(withDraftPerGodCap(draft, value, budget.perGod.defaultValue))
                }
              />
            </section>
            <section className="draft-section" aria-labelledby="draft-rooms-heading">
              <h3 className="draft-section-heading" id="draft-rooms-heading">
                Rooms &amp; shops
              </h3>
              <div className="draft-row">
                <span className="draft-row-label" id="draft-room-forcing-label">
                  Room forcing
                </span>
                <div
                  aria-labelledby="draft-room-forcing-label"
                  className="route-prefix-options draft-row-wide"
                  role="radiogroup"
                >
                  {ROOM_FORCING_OPTIONS.map((option) => (
                    <label key={option.forcing} {...hintProps(option.equation)}>
                      <input
                        checked={
                          (draft.roomForcing ?? DEFAULT_DRAFT_ROOM_FORCING) === option.forcing
                        }
                        name={`${project.route.routeKey}-draft-room-forcing`}
                        onChange={() => replaceDraft(withDraftRoomForcing(draft, option.forcing))}
                        type="radio"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
              <DraftSlider
                defaultValue={DEFAULT_DRAFT_RESOURCE_ROOM_CHANCE}
                label="Resource rooms"
                range={DRAFT_RESOURCE_ROOM_CHANCE_RANGE}
                unit="%"
                value={draft.resourceRoomChance ?? DEFAULT_DRAFT_RESOURCE_ROOM_CHANCE}
                onChange={(value) => replaceDraft(withDraftResourceRoomChance(draft, value))}
              />
              <DraftSlider
                defaultValue={DEFAULT_DRAFT_PURCHASES_PER_BIOME}
                label="Shop buys per biome"
                range={DRAFT_PURCHASES_PER_BIOME_RANGE}
                value={draft.purchasesPerBiome ?? DEFAULT_DRAFT_PURCHASES_PER_BIOME}
                onChange={(value) => replaceDraft(withDraftPurchasesPerBiome(draft, value))}
              />
              <DraftCheckbox
                checked={draft.preferMidshops === true}
                hint={draft.preferMidshops === true ? 'Drafts take longer.' : undefined}
                label="Prefer midshops"
                onChange={(on) => replaceDraft(withDraftPreferMidshops(draft, on))}
              />
              {budget.clockworkGoal ? (
                <DraftCheckbox
                  checked={draft.pursueTartarusGoal === true}
                  hint={
                    draft.pursueTartarusGoal === true
                      ? 'Tartarus gives few boons outside its Shop.'
                      : undefined
                  }
                  label="Pursue the Tartarus goal"
                  onChange={(on) => replaceDraft(withDraftPursueTartarusGoal(draft, on))}
                />
              ) : null}
            </section>
            <section className="draft-section" aria-labelledby="draft-search-heading">
              <h3 className="draft-section-heading" id="draft-search-heading">
                Search
              </h3>
              <DraftSlider
                defaultValue={DEFAULT_DRAFT_RETRIES_PER_BIOME}
                hint="More retries: better coverage, longer drafts"
                label="Retries"
                range={DRAFT_RETRIES_PER_BIOME_RANGE}
                value={draft.retriesPerBiome ?? DEFAULT_DRAFT_RETRIES_PER_BIOME}
                onChange={(value) => replaceDraft(withDraftRetriesPerBiome(draft, value))}
              />
            </section>
          </>
        )}
      </fieldset>
      <div className="draft-actions">
        <div className="draft-action-row">
          <span className="draft-meta">
            <span className="draft-seed">Seed {running ? run.seed : draft.seed}</span>
            {running ? null : <DraftShareControls catalog={catalog} project={project} />}
          </span>
          {running ? (
            <>
              <span className="draft-progress">Drafting… {elapsed} s</span>
              <button className="secondary-action" onClick={() => draftRun.cancel()} type="button">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="secondary-action"
                aria-disabled={blocked || undefined}
                onClick={() => {
                  if (!blocked) draftRun.reroll();
                }}
                type="button"
                {...hintProps(blocked ? draftHint : undefined)}
              >
                Reroll
              </button>
              <button
                className="primary-action"
                aria-disabled={blocked || undefined}
                onClick={() => {
                  if (!blocked) draftRun.draft();
                }}
                type="button"
                {...hintProps(blocked ? draftHint : undefined)}
              >
                Draft
              </button>
            </>
          )}
        </div>
        <DraftOutcome catalog={catalog} run={run} worldOptions={worldOptions} />
      </div>
      {basketOpen && basket !== undefined ? (
        <DraftBasketDialog
          onClose={() => setBasketOpen(false)}
          onToggle={(traitKey) => replaceDraft(withDraftBasketTraitToggled(draft, traitKey))}
          projection={basket}
          returnFocusId="draft-basket-edit"
        />
      ) : null}
    </section>
  );
}

const ROOM_FORCING_OPTIONS: readonly {
  readonly forcing: DraftRoomForcing;
  readonly label: string;
  readonly equation: string;
}[] = [
  { forcing: 'deadline', label: 'At deadline', equation: '1 at the deadline' },
  { forcing: 'softened', label: 'Softened', equation: '1 / (Max − depth + 1)' },
  { forcing: 'game', label: 'Game odds', equation: '1 / (Max − depth)' },
];

/**
 * One Advanced row on the shared grid: label, slider, value, and a hint slot that names the
 * default only when the value differs from it.
 */
function DraftSlider({
  label,
  accessibleLabel,
  defaultValue,
  hint,
  range,
  unit = '',
  value,
  valueText,
  onChange,
}: {
  readonly label: ReactNode;
  readonly accessibleLabel?: string;
  readonly defaultValue?: number;
  readonly hint?: string | undefined;
  readonly range: { readonly min: number; readonly max: number; readonly step?: number };
  readonly unit?: string;
  readonly value: number;
  readonly valueText?: string | undefined;
  readonly onChange: (value: number) => void;
}) {
  const changed = defaultValue !== undefined && value !== defaultValue;
  return (
    <div className="draft-row">
      <span className="draft-row-label">{label}</span>
      <input
        aria-label={accessibleLabel ?? (typeof label === 'string' ? label : undefined)}
        className="draft-row-control"
        max={range.max}
        min={range.min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={range.step ?? 1}
        type="range"
        value={value}
      />
      <span className="draft-row-value">{valueText ?? `${value}${unit}`}</span>
      {/* A fixed note pill leads, so it never moves; the default follows only when changed. */}
      <span className="draft-row-hint">
        {hint === undefined ? null : <span className="draft-hint-pill">{hint}</span>}
        {changed ? <span>default {`${defaultValue}${unit}`}</span> : null}
      </span>
    </div>
  );
}

/** A checkbox row on the same grid: its label in the label column, its note outside the name. */
function DraftCheckbox({
  checked,
  hint,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly hint?: string | undefined;
  readonly label: string;
  readonly onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="draft-row">
      <label className="draft-row-label" htmlFor={id}>
        {label}
      </label>
      <span className="draft-row-control">
        <input
          checked={checked}
          id={id}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
      </span>
      <span className="draft-row-value" />
      <span className="draft-row-hint">
        {hint === undefined ? null : <span className="draft-hint-pill">{hint}</span>}
      </span>
    </div>
  );
}
