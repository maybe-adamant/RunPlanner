import * as Popover from '@radix-ui/react-popover';
import type { ProfileSessionState } from '@planner/state/profileSessionSlice';
import type { ProfileStatus } from '@planner/state/store';
import type {
  ProjectOperation,
  ProjectOperationResult,
} from '@planner/workspace/projectOperations';

const statusLabels: Record<ProfileStatus, string> = {
  Clean: 'Saved',
  Dirty: 'Unsaved changes',
  Unsaved: 'Not saved',
  Recovered: 'Recovered',
};

const failureLabels: Record<ProjectOperation, string> = {
  new: 'Couldn’t create project',
  loadProfile: 'Couldn’t load file',
  saveProfile: 'Couldn’t save file',
  saveProfileAs: 'Couldn’t save file',
  publishGame: 'Couldn’t publish to game',
  exportRecovery: 'Couldn’t export autosave',
  discardRecovery: 'Couldn’t discard autosave',
};

const successLabels: Record<ProjectOperation, string> = {
  new: 'Project created',
  loadProfile: 'File loaded',
  saveProfile: 'File saved',
  saveProfileAs: 'Saved as new file',
  publishGame: 'Published to game',
  exportRecovery: 'Autosave exported',
  discardRecovery: 'Autosave discarded',
};

export function ProjectFileFeedback({
  status,
  session,
  result,
}: {
  readonly status: ProfileStatus | undefined;
  readonly session: Pick<
    ProfileSessionState,
    'recoveryError' | 'autosaveError' | 'profileFileError'
  >;
  readonly result: ProjectOperationResult | null;
}) {
  const errors = [
    ...(result?.status === 'failure'
      ? [{ key: 'operation', label: failureLabels[result.operation], detail: result.message }]
      : []),
    { key: 'recovery', label: 'Couldn’t recover autosave', detail: session.recoveryError },
    { key: 'autosave', label: 'Autosave failed', detail: session.autosaveError },
    { key: 'file', label: 'File recovery needs attention', detail: session.profileFileError },
  ].filter((error) => error.detail !== null);

  return (
    <div className="project-profile-feedback">
      {result?.status === 'success' ? (
        <p
          className="project-operation-result"
          data-status="success"
          role="status"
          title={result.message}
        >
          {successLabels[result.operation]}
        </p>
      ) : null}
      {errors.length === 0 ? null : (
        <div className="project-file-failure" role="alert">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="project-file-failure-trigger" type="button">
                <span>{errors[0]!.label}</span>{' '}
                <span>{errors.length > 1 ? `${errors.length} issues · Details` : 'Details'}</span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                aria-label="File operation details"
                className="project-file-error-details"
                align="end"
                collisionPadding={12}
                sideOffset={6}
              >
                <header>
                  <h2>File operation details</h2>
                  <Popover.Close className="quiet-action action-compact">Close</Popover.Close>
                </header>
                {errors.map((error) => (
                  <label key={error.key}>
                    <span>{error.label}</span>
                    <textarea
                      aria-label={`${error.label} details`}
                      readOnly
                      value={error.detail ?? ''}
                      rows={4}
                    />
                  </label>
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      )}
      {status === undefined ? null : (
        <span
          aria-label={`Document status: ${statusLabels[status]}`}
          className="profile-status"
          data-profile-status={status.toLowerCase()}
          role="status"
        >
          {statusLabels[status]}
        </span>
      )}
    </div>
  );
}
