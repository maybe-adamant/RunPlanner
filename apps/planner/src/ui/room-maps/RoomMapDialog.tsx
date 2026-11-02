import { hintProps } from '@planner/ui/controls/hint';
import { ActionIcon } from '@planner/ui/controls/ActionIcon';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { EditorDialog } from '@planner/ui/controls/EditorDialog';

import { roomMapAssetFor } from './roomMapAssets';
import { roomMapOverlayFor } from './HubMapAnnotations';
import { RoomMapViewport } from './RoomMapViewport';

/** A room's map as a read-only dialog: its readable name, the code name on hover. */
export function RoomMapDialog({
  gameName,
  onClose,
  returnFocusId,
  title,
}: {
  readonly gameName: string;
  readonly onClose: () => void;
  /** The launcher that regains focus after the dialog closes. */
  readonly returnFocusId: string;
  readonly title: string;
}) {
  return (
    <EditorDialog
      model={{ kind: 'view', onClose }}
      returnFocusId={returnFocusId}
      size="cards"
      title={
        <span className="room-map-dialog-title" {...hintProps(gameName)}>
          {title}
        </span>
      }
    >
      <RoomMapViewport
        asset={roomMapAssetFor(gameName)}
        controlsPlacement="collapsible-overlay"
        key={gameName}
        overlay={roomMapOverlayFor(gameName)}
        title={title}
      />
    </EditorDialog>
  );
}

/** A transient, host-local launcher for one static room reference. */
export function RoomMapLauncher({
  gameName,
  hostId,
  title,
}: {
  readonly gameName: string;
  /** Changes of the containing owner close an inherited inspection dialog. */
  readonly hostId: string;
  readonly title: string;
}) {
  const launcherId = useId();
  const previousHostIdRef = useRef(hostId);
  const [open, setOpen] = useState(false);
  const closeDialog = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (previousHostIdRef.current !== hostId) {
      previousHostIdRef.current = hostId;
      setOpen(false);
    }
  }, [hostId]);

  return (
    <>
      <button
        aria-label={`View map of ${title}`}
        className="room-map-launcher icon-action"
        onClick={() => setOpen(true)}
        id={launcherId}
        type="button"
        {...hintProps('View map', undefined, `View map of ${title}`)}
      >
        <ActionIcon name="map" />
      </button>
      {open ? (
        <RoomMapDialog
          gameName={gameName}
          onClose={closeDialog}
          returnFocusId={launcherId}
          title={title}
        />
      ) : null}
    </>
  );
}
