import * as Popover from '@radix-ui/react-popover';
import type { LibrarySessionState } from '@planner/state/librarySessionSlice';
import type {
  ProjectOperation,
  ProjectOperationResult,
} from '@planner/workspace/projectOperations';

const failureLabels: Record<ProjectOperation, string> = {
  addCatalog: 'Couldn’t add plan',
  deleteFolder: 'Couldn’t delete folder',
  folder: 'Couldn’t change folder',
  move: 'Couldn’t move plan',
  undoDeleteFolder: 'Couldn’t restore folder',
  delete: 'Couldn’t delete plan',
  reveal: 'Couldn’t open folder',
  undoDelete: 'Couldn’t restore plan',
  new: 'Couldn’t create plan',
  importPlan: 'Couldn’t open file',
  openPlan: 'Couldn’t open plan',
  duplicate: 'Couldn’t duplicate plan',
  revert: 'Couldn’t revert plan',
  openCopy: 'Couldn’t open project',
  importPrevious: 'Couldn’t import file',
  importRecovered: 'Couldn’t import plan',
  publishGame: 'Couldn’t publish to game',
};

/** Shows only failures: an operation's, or the open plan's latest write. */
export function ProjectFileFeedback({
  session,
  result,
}: {
  readonly session: Pick<LibrarySessionState, 'writeError'>;
  readonly result: ProjectOperationResult | null;
}) {
  const errors = [
    ...(result?.status === 'failure'
      ? [{ key: 'operation', label: failureLabels[result.operation], detail: result.message }]
      : []),
    { key: 'write', label: 'Not saved', detail: session.writeError },
  ].filter((error) => error.detail !== null);

  return (
    <div className="project-profile-feedback">
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
                      autoComplete="off"
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
    </div>
  );
}
