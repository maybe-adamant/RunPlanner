import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type {
  GameClearedSlot,
  GameStatusController,
  GameTargetDiscovery,
} from '@planner/persistence/gameModuleHost';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { useAppSelector } from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import {
  describeActiveSlotSetting,
  describeSlotRestoration,
  describeInstallOutcome,
  describeLastSendFailure,
  describeRemoveOutcome,
  describeSentNotActivated,
  projectGamePanel,
  projectGameProfileChoices,
  projectHomeSlots,
  projectSlotClearing,
  type GameActiveSlotIntent,
  type GameClearSlotIntent,
  type GameLocationProduct,
  type GameModuleSectionProduct,
  type HomeSlotRow,
  type HomeSlotsProduct,
} from '@planner/projections/gamePanel';
import { ContextualPicker } from '../controls/ContextualPicker';
import { ConfirmationDialog } from '../controls/ConfirmationDialog';
import { ExternalPageLink } from '../controls/ExternalPageLink';
import { ModalDialog } from '../controls/ModalDialog';
import type {
  CommunityEventController,
  EventDevelopmentOperations,
  EventSlotOutcome,
} from '@planner/workspace/communityEvents';
import type { SlotRebuildController } from '@planner/workspace/slotRebuild';
import { CommunityEventCard } from '../shell/NoticeArea';
import { HomeToast } from './HomeToast';
import type { LibrarySlotIndex } from './useLibrarySlotLinks';

type Confirmation = 'install' | 'checkoutInstall' | 'remove';

interface Feedback {
  readonly tone: 'status' | 'alert';
  readonly text: string;
}

interface ClearedNotice {
  readonly id: number;
  readonly text: string;
  readonly undo: GameClearedSlot | null;
}

