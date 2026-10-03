import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type {
  GamePlanSlotNumber,
  GameStatusController,
  GameTargetDiscovery,
} from '@planner/persistence/gameModuleHost';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { selectProfileStatus, useAppSelector } from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import {
  describeActiveSlotSetting,
  describeInstallOutcome,
  describeLastSendFailure,
  describeRemoveOutcome,
  describeSentNotActivated,
  gameSaveState,
  projectGamePanel,
  projectGameIndicator,
  projectGamePlans,
  projectGameProfileChoices,
  type GameActivationActivity,
  type GameActiveSlotIntent,
  type GamePlansProduct,
  type GameLocationProduct,
  type GameModuleSectionProduct,
} from '@planner/projections/gamePanel';
import { ContextualPicker } from '../controls/ContextualPicker';
import { ExternalPageLink } from '../controls/ExternalPageLink';
import type { BugReportOperations } from '@planner/workspace/bugReport';
import { ModalDialog } from './ModalDialog';
import { BugReportDialog } from './BugReportDialog';

function ConfirmationDialog({
  children,
  confirmLabel,
  describedBy,
  id,
  onCancel,
  onConfirm,
  pending,
  title,
}: {
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly describedBy?: string;
  readonly id: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly pending: boolean;
  readonly title: string;
}) {
  return (
    <ModalDialog
      {...(describedBy === undefined ? {} : { describedBy })}
      labelledBy={id}
      onCancel={onCancel}
      pending={pending}
    >
      <header className="panel-heading">
        <h2 id={id}>{title}</h2>
      </header>
      {children}
      <footer className="game-publication-actions">
        <button className="quiet-action" disabled={pending} onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="danger-action" disabled={pending} onClick={onConfirm} type="button">
          {pending ? 'Please wait…' : confirmLabel}
        </button>
      </footer>
    </ModalDialog>
  );
}

type Confirmation = 'install' | 'checkoutInstall' | 'remove';

interface Feedback {
  readonly tone: 'status' | 'alert';
  readonly text: string;
}

