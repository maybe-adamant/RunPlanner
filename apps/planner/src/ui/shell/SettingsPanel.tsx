import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type {
  GameModuleHost,
  GameModuleInstallResult,
  GameModuleStatus,
  GameTargetDiscovery,
} from '@planner/persistence/gameModuleHost';
import {
  describeInstallOutcome,
  describeRemoveOutcome,
  projectGameModuleSettings,
} from '@planner/projections/gameModuleSettings';

function ModalDialog({
  children,
  labelledBy,
  onCancel,
  pending,
}: {
  readonly children: ReactNode;
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function GameModuleSection({ host }: { readonly host: GameModuleHost }) {
  const [status, setStatus] = useState<GameModuleStatus | null>(null);
  const [pending, setPending] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [discovery, setDiscovery] = useState<GameTargetDiscovery | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

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

  const locate = () =>
    run(async () => {
      setDiscovery(await host.discoverTargets());
      return null;
    });
  const established = (next: GameModuleStatus | null) => {
    if (next === null) return null;
    setStatus(next);
    setDiscovery(null);
    return { tone: 'status', text: 'Game target set.' } as const;
  };
  const install = (checkout: boolean, overwriteConsent: boolean) =>
    run(async () => {
      const result: GameModuleInstallResult = checkout
        ? await host.installFromCheckout(overwriteConsent)
        : await host.install(overwriteConsent);
      setStatus(result.status);
      setConfirmation(
        result.outcome === 'consentRequired' ? (checkout ? 'checkoutInstall' : 'install') : null,
      );
      return { tone: 'status', text: describeInstallOutcome(result.outcome) };
    });
  const requestInstall = (checkout: boolean) => {
    if (product?.install.consentRequired === true) {
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

  return (
    <section
      aria-busy={pending}
      aria-labelledby="game-module-settings-title"
      className="settings-section"
    >
      <h3 id="game-module-settings-title">Game Module</h3>
      {product === null ? (
        <p className="game-publication-message">Checking the game target…</p>
      ) : (
        <>
          <dl className="settings-status-list">
            <div>
              <dt>Target</dt>
              <dd>
                {product.target === null
                  ? 'Not set'
                  : `${product.target.location} (${product.target.kindLabel})`}
              </dd>
            </div>
            {product.rows.map((row) => (
              <div data-tone={row.tone} key={row.key}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          {product.targetProblem === null ? null : (
            <p className="game-publication-message" role="alert">
              {product.targetProblem}
            </p>
          )}
          {product.notices.length === 0 ? null : (
            <ul aria-label="Game module notices" className="settings-notices">
              {product.notices.map((notice) => (
                <li data-tone={notice.tone} key={notice.key}>
                  {notice.text}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {feedback === null ? null : (
        <p className="game-publication-message" role={feedback.tone}>
          {feedback.text}
        </p>
      )}
      <div className="settings-actions">
        <button
          className="secondary-action action-compact"
          disabled={pending}
          onClick={() => void locate()}
          type="button"
        >
          Locate Game Module
        </button>
        <button
          className="secondary-action action-compact"
          disabled={pending || product?.install.available !== true}
          onClick={() => requestInstall(false)}
          type="button"
        >
          Install / Update Game Module
        </button>
        <button
          className="danger-action action-compact"
          disabled={pending || product?.remove.available !== true}
          onClick={() => setConfirmation('remove')}
          title={product?.remove.unavailableReason ?? undefined}
          type="button"
        >
          Remove Game Module
        </button>
        {product?.developmentInstallAvailable === true && (
          <button
            className="quiet-action action-compact"
            disabled={pending}
            onClick={() => requestInstall(true)}
            type="button"
          >
            Install from this checkout
          </button>
        )}
      </div>
      {product?.remove.available === false && product.remove.unavailableReason !== null && (
        <p className="game-publication-hint">{product.remove.unavailableReason}</p>
      )}
      {discovery !== null && (
        <section aria-label="Locate game module" className="settings-locate">
          {discovery.supported ? (
            discovery.profiles.length === 0 ? (
              <p className="game-publication-hint">No r2modman Hades II profiles were found.</p>
            ) : (
              <ul aria-label="r2modman profiles">
                {discovery.profiles.map((profile) => (
                  <li key={profile.path}>
                    <button
                      className="quiet-action action-compact"
                      disabled={pending}
                      onClick={() =>
                        void run(async () =>
                          established(await host.useDiscoveredTarget(profile.path)),
                        )
                      }
                      title={profile.location}
                      type="button"
                    >
                      Use {profile.label}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="game-publication-hint">
              r2modman profile discovery is not available on this platform.
            </p>
          )}
          <p className="game-publication-hint">
            Or choose any folder that contains, or is, a ReturnOfModding folder—an r2modman profile
            or a manual Hell2Modding install.
          </p>
          <button
            className="quiet-action action-compact"
            disabled={pending}
            onClick={() => void run(async () => established(await host.chooseTargetFolder()))}
            type="button"
          >
            Choose Folder…
          </button>
        </section>
      )}
      {(confirmation === 'install' || confirmation === 'checkoutInstall') && product !== null && (
        <ConfirmationDialog
          confirmLabel="Replace"
          id="game-module-overwrite-title"
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void install(confirmation === 'checkoutInstall', true)}
          pending={pending}
          title="Replace existing game module?"
        >
          <ul className="settings-notices">
            {product.install.consentFacts.map((fact) => (
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
    </section>
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
        <section aria-labelledby="game-module-settings-title" className="settings-section">
          <h3 id="game-module-settings-title">Game Module</h3>
          <p className="game-publication-hint">
            Game module management is available in the desktop application.
          </p>
        </section>
      ) : (
        <GameModuleSection host={gameModule} />
      )}
      <footer className="game-publication-actions">
        <button className="quiet-action" onClick={onClose} type="button">
          Close
        </button>
      </footer>
    </ModalDialog>
  );
}
