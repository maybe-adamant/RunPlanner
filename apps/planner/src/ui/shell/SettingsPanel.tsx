import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type {
  GameModuleHost,
  GameModuleStatus,
  GameTargetDiscovery,
} from '@planner/persistence/gameModuleHost';
import {
  describeInstallOutcome,
  describeRemoveOutcome,
  projectGameModuleSettings,
  projectGameProfileChoices,
  type GameLocationProduct,
  type GameModuleSectionProduct,
} from '@planner/projections/gameModuleSettings';
import { ContextualPicker } from '../controls/ContextualPicker';
import { ExternalPageLink } from '../controls/ExternalPageLink';

function ModalDialog({
  children,
  describedBy,
  labelledBy,
  onCancel,
  pending,
}: {
  readonly children: ReactNode;
  readonly describedBy?: string;
  readonly labelledBy: string;
  readonly onCancel: () => void;
  readonly pending: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }
  }, []);

  return (
    <dialog
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="game-publication-dialog-backdrop"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      ref={dialogRef}
    >
      <section className="game-publication-dialog settings-dialog">{children}</section>
    </dialog>
  );
}

function ConfirmationDialog({
  children,
  confirmLabel,
  id,
  onCancel,
  onConfirm,
  pending,
  title,
}: {
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly id: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly pending: boolean;
  readonly title: string;
}) {
  return (
    <ModalDialog labelledBy={id} onCancel={onCancel} pending={pending}>
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
      <section aria-labelledby="game-location-title" className="settings-section" ref={sectionRef}>
        <div className="settings-location-line">
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
    <section aria-labelledby="game-location-title" className="settings-section" ref={sectionRef}>
      <h3 id="game-location-title">Game location</h3>
      <p className="game-publication-hint">Choose where Hades II mods are installed.</p>
      <div className="settings-actions">
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
          selectedExplanation="never"
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
    <section aria-labelledby="game-module-settings-title" className="settings-section">
      <h3 id="game-module-settings-title">Game module</h3>
      <p className="settings-module-status" data-tone={module.tone}>
        {module.summary}
      </p>
      {module.steps.length === 0 ? null : (
        <ol aria-label="Game module steps" className="settings-steps">
          {module.steps.map((step) => (
            <li data-tone={step.tone} key={step.key}>
              <span aria-hidden="true" className="settings-step-icon">
                {step.tone === 'error' ? '✕' : '!'}
              </span>
              <span className="visually-hidden">
                {step.tone === 'error' ? 'Required: ' : 'Recommended: '}
              </span>
              <span>
                {step.text}
                {step.found === null ? null : (
                  <span className="settings-step-found"> (found {step.found})</span>
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
      {module.removeAvailable && (
        <button
          className="quiet-action action-compact"
          disabled={pending}
          onClick={onRemove}
          type="button"
        >
          Remove game module
        </button>
      )}
      <details className="settings-details">
        <summary>Details</summary>
        <dl className="settings-status-list">
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

function GameSettings({ host }: { readonly host: GameModuleHost }) {
  const [status, setStatus] = useState<GameModuleStatus | null>(null);
  const [pending, setPending] = useState(true);
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
    host
      .status()
      .then((next) => {
        if (current) setStatus(next);
      })
      .catch((error: unknown) => {
        if (current) setFeedback({ tone: 'alert', text: errorText(error) });
      })
      .finally(() => {
        if (current) setPending(false);
      });
    return () => {
      current = false;
    };
  }, [host]);

  const product = status === null ? null : projectGameModuleSettings(status);

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
            <ul className="settings-notices">
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

export function SettingsPanel({
  gameModule,
  onClose,
}: {
  readonly gameModule?: GameModuleHost;
  readonly onClose: () => void;
}) {
  return (
    <ModalDialog labelledBy="settings-dialog-title" onCancel={onClose} pending={false}>
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Run Planner</p>
          <h2 id="settings-dialog-title">Settings</h2>
        </div>
      </header>
      {gameModule === undefined ? (
        <p className="game-publication-hint">
          Game location and game module management are available in the desktop application.
        </p>
      ) : (
        <GameSettings host={gameModule} />
      )}
      <footer className="game-publication-actions">
        <button className="quiet-action" onClick={onClose} type="button">
          Close
        </button>
      </footer>
    </ModalDialog>
  );
}