interface TargetRequest {
  readonly kind: 'discovered' | 'manual';
  readonly path: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function FeedbackLine({ feedback }: { readonly feedback: Feedback | null }) {
  return feedback === null ? null : (
    <p className="game-publication-message" role={feedback.tone}>
      {feedback.text}
    </p>
  );
}

function SwitchAwayDialog({
  name,
  onCancel,
  onKeep,
  onRemove,
  pending,
  removal,
}: {
  readonly name: string;
  readonly removal: GameLocationProduct['switchAwayRemoval'];
  readonly onCancel: () => void;
  readonly onKeep: () => void;
  readonly onRemove: () => void;
  readonly pending: boolean;
}) {
  return (
    <ModalDialog
      describedBy="game-location-switch-message"
      labelledBy="game-location-switch-title"
      onCancel={onCancel}
      pending={pending}
    >
      <header className="panel-heading">
        <h2 id="game-location-switch-title">Switch game location?</h2>
      </header>
      <p className="game-publication-message" id="game-location-switch-message">
        The planner installed the game module in {name}. A copy you keep there is no longer tracked
        and won’t receive planner updates. Plan slots stay in place either way.
      </p>
      {removal.available || removal.reason === null ? null : (
        <p className="game-publication-hint">{removal.reason}</p>
      )}
      <footer className="game-publication-actions">
        <button className="quiet-action" disabled={pending} onClick={onCancel} type="button">
          Cancel
        </button>
        {removal.available && (
          <button className="danger-action" disabled={pending} onClick={onRemove} type="button">
            Remove it, then switch
          </button>
        )}
        <button className="secondary-action" disabled={pending} onClick={onKeep} type="button">
          Keep it and switch
        </button>
      </footer>
    </ModalDialog>
  );
}

function LocationCard({
  changing,
  discovery,
  location,
  onCancelChange,
  onChange,
  onChooseFolder,
  onFind,
  onForget,
  onPickerOpenChange,
  onSelectProfile,
  focusRequest,
  pending,
  pickerOpen,
}: {
  readonly focusRequest: number;
  readonly changing: boolean;
  readonly discovery: GameTargetDiscovery | null;
  readonly location: GameLocationProduct;
  readonly onCancelChange: () => void;
  readonly onChange: () => void;
  readonly onChooseFolder: () => void;
  readonly onFind: () => void;
  readonly onForget: () => void;
  readonly onPickerOpenChange: (open: boolean) => void;
  readonly onSelectProfile: (path: string) => void;
  readonly pending: boolean;
  readonly pickerOpen: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const focused = useRef(0);
  // Moves focus to the first control of the state just entered, once it is enabled.
  useEffect(() => {
    if (pending || focusRequest === focused.current) return;
    focused.current = focusRequest;
    sectionRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [focusRequest, pending, changing, location.state]);
  if (location.state === 'set' && !changing) {
    return (
      <section
        aria-labelledby="game-location-title"
        className="home-panel home-card"
        ref={sectionRef}
      >
        <h3 className="home-section-title" id="game-location-title">
          Game location
        </h3>
        <div className="home-status-line">
          <span className="home-status-text">
            {location.name} · {location.kindLabel}
          </span>
          <button
            aria-label="Change game location"
            className="quiet-action action-compact"
            disabled={pending}
            onClick={onChange}
            type="button"
          >
            Change…
          </button>
        </div>
        <dl className="home-facts">
          <div>
            <dt>Path</dt>
            <dd>{location.path}</dd>
          </div>
        </dl>
        {location.problem === null ? null : (
          <p className="game-publication-message" role="alert">
            {location.problem}
          </p>
        )}
        <div className="home-card-foot">
          <button
            aria-label="Forget game location"
            className="text-action"
            disabled={pending}
            onClick={onForget}
            type="button"
          >
            Forget location
          </button>
        </div>
      </section>
    );
  }
  return (
    <section
      aria-labelledby="game-location-title"
      className="home-panel home-card"
      ref={sectionRef}
    >
      <h3 className="home-section-title" id="game-location-title">
        Game location
      </h3>
      <p className="game-publication-hint">Choose where Hades II mods are installed.</p>
      <div className="game-panel-actions">
        <button
          className="secondary-action action-compact"
          disabled={pending}
          onClick={onFind}
          type="button"
        >
          Find r2modman profiles
        </button>
        <button
          className="secondary-action action-compact"
          disabled={pending}
          onClick={onChooseFolder}
          type="button"
        >
          Choose folder…
        </button>
        {changing && (
          <button
            className="quiet-action action-compact"
            disabled={pending}
            onClick={onCancelChange}
            type="button"
          >
            Cancel
          </button>
        )}
      </div>
      {discovery === null ? null : !discovery.supported ? (
        <p className="game-publication-hint">
          r2modman profile discovery is not available on this platform. Choose the folder instead.
        </p>
      ) : discovery.profiles.length === 0 ? (
        <p className="game-publication-hint">No r2modman Hades II profiles were found.</p>
      ) : (
        <ContextualPicker
          disabled={pending}
          id="game-location-profile"
          label="r2modman profile"
          model={projectGameProfileChoices(discovery, location.path)}
          onOpenChange={onPickerOpenChange}
          onSelect={onSelectProfile}
          open={pickerOpen}
          placeholder="Choose a profile…"
        />
      )}
    </section>
  );
}

function ModuleCard({
  feedback,
  module,
  onCheckoutInstall,
  onInstall,
  onOpenPage,
  onRemove,
  pending,
}: {
  readonly onOpenPage: (url: string) => void;
  readonly feedback: Feedback | null;
  readonly module: GameModuleSectionProduct;
  readonly onCheckoutInstall: () => void;
  readonly onInstall: () => void;
  readonly onRemove: () => void;
  readonly pending: boolean;
}) {
  // The module's own install or update is the card's primary action.
  const moduleStep = module.steps.find((step) => step.key === 'module');
  const otherSteps = module.steps.filter((step) => step !== moduleStep);
  return (
    <section aria-labelledby="game-module-title" className="home-panel home-card">
      <h3 className="home-section-title" id="game-module-title">
        Status
      </h3>
      <div className="home-status-line">
        <span className="home-status-text" data-tone={module.tone}>
          {module.summary}
        </span>
        {moduleStep?.action == null ? null : (
          <button
            className="primary-action action-compact"
            disabled={pending}
            onClick={onInstall}
            type="button"
          >
            {moduleStep.action.label}
          </button>
        )}
      </div>
      {otherSteps.length === 0 ? null : (
        <ol aria-label="Game module steps" className="game-panel-steps">
          {otherSteps.map((step) => (
            <li data-tone={step.tone} key={step.key}>
              <span aria-hidden="true" className="game-panel-step-icon">
                {step.tone === 'error' ? '✕' : '!'}
              </span>
              <span className="visually-hidden">
                {step.tone === 'error' ? 'Required: ' : 'Recommended: '}
              </span>
              <span>
                {step.text}
                {step.found === null ? null : (
                  <span className="game-panel-step-found"> (found {step.found})</span>
                )}
                {step.link === null ? null : (
                  <>
                    {' — '}
                    <ExternalPageLink link={step.link} onOpen={onOpenPage} />
                  </>
                )}
              </span>
              {step.action === null ? null : (
                <button
                  className="secondary-action action-compact"
                  disabled={pending}
                  onClick={onInstall}
                  type="button"
                >
                  {step.action.label}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <FeedbackLine feedback={feedback} />
      <dl className="home-facts">
        {module.details
          .filter((detail) => detail.key !== 'path')
          .map((detail) => (
            <div key={detail.key}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
      </dl>
      {module.removeAvailable || module.developmentInstallAvailable ? (
        <div className="home-card-foot">
          {module.developmentInstallAvailable && (
            <button
              className="text-action"
              disabled={pending}
              onClick={onCheckoutInstall}
              type="button"
            >
              Install from this checkout
            </button>
          )}
          {module.removeAvailable && (
            <button
              aria-label="Remove game module"
              className="text-action"
              data-tone="danger"
              disabled={pending}
              onClick={onRemove}
              type="button"
            >
              Remove module
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

function SlotPlanCell({ row }: { readonly row: HomeSlotRow }) {
  const plan = row.plan;
  if (plan === null) return <td colSpan={4}>{row.summary}</td>;
  switch (plan.kind) {
    case 'event':
      return (
        <td className="home-slot-plan">
          <span className="home-slot-name">{plan.title ?? 'Community event'}</span>
          <span className="home-slot-event"> · community event</span>
        </td>
      );
    case 'notInLibrary':
      return (
        <td className="home-slot-plan">
          {plan.name === null ? null : <span className="home-slot-name">{plan.name} · </span>}
          <span className="home-slot-unlinked">Not in library</span>
          {plan.note === null ? null : <span className="home-slot-note">{plan.note}</span>}
        </td>
      );
    case 'library':
      return (
        <td className="home-slot-plan">
          <span className="home-slot-name">{plan.name}</span>
          {plan.marker === null ? null : (
            <>
              {' · '}
              <span className="slot-marker" data-marker={plan.marker}>
                {plan.marker}
              </span>
            </>
          )}
          {plan.reason === null ? null : <span className="home-slot-note">{plan.reason}</span>}
        </td>
      );
  }
}

function SlotsTable({
  onClear,
  onOpen,
  onPlayNext,
  onRebuild,
  pending,
  slots,
}: {
  readonly onClear: (intent: GameClearSlotIntent) => void;
  readonly onOpen: (key: string) => void;
  readonly onPlayNext: (intent: GameActiveSlotIntent) => void;
  readonly onRebuild: (() => void) | undefined;
  readonly pending: boolean;
  readonly slots: HomeSlotsProduct;
}) {
  return (
    <>
      <table aria-labelledby="game-slots-title" className="home-slots">
        <thead>
          <tr>
            <th scope="col">Slot</th>
            <th scope="col">Library plan</th>
            <th scope="col">Route</th>
            <th scope="col">Aspect</th>
            <th scope="col">Sent</th>
            <th className="home-slots-next" scope="col">
              Next run
            </th>
            <th className="home-slots-open" scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {slots.rows.map((row) => (
            <tr
              data-active={row.nextRun?.kind === 'playsNext' || undefined}
              data-event={row.slot === 0 || undefined}
              data-state={row.state}
              key={row.slot}
            >
              <th scope="row">{row.label}</th>
              <SlotPlanCell row={row} />
              {row.plan === null ? null : (
                <>
                  <td>{row.route}</td>
                  <td>{row.aspect}</td>
                  <td>
                    {row.sent === null ? '—' : <time dateTime={row.sent.iso}>{row.sent.ago}</time>}
                  </td>
                </>
              )}
              <td className="home-slots-next">
                {row.nextRun === null ? null : row.nextRun.kind === 'playsNext' ? (
                  <span className="home-plays-next">Plays next</span>
                ) : (
                  <button
                    aria-label={`Play ${row.label} next`}
                    className="quiet-action action-compact"
                    disabled={pending || row.nextRun.kind === 'unplayable'}
                    onClick={() => {
                      if (row.nextRun?.kind === 'available') onPlayNext(row.nextRun.intent);
                    }}
                    type="button"
                  >
                    Play next
                  </button>
                )}
              </td>
              <td className="home-slots-open">
                <div className="library-row-actions">
                  {row.clear === null ? null : (
                    <button
                      aria-label={`Clear ${row.label}`}
                      className="text-action"
                      data-tone="danger"
                      disabled={pending}
                      onClick={() => {
                        if (row.clear !== null) onClear(row.clear);
                      }}
                      type="button"
                    >
                      Clear
                    </button>
                  )}
                  {row.plan?.kind === 'library' ? (
                    <button
                      aria-label={`Open ${row.plan.name}`}
                      className="text-action"
                      disabled={pending}
                      onClick={() => {
                        if (row.plan?.kind === 'library') onOpen(row.plan.key);
                      }}
                      type="button"
                    >
                      Open
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(onRebuild === undefined || !slots.rebuild.available) &&
      slots.rebuild.summary === null ? null : (
        <div className="home-rebuild">
          {onRebuild === undefined || !slots.rebuild.available ? null : (
            <button
              className="secondary-action action-compact"
              disabled={pending}
              onClick={onRebuild}
              type="button"
            >
              Rebuild outdated slots
            </button>
          )}
          {slots.rebuild.summary === null ? null : (
            <span role="status">{slots.rebuild.summary}</span>
          )}
        </div>
      )}
    </>
  );
}

const noRebuildSubscription = () => () => {};
const noRebuildReport = () => null;

function GameSections({
  catalog,
  communityEvents,
  gameStatus,
  index,
  operations,
  slotRebuild,
}: {
  readonly catalog: Catalog;
  readonly communityEvents: CommunityEventController | undefined;
  readonly gameStatus: GameStatusController;
  readonly index: LibrarySlotIndex;
  readonly operations: ProjectOperations;
  readonly slotRebuild: SlotRebuildController | undefined;
}) {
  const lastFailure = useAppSelector((state) => state.gameSendSession.lastFailure);
  const lastActivationFailure = useAppSelector(
    (state) => state.gameSendSession.lastActivationFailure,
  );
  const host = gameStatus.host;
  const snapshot = useSyncExternalStore(
    gameStatus.subscribe,
    gameStatus.getSnapshot,
    gameStatus.getSnapshot,
  );
  const status = snapshot.status;
  const setStatus = gameStatus.publish;
  const rebuildReport = useSyncExternalStore(
    slotRebuild?.subscribe ?? noRebuildSubscription,
    slotRebuild?.getSnapshot ?? noRebuildReport,
    slotRebuild?.getSnapshot ?? noRebuildReport,
  );
  const [pending, setPending] = useState(true);
  const [slotsFeedback, setSlotsFeedback] = useState<Feedback | null>(null);
  const [cleared, setCleared] = useState<ClearedNotice | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [changing, setChanging] = useState(false);
  const [discovery, setDiscovery] = useState<GameTargetDiscovery | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [switchRequest, setSwitchRequest] = useState<TargetRequest | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const refocus = () => setFocusRequest((request) => request + 1);
  const leaveChange = () => {
    setChanging(false);
    setDiscovery(null);
    setPickerOpen(false);
    refocus();
  };

  const run = useCallback(async (task: () => Promise<Feedback | null>) => {
    setPending(true);
    setFeedback(null);
    try {
      setFeedback(await task());
    } catch (error) {
      setFeedback({ tone: 'alert', text: errorText(error) });
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    let current = true;
    gameStatus
      .refresh()
      .catch((error: unknown) => {
        if (current) setFeedback({ tone: 'alert', text: errorText(error) });
      })
      .finally(() => {
        if (current) setPending(false);
      });
    return () => {
      current = false;
    };
  }, [gameStatus]);
  // Opening the Game tab also brings the event slot up to date with the event feed.
  useEffect(() => {
    void communityEvents?.sync('panel');
  }, [communityEvents]);

  const product = status === null ? null : projectGamePanel(status);
  const notActivated = describeSentNotActivated(lastActivationFailure, status);
  const slots =
    status === null
      ? null
      : projectHomeSlots(status, catalog, snapshot.readAt, index.links, rebuildReport);
  const playNext = async (intent: GameActiveSlotIntent) => {
    setPending(true);
    setSlotsFeedback(null);
    try {
      const problem = describeActiveSlotSetting(await host.setActiveSlot(intent.slot));
      if (problem !== null)
        setSlotsFeedback({ tone: 'alert', text: `Not made active: ${problem}` });
    } catch (error) {
      setSlotsFeedback({ tone: 'alert', text: `Not made active: ${errorText(error)}` });
    }
    try {
      await gameStatus.refresh();
    } catch {
      // The Game tab reports a failed status read.
    } finally {
      setPending(false);
    }
  };

  const changeSlot = async (change: () => Promise<string | null>) => {
    setPending(true);
    setSlotsFeedback(null);
    try {
      const problem = await change();
      if (problem !== null) setSlotsFeedback({ tone: 'alert', text: problem });
    } catch (error) {
      setSlotsFeedback({ tone: 'alert', text: errorText(error) });
    }
    try {
      await gameStatus.refresh();
    } catch {
      // The Game tab reports a failed status read.
    } finally {
      setPending(false);
    }
  };
  const clearSlot = (intent: GameClearSlotIntent) =>
    changeSlot(async () => {
      const slotOnePlayable = status?.inspection?.planSlots[0]?.state === 'present';
      const outcome = projectSlotClearing(
        intent.slot,
        await host.clearSlot(intent.slot),
        slotOnePlayable,
      );
      if (outcome.notice !== null) {
        const notice = outcome.notice;
        setCleared((previous) => ({ id: (previous?.id ?? 0) + 1, ...notice }));
      }
      return outcome.problem;
    });
  const undoClear = (undo: GameClearedSlot) => {
    setCleared(null);
    void changeSlot(async () => describeSlotRestoration(await host.restoreSlot(undo)));
  };

  const development = communityEvents?.development;
  const changeEventSlot = async (
    change: (operations: EventDevelopmentOperations) => Promise<EventSlotOutcome>,
  ) => {
    if (development === undefined) return;
    setPending(true);
    setSlotsFeedback(null);
    try {
      const outcome = await change(development);
      if (outcome.kind !== 'cancelled') {
        setSlotsFeedback({
          tone: outcome.kind === 'done' ? 'status' : 'alert',
          text: outcome.message,
        });
      }
      await gameStatus.refresh();
    } catch (error) {
      setSlotsFeedback({ tone: 'alert', text: errorText(error) });
    } finally {
      setPending(false);
    }
  };

  const applyTarget = async (request: TargetRequest) => {
    const next =
      request.kind === 'discovered'
        ? await host.useDiscoveredTarget(request.path)
        : await host.useChosenTarget(request.path);
    setStatus(next);
    leaveChange();
  };
  // An invalid candidate reports its reason before any switch question or removal;
  // reselecting the current target changes nothing.
  const requestTarget = async (request: TargetRequest) => {
    setPickerOpen(false);
    const candidate = await host.validateTarget(request.path, request.kind);
    if (candidate.path === status?.target?.path) {
      leaveChange();
      return;
    }
    if (product?.location.confirmSwitchAway === true) {
      setSwitchRequest(request);
      return;
    }
    await applyTarget(request);
  };
  const find = () =>
    run(async () => {
      setDiscovery(await host.discoverTargets());
      setPickerOpen(true);
      return null;
    });
  const chooseFolder = () =>
    run(async () => {
      const path = await host.pickTargetFolder();
      if (path !== null) await requestTarget({ kind: 'manual', path });
      return null;
    });
  const install = (checkout: boolean, overwriteConsent: boolean) =>
    run(async () => {
      const result = checkout
        ? await host.installFromCheckout(overwriteConsent)
        : await host.install(overwriteConsent);
      setStatus(result.status);
      setConfirmation(
        result.outcome === 'consentRequired' ? (checkout ? 'checkoutInstall' : 'install') : null,
      );
      await slotRebuild?.afterInstall(result);
      return { tone: 'status', text: describeInstallOutcome(result.outcome) };
    });
  const requestInstall = (checkout: boolean) => {
    if (product?.module?.consent.required === true) {
      setConfirmation(checkout ? 'checkoutInstall' : 'install');
      return;
    }
    void install(checkout, false);
  };
  const remove = () =>
    run(async () => {
      const result = await host.remove();
      setStatus(result.status);
      setConfirmation(null);
      return {
        tone: result.outcome === 'removed' ? 'status' : 'alert',
        text: describeRemoveOutcome(result.outcome),
      };
    });
  const switchAway = (removeFirst: boolean) => {
    const request = switchRequest;
    if (request === null) return;
    void run(async () => {
      try {
        if (removeFirst) {
          const result = await host.remove();
          setStatus(result.status);
          if (result.outcome !== 'removed') {
            leaveChange();
            return { tone: 'alert', text: describeRemoveOutcome(result.outcome) };
          }
        }
        try {
          await applyTarget(request);
        } catch (error) {
          if (!removeFirst) throw error;
          leaveChange();
          return {
            tone: 'alert',
            text: `The game module was removed, but the new location could not be set, so the game location did not change: ${errorText(error)}`,
          };
        }
        return null;
      } finally {
        setSwitchRequest(null);
      }
    });
  };

  if (product === null) {
    return (
      <>
        <p className="game-publication-message">Checking the game location…</p>
        <FeedbackLine feedback={feedback} />
      </>
    );
  }
  return (
    <div className="home-game-layout">
      <div className="home-game-side">
        {product.module === null ? null : (
          <ModuleCard
            feedback={feedback}
            module={product.module}
            onCheckoutInstall={() => requestInstall(true)}
            onInstall={() => requestInstall(false)}
            onOpenPage={(url) => {
              host.openExternalPage(url).catch((error: unknown) => {
                setFeedback({ tone: 'alert', text: errorText(error) });
              });
            }}
            onRemove={() => setConfirmation('remove')}
            pending={pending}
          />
        )}
        <LocationCard
          changing={changing}
          discovery={discovery}
          location={product.location}
          focusRequest={focusRequest}
          onCancelChange={leaveChange}
          onChange={() => {
            setChanging(true);
            refocus();
          }}
          onChooseFolder={() => void chooseFolder()}
          onFind={() => void find()}
          onForget={() =>
            void run(async () => {
              setStatus(await host.forgetTarget());
              refocus();
              return null;
            })
          }
          onPickerOpenChange={setPickerOpen}
          onSelectProfile={(path) =>
            void run(async () => {
              await requestTarget({ kind: 'discovered', path });
              return null;
            })
          }
          pending={pending}
          pickerOpen={pickerOpen}
        />
        {product.module === null ? <FeedbackLine feedback={feedback} /> : null}
        {communityEvents === undefined ? null : (
          <section aria-labelledby="game-event-title" className="home-event">
            <h3 className="home-section-title" id="game-event-title">
              Community event
            </h3>
            <CommunityEventCard communityEvents={communityEvents} gameStatus={gameStatus} />
          </section>
        )}
      </div>
      {slots === null ? null : (
        <section aria-labelledby="game-slots-title" className="home-panel home-slots-panel">
          <div className="home-slots-heading">
            <h3 className="home-section-title" id="game-slots-title">
              Slots in game
            </h3>
            <span className="home-muted">Send a plan from its editor.</span>
          </div>
          {lastFailure === null ? null : (
            <p className="home-problem" role="alert">
              {describeLastSendFailure(lastFailure)}
            </p>
          )}
          {notActivated === null ? null : (
            <p className="home-problem" role="alert">
              {notActivated}
            </p>
          )}
          <SlotsTable
            onClear={(intent) => void clearSlot(intent)}
            onOpen={(key) => void operations.openPlan(key)}
            onPlayNext={(intent) => void playNext(intent)}
            onRebuild={
              slotRebuild === undefined || status === null
                ? undefined
                : () =>
                    void run(async () => {
                      await slotRebuild.rebuild(status);
                      return null;
                    })
            }
            pending={pending}
            slots={slots}
          />
          {development === undefined ? null : (
            <div aria-label="Event slot (development)" className="home-event-dev" role="group">
              <button
                aria-haspopup="dialog"
                className="quiet-action action-compact"
                disabled={pending}
                onClick={() => void changeEventSlot((events) => events.importEventFolder())}
                type="button"
              >
                Import event folder…
              </button>
              <button
                className="quiet-action action-compact"
                disabled={pending}
                onClick={() => void changeEventSlot((events) => events.clearEvent())}
                type="button"
              >
                Clear event
              </button>
            </div>
          )}
          <FeedbackLine feedback={slotsFeedback} />
        </section>
      )}
      {cleared === null ? null : (
        <HomeToast
          {...(cleared.undo === null
            ? {}
            : {
                action: {
                  label: 'Undo',
                  run: () => {
                    if (cleared.undo !== null) undoClear(cleared.undo);
                  },
                },
              })}
          key={cleared.id}
          onDismiss={() => setCleared(null)}
          text={cleared.text}
        />
      )}
      {switchRequest !== null && (
        <SwitchAwayDialog
          name={product.location.name ?? 'the current game location'}
          onCancel={() => {
            setSwitchRequest(null);
            refocus();
          }}
          onKeep={() => switchAway(false)}
          onRemove={() => switchAway(true)}
          pending={pending}
          removal={product.location.switchAwayRemoval}
        />
      )}
      {(confirmation === 'install' || confirmation === 'checkoutInstall') &&
        product.module !== null && (
          <ConfirmationDialog
            confirmLabel="Replace"
            id="game-module-overwrite-title"
            onCancel={() => setConfirmation(null)}
            onConfirm={() => void install(confirmation === 'checkoutInstall', true)}
            pending={pending}
            title="Replace existing game module?"
          >
            <ul className="game-panel-notices">
              {product.module.consent.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </ConfirmationDialog>
        )}
      {confirmation === 'remove' && (
        <ConfirmationDialog
          confirmLabel="Remove"
          id="game-module-remove-title"
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void remove()}
          pending={pending}
          title="Remove game module?"
        >
          <p className="game-publication-message">
            The planner-installed Run Planner folder is deleted. Plan slots and ModpackLib are kept.
          </p>
        </ConfirmationDialog>
      )}
    </div>
  );
}

export function GameScreen({
  catalog,
  communityEvents,
  gameStatus,
  index,
  operations,
  slotRebuild,
}: {
  readonly catalog: Catalog;
  /** Present only in the desktop application. */
  readonly communityEvents?: CommunityEventController;
  readonly gameStatus?: GameStatusController;
  readonly index: LibrarySlotIndex;
  readonly operations: ProjectOperations;
  /** Present only in the desktop application. */
  readonly slotRebuild?: SlotRebuildController;
}) {
  return (
    <section aria-labelledby="game-title" className="home-page">
      <div className="home-page-heading">
        <h2 id="game-title">Game module</h2>
      </div>
      {gameStatus === undefined ? (
        <p className="game-publication-hint">
          Game location and game module management are available in the desktop application.
        </p>
      ) : (
        <GameSections
          catalog={catalog}
          communityEvents={communityEvents}
          gameStatus={gameStatus}
          index={index}
          operations={operations}
          slotRebuild={slotRebuild}
        />
      )}
    </section>
  );
}
