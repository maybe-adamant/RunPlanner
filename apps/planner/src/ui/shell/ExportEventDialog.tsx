import { useState } from 'react';

import { ModalDialog } from '@planner/ui/controls/ModalDialog';
import type { EventExportMetadata, EventSlotOutcome } from '@planner/workspace/communityEvents';

type Fields = Record<keyof EventExportMetadata, string>;

const EMPTY: Fields = {
  id: '',
  title: '',
  description: '',
  rules: '',
  startsAt: '',
  endsAt: '',
};

const LABELS: Readonly<Record<keyof Fields, string>> = {
  id: 'Id',
  title: 'Title',
  description: 'Description',
  rules: 'Rules (optional)',
  startsAt: 'Starts (UTC, 2026-10-12T00:00:00Z)',
  endsAt: 'Ends (UTC)',
};

/** Development builds: exports the open project as an event file for this app's build. */
export function ExportEventDialog({
  onClose,
  onExport,
}: {
  readonly onClose: () => void;
  readonly onExport: (metadata: EventExportMetadata) => Promise<EventSlotOutcome>;
}) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const optional = (value: string) => (value.trim() === '' ? {} : { value: value.trim() });
  const submit = async () => {
    setPending(true);
    setMessage(null);
    const rules = optional(fields.rules).value;
    const outcome = await onExport({
      id: fields.id.trim(),
      title: fields.title.trim(),
      description: fields.description,
      startsAt: fields.startsAt.trim(),
      endsAt: fields.endsAt.trim(),
      ...(rules === undefined ? {} : { rules }),
    });
    setPending(false);
    if (outcome.kind === 'done') onClose();
    else if (outcome.kind === 'failed') setMessage(outcome.message);
  };
  return (
    <ModalDialog labelledBy="export-event-title" onCancel={onClose} pending={pending}>
      <header className="panel-heading">
        <h2 id="export-event-title">Export event file</h2>
      </header>
      <form
        className="export-event-fields"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {(Object.keys(LABELS) as (keyof Fields)[]).map((key) => (
          <label key={key}>
            {LABELS[key]}
            {key === 'description' || key === 'rules' ? (
              <textarea
                disabled={pending}
                onChange={(change) => setFields({ ...fields, [key]: change.target.value })}
                value={fields[key]}
              />
            ) : (
              <input
                disabled={pending}
                onChange={(change) => setFields({ ...fields, [key]: change.target.value })}
                type="text"
                value={fields[key]}
              />
            )}
          </label>
        ))}
        {message === null ? null : (
          <p className="game-publication-message" role="alert">
            {message}
          </p>
        )}
        <footer className="game-publication-actions">
          <button className="quiet-action" disabled={pending} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="secondary-action" disabled={pending} type="submit">
            {pending ? 'Exporting…' : 'Export…'}
          </button>
        </footer>
      </form>
    </ModalDialog>
  );
}
