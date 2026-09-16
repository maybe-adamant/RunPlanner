import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { RoomMapDialog } from './RoomMapDialog';
import { roomMapAssetFor } from './roomMapAssets';
import { RoomMapViewport } from './RoomMapViewport';

/** A non-modal, host-local editing reference with optional full inspection. */
export function RoomMapReferencePane({
  gameName,
  hostId,
  onVisibleChange,
  title,
  visibilityLauncherRef,
  visible,
}: {
  readonly gameName: string;
  /** A new containing workbench never inherits an earlier room reference. */
  readonly hostId: string;
  readonly onVisibleChange?: (visible: boolean) => void;
  readonly title: string;
  readonly visibilityLauncherRef?: RefObject<HTMLButtonElement | null>;
  /** An owning workbench may retain reference visibility across its local views. */
  readonly visible?: boolean;
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
  const referenceVisible = visible ?? currentState.visible;
  const setReferenceVisible = (nextVisible: boolean, focusLauncher = false): void => {
    setReferenceState((current) => {
      const active =
        current.hostId === hostId
          ? current
          : { expanded: false, focusReopen: false, hostId, visible: false };
      return {
        ...active,
        expanded: nextVisible ? active.expanded : false,
        focusReopen: focusLauncher,
        visible: nextVisible,
      };
    });
    onVisibleChange?.(nextVisible);
    if (!nextVisible && focusLauncher) visibilityLauncherRef?.current?.focus();
  };
  const closeDialog = useCallback(() => {
    setReferenceState((current) =>
      current.hostId === hostId
        ? { ...current, expanded: false }
        : { expanded: false, focusReopen: false, hostId, visible: false },
    );
  }, [hostId]);

  useEffect(() => {
    if (!referenceVisible && currentState.focusReopen) reopenRef.current?.focus();
  }, [currentState.focusReopen, referenceVisible]);

  if (!referenceVisible) {
    if (visible !== undefined) return null;
    return (
      <div className="room-map-reference-reopen">
        <button
          aria-label={`Show map reference for ${title}`}
          className="quiet-action action-compact"
          onClick={() => setReferenceVisible(true)}
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
              onClick={() =>
                setReferenceState((current) =>
                  current.hostId === hostId
                    ? { ...current, expanded: true }
                    : { expanded: true, focusReopen: false, hostId, visible: false },
                )
              }
              ref={expandRef}
              type="button"
            >
              Expand
            </button>
            <button
              aria-label="Close room map reference"
              className="quiet-action action-compact"
              onClick={() => setReferenceVisible(false, true)}
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