interface FocusRequest {
  readonly slot: GamePlanSlotNumber;
  readonly request: number;
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

function LocationSection({
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
        className="game-panel-section"
        ref={sectionRef}
      >
        <div className="game-panel-location-line">
          <h3 id="game-location-title">Game location</h3>
          <span title={location.path ?? undefined}>
            {location.name} ({location.kindLabel})
          </span>
          <span className="visually-hidden" id="game-location-path">
            {location.path}
          </span>
          <button
            aria-label="Change game location"
            className="quiet-action action-compact"
            disabled={pending}
            onClick={onChange}
            type="button"
          >
            Change
          </button>
          <button
            aria-label="Forget game location"
            className="quiet-action action-compact"
            disabled={pending}
            onClick={onForget}
            type="button"
          >
            Forget
          </button>
        </div>
        {location.problem === null ? null : (
          <p className="game-publication-message" role="alert">
            {location.problem}
          </p>
        )}
      </section>
    );
  }
  return (
    <section aria-labelledby="game-location-title" className="game-panel-section" ref={sectionRef}>
      <h3 id="game-location-title">Game location</h3>
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

function ModuleSection({
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
  return (
    <section aria-labelledby="game-module-title" className="game-panel-section">
      <h3 id="game-module-title">Game module</h3>
      <div className="game-panel-module-status-row">
        <p className="game-panel-module-status" data-tone={module.tone}>
          {module.summary}
        </p>
        {module.removeAvailable && (
          <button
            aria-label="Remove game module"
            className="game-panel-text-action"
            disabled={pending}
            onClick={onRemove}
            type="button"
          >
            Remove
          </button>
        )}
      </div>
      {module.steps.length === 0 ? null : (
        <ol aria-label="Game module steps" className="game-panel-steps">
          {module.steps.map((step) => (
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
      <details className="game-panel-details">
        <summary>Details</summary>
        <dl className="game-panel-status-list">
          {module.details.map((detail) => (
            <div key={detail.key}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
        {module.developmentInstallAvailable && (
          <button
            className="quiet-action action-compact"
            disabled={pending}
            onClick={onCheckoutInstall}
            type="button"
          >
            Install from this checkout
          </button>
        )}
      </details>
    </section>
  );
}

const IDLE_ACTIVATION: GameActivationActivity = Object.freeze({ kind: 'idle' });
const PENDING_ACTIVATION: GameActivationActivity = Object.freeze({ kind: 'pending' });

function Callout({
  children,
  label,
  tone,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly tone: 'warning' | 'error';
}) {
  return (
    <div aria-label={label} className="game-panel-callout" data-tone={tone} role="group">
      <span aria-hidden="true" className="game-panel-callout-icon">
        !
      </span>
      {children}
    </div>
  );
}

function PlansSection({
  feedback,
  focusPlans,
  focusSlot,
  onSend,
  onSetActive,
  onShowFindings,
  pending,
  plans,
}: {
  readonly focusPlans: boolean;
  readonly focusSlot: FocusRequest | null;
  readonly feedback: Feedback | null;
  readonly onSetActive: (intent: GameActiveSlotIntent) => void;
  readonly onShowFindings: (() => void) | undefined;
  readonly onSend: (slot: GamePlanSlotNumber, confirm: boolean) => void;
  readonly pending: boolean;
  readonly plans: GamePlansProduct;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const focused = useRef(0);
  // Returns focus to the slot's action once a confirmation closes and the panel is idle.
  useEffect(() => {
    if (focusSlot === null || pending || focusSlot.request === focused.current) return;
    focused.current = focusSlot.request;
    sectionRef.current
      ?.querySelector<HTMLButtonElement>(`button[data-slot="${focusSlot.slot}"]`)
      ?.focus();
  }, [focusSlot, pending]);

  return (
    <section aria-labelledby="game-plans-title" className="game-panel-section" ref={sectionRef}>
      <h3 {...(focusPlans ? { 'data-initial-focus': '' } : {})} id="game-plans-title" tabIndex={-1}>
        Plans in game
      </h3>
      {plans.unavailableReason === null ? null : (
        <Callout label="Can’t send" tone="warning">
          <p>{plans.unavailableReason}</p>
          {onShowFindings === undefined ? null : (
            <button
              className="secondary-action action-compact"
              onClick={onShowFindings}
              type="button"
            >
              Show findings
            </button>
          )}
        </Callout>
      )}
      <div
        aria-busy={plans.activeSlot.pending || undefined}
        aria-label={plans.activeSlot.label}
        role="radiogroup"
      >
        <table aria-labelledby="game-plans-title" className="game-panel-slots">
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Plan</th>
              <th scope="col">Route</th>
              <th scope="col">Ends</th>
              <th scope="col">Aspect</th>
              <th scope="col">Sent</th>
              <th scope="col">
                <span className="visually-hidden">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plans.rows.map((row) => (
              <tr data-state={row.state} key={row.slot}>
                <th scope="row">
                  <label className="game-panel-active-slot">
                    <input
                      checked={row.active.checked}
                      data-active-slot={row.slot}
                      aria-disabled={row.active.intent === null || undefined}
                      name="game-active-slot"
                      onChange={() => {
                        if (row.active.intent !== null) onSetActive(row.active.intent);
                      }}
                      type="radio"
                    />
                    Slot {row.slot}
                  </label>
                </th>
                {row.columns === null ? (
                  <td className="game-panel-slot-summary" colSpan={5}>
                    {row.summary}
                  </td>
                ) : (
                  <>
                    <td className="game-panel-slot-wrap" data-label="Plan">
                      {row.columns.plan ?? <span className="game-panel-slot-unnamed">Unnamed</span>}
                      {row.marker === null ? null : (
                        <span className="game-panel-slot-marker" data-marker={row.marker}>
                          {row.marker === 'current' ? 'current' : 'older version'}
                        </span>
                      )}
                    </td>
                    <td data-label="Route">{row.columns.route}</td>
                    <td data-label="Ends">{row.columns.endsAt}</td>
                    <td className="game-panel-slot-wrap" data-label="Aspect">
                      {row.columns.aspect}
                    </td>
                    <td data-label="Sent">
                      {row.columns.sent === null ? (
                        '—'
                      ) : (
                        <>
                          <time
                            aria-describedby={`game-plan-sent-${row.slot}`}
                            dateTime={row.columns.sent.iso}
                            title={row.columns.sent.exact}
                          >
                            {row.columns.sent.ago}
                          </time>
                          <span hidden id={`game-plan-sent-${row.slot}`}>
                            {row.columns.sent.exact}
                          </span>
                        </>
                      )}
                    </td>
                  </>
                )}
                <td className="game-panel-slot-action">
                  {row.action === null ? null : (
                    <button
                      aria-haspopup={row.action.label === 'Save and send…' ? 'dialog' : undefined}
                      aria-label={`${row.action.label} (slot ${row.slot})`}
                      className="secondary-action action-compact"
                      data-slot={row.slot}
                      disabled={pending}
                      onClick={() => onSend(row.slot, row.action?.confirm === true)}
                      type="button"
                    >
                      {row.action.label}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {plans.activeSlot.notice === null ? null : (
        <p className="game-publication-message" role="alert">
          {plans.activeSlot.notice}
        </p>
      )}
      <FeedbackLine feedback={feedback} />
    </section>
  );
}

function GameSection({
  catalog,
  focusPlans,
  gameStatus,
  onShowFindings,
  operations,
}: {
  readonly catalog: Catalog;
  readonly focusPlans: boolean;
  readonly gameStatus: GameStatusController;
  readonly onShowFindings: (() => void) | undefined;
  readonly operations: ProjectOperations;
}) {
  const lastFailure = useAppSelector((state) => state.gameSendSession.lastFailure);
  const lastActivationFailure = useAppSelector(
    (state) => state.gameSendSession.lastActivationFailure,
  );
  const saveState = useAppSelector((state) =>
    gameSaveState(selectProfileStatus(state), state.profileSession.fileName),
  );
  const host = gameStatus.host;
  const snapshot = useSyncExternalStore(
    gameStatus.subscribe,
    gameStatus.getSnapshot,
    gameStatus.getSnapshot,
  );
  const status = snapshot.status;
  const setStatus = gameStatus.publish;
  const [pending, setPending] = useState(true);
  const [plansFeedback, setPlansFeedback] = useState<Feedback | null>(null);
  const [replaceSlot, setReplaceSlot] = useState<GamePlanSlotNumber | null>(null);
  const [focusSlot, setFocusSlot] = useState<FocusRequest | null>(null);
  const returnFocusTo = (slot: GamePlanSlotNumber) =>
    setFocusSlot((current) => ({ slot, request: (current?.request ?? 0) + 1 }));
  const [activation, setActivation] = useState<GameActivationActivity>(IDLE_ACTIVATION);
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

  const product = status === null ? null : projectGamePanel(status);
  const notActivated = describeSentNotActivated(lastActivationFailure, status);
  // The current plan is compiled only while the Plans section can show.
  const plans =
    status !== null && projectGameIndicator(snapshot).state === 'ready'
      ? projectGamePlans(
          status,
          operations.inspectCurrentGamePlan(),
          saveState,
          catalog,
          snapshot.readAt,
          pending ? PENDING_ACTIVATION : activation,
        )
      : null;
  // The radios show the file as re-read after the write, never the click itself.
  const setActive = async (intent: GameActiveSlotIntent) => {
    setPending(true);
    setActivation(IDLE_ACTIVATION);
    setPlansFeedback(null);
    let outcome: GameActivationActivity = IDLE_ACTIVATION;
    try {
      const problem = describeActiveSlotSetting(await host.setActiveSlot(intent.slot));
      if (problem !== null) outcome = { kind: 'failed', message: problem };
    } catch (error) {
      outcome = { kind: 'failed', message: errorText(error) };
    }
    try {
      await gameStatus.refresh();
    } catch {
      // The header indicator reports a failed status read.
    } finally {
      setActivation(outcome);
      setPending(false);
    }
  };
  const send = async (slot: GamePlanSlotNumber) => {
    setPending(true);
    setActivation(IDLE_ACTIVATION);
    setPlansFeedback(null);
    setReplaceSlot(null);
    try {
      const result = await operations.publishGame(slot);
      // A failure is reported by the Last send notice.
      setPlansFeedback(
        result.status === 'failure' ? null : { tone: 'status', text: result.message },
      );
      await gameStatus.refresh();
    } catch (error) {
      setPlansFeedback({ tone: 'alert', text: errorText(error) });
    } finally {
      setPending(false);
      returnFocusTo(slot);
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
    <>
      <LocationSection
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
      {product.module === null ? (
        <FeedbackLine feedback={feedback} />
      ) : (
        <ModuleSection
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
      {lastFailure === null ? null : (
        <Callout label="Last send" tone="error">
          <p>{describeLastSendFailure(lastFailure)}</p>
        </Callout>
      )}
      {notActivated === null ? null : (
        <Callout label="Last send" tone="warning">
          <p>{notActivated}</p>
        </Callout>
      )}
      {plans === null ? null : (
        <PlansSection
          feedback={plansFeedback}
          focusPlans={focusPlans}
          focusSlot={focusSlot}
          onSetActive={(intent) => void setActive(intent)}
          onShowFindings={onShowFindings}
          onSend={(slot, confirm) => {
            if (confirm) setReplaceSlot(slot);
            else void send(slot);
          }}
          pending={pending}
          plans={plans}
        />
      )}
      {replaceSlot !== null && (
        <ConfirmationDialog
          confirmLabel="Replace"
          describedBy="game-plan-replace-message"
          id="game-plan-replace-title"
          onCancel={() => {
            setReplaceSlot(null);
            returnFocusTo(replaceSlot);
          }}
          onConfirm={() => void send(replaceSlot)}
          pending={pending}
          title={`Replace the plan in slot ${replaceSlot}?`}
        >
          <p className="game-publication-message" id="game-plan-replace-message">
            The plan already in this slot is overwritten with the current plan. A run already in
            progress keeps the plan it started with.
          </p>
        </ConfirmationDialog>
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
    </>
  );
}

export function GamePanel({
  bugReport,
  catalog,
  focusPlans = false,
  gameStatus,
  onClose,
  onShowFindings,
  operations,
}: {
  /** Present only in the desktop application. */
  readonly bugReport?: BugReportOperations;
  readonly catalog: Catalog;
  /** Opens with focus on Plans in game when they show. */
  readonly focusPlans?: boolean;
  readonly gameStatus?: GameStatusController;
  readonly onClose: () => void;
  /** Present only when the evaluation has a finding to navigate to. */
  readonly onShowFindings?: () => void;
  readonly operations: ProjectOperations;
}) {
  const [reporting, setReporting] = useState(false);
  return (
    <ModalDialog labelledBy="game-dialog-title" onCancel={onClose} pending={false}>
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Run Planner</p>
          <h2 id="game-dialog-title">Game</h2>
        </div>
      </header>
      {gameStatus === undefined ? (
        <p className="game-publication-hint">
          Game location and game module management are available in the desktop application.
        </p>
      ) : (
        <GameSection
          catalog={catalog}
          focusPlans={focusPlans}
          gameStatus={gameStatus}
          onShowFindings={onShowFindings}
          operations={operations}
        />
      )}
      <footer className="game-publication-actions">
        {bugReport === undefined ? null : (
          <button
            className="quiet-action bug-report-trigger"
            onClick={() => setReporting(true)}
            type="button"
          >
            Create bug report…
          </button>
        )}
        <button className="quiet-action" onClick={onClose} type="button">
          Close
        </button>
      </footer>
      {reporting && bugReport !== undefined && (
        <BugReportDialog onClose={() => setReporting(false)} operations={bugReport} />
      )}
    </ModalDialog>
  );
}
