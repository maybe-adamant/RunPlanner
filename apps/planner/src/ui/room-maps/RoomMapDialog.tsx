import { hintProps } from '@planner/ui/controls/hint';
import { ActionIcon } from '@planner/ui/controls/ActionIcon';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { EditorDialog } from '@planner/ui/controls/EditorDialog';

import { roomMapAssetFor } from './roomMapAssets';
import { RoomMapViewport } from './RoomMapViewport';

/** A room's map as a read-only dialog: its readable name, the code name on hover. */
export function RoomMapDialog({
  gameName,
  legend,
  mirrored = false,
  onClose,
  overlay,
  returnFocusId,
  title,
}: {
  readonly gameName: string;
  /** A key to the overlay's marks, under the map. */
  readonly legend?: ReactNode;
  /** The room shows flipped: its image mirrored under an overlay placed for it. */
  readonly mirrored?: boolean;
  readonly onClose: () => void;
  /** Marks drawn over the image. */
  readonly overlay?: ReactNode;
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
        mirrored={mirrored}
        overlay={overlay}
        title={title}
      />
      {legend}
    </EditorDialog>
  );
}

/** A transient, host-local launcher for one static room reference. */
export function RoomMapLauncher({
  gameName,
  hostId,
  legend,
  mirrored = false,
  overlay,
  title,
}: {
  readonly gameName: string;
  /** Changes of the containing owner close an inherited inspection dialog. */
  readonly hostId: string;
  readonly legend?: ReactNode;
  readonly mirrored?: boolean;
  readonly overlay?: ReactNode;
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
          legend={legend}
          mirrored={mirrored}
          onClose={closeDialog}
          overlay={overlay}
          returnFocusId={launcherId}
          title={title}
        />
      ) : null}
    </>
  );
}
