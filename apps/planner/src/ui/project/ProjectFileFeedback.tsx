import * as Popover from '@radix-ui/react-popover';
import type { LibrarySessionState } from '@planner/state/librarySessionSlice';
import type {
  ProjectOperation,
  ProjectOperationResult,
} from '@planner/workspace/projectOperations';

const failureLabels: Record<ProjectOperation, string> = {
  new: 'Couldn’t create plan',
  importPlan: 'Couldn’t open file',
  openPlan: 'Couldn’t open plan',
  duplicate: 'Couldn’t duplicate plan',
  revert: 'Couldn’t revert plan',
  openCopy: 'Couldn’t open project',
  importPrevious: 'Couldn’t import file',
  publishGame: 'Couldn’t publish to game',
};

const successLabels: Record<ProjectOperation, string> = {
  new: 'Plan created',
  importPlan: 'File added to library',
  openPlan: 'Plan opened',
  duplicate: 'Plan duplicated',
  revert: 'Plan reverted',
  openCopy: 'Project opened',
  importPrevious: 'File imported',
  publishGame: 'Published to game',
};

export function ProjectFileFeedback({
  savesAsYouEdit,
  session,
  result,
}: {
  /** Whether a plan is open, so its edits are being saved. */
  readonly savesAsYouEdit: boolean;
  readonly session: Pick<LibrarySessionState, 'writeError' | 'openError'>;
  readonly result: ProjectOperationResult | null;
}) {
  const errors = [
    ...(result?.status === 'failure'
      ? [{ key: 'operation', label: failureLabels[result.operation], detail: result.message }]
      : []),
    { key: 'write', label: 'Not saved', detail: session.writeError },
    { key: 'open', label: 'Couldn’t reopen plan', detail: session.openError },
  ].filter((error) => error.detail !== null);

  return (
    <div className="project-profile-feedback">
      {result?.status === 'success' ? (
        <p className="project-operation-result" data-status="success" role="status">
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
                aria-label="Plan details"
                className="project-file-error-details"
                align="end"
                collisionPadding={12}
                sideOffset={6}
              >
                <header>
                  <h2>Plan details</h2>
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
      {!savesAsYouEdit || session.writeError !== null ? null : (
        <span className="profile-status" data-profile-status="clean" role="status">
          Saved as you edit
        </span>
      )}
    </div>
  );
}
