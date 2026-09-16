import { useCallback, useEffect, useRef, useState } from 'react';

import { RoomMapDialog } from './RoomMapDialog';
import { roomMapAssetFor } from './roomMapAssets';
import { RoomMapViewport } from './RoomMapViewport';

/** A non-modal, host-local editing reference with optional full inspection. */
export function RoomMapReferencePane({
  gameName,
  hostId,
  title,
}: {
  readonly gameName: string;
  /** A new containing workbench never inherits an earlier room reference. */
  readonly hostId: string;
  readonly title: string;
}) {
  const expandRef = useRef<HTMLButtonElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const [referenceState, setReferenceState] = useState({
    expanded: false,
    focusReopen: false,
    hostId,
    visible: true,
  });
  const currentState =
    referenceState.hostId === hostId
      ? referenceState
      : { expanded: false, focusReopen: false, hostId, visible: false };
  const closeDialog = useCallback(
    () => setReferenceState((current) => ({ ...current, expanded: false })),
    [],
  );

  useEffect(() => {
    if (!currentState.visible && currentState.focusReopen) reopenRef.current?.focus();
  }, [currentState.focusReopen, currentState.visible]);

  if (!currentState.visible) {
    return (
      <div className="room-map-reference-reopen">
        <button
          aria-label={`Show map reference for ${title}`}
          className="quiet-action action-compact"
          onClick={() =>
            setReferenceState({ expanded: false, focusReopen: false, hostId, visible: true })
          }
          ref={reopenRef}
          type="button"
        >
          Show Room Map
        </button>
      </div>
    );
  }

  return (
    <aside aria-label={`${title} map reference`} className="room-map-reference">
      <RoomMapViewport
        asset={roomMapAssetFor(gameName)}
        key={gameName}
        title={title}
        toolbarTitle="Room Map"
        toolbarActions={
          <>
            <button
              className="quiet-action action-compact"
              onClick={() => setReferenceState((current) => ({ ...current, expanded: true }))}
              ref={expandRef}
              type="button"
            >
              Expand
            </button>
            <button
              aria-label="Close room map reference"
              className="quiet-action action-compact"
              onClick={() =>
                setReferenceState((current) => ({
                  ...current,
                  focusReopen: true,
                  visible: false,
                }))
              }
              type="button"
            >
              Close
            </button>
          </>
        }
      />
      {currentState.expanded ? (
        <RoomMapDialog
          gameName={gameName}
          launcherRef={expandRef}
          onClose={closeDialog}
          title={title}
        />
      ) : null}
    </aside>
  );
}
