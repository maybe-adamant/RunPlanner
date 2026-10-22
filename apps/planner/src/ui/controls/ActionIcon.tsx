export type ActionIconName =
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'duplicate'
  | 'load'
  | 'move'
  | 'openInEditor'
  | 'redo'
  | 'rename'
  | 'reset'
  | 'trash'
  | 'undo'
  | 'zoom';

export function ActionIcon({ name }: { readonly name: ActionIconName }) {
  const content = (() => {
    switch (name) {
      case 'load':
        return (
          <>
            <path d="M2.5 5.5h4l1-2h6v9h-11z" />
            <path d="m5.5 9 2 2 3-3" />
          </>
        );
      case 'undo':
        return (
          <>
            <path d="m6 4-3 3 3 3" />
            <path d="M3 7h6a4 4 0 0 1 4 4" />
          </>
        );
      case 'redo':
        return (
          <>
            <path d="m10 4 3 3-3 3" />
            <path d="M13 7H7a4 4 0 0 0-4 4" />
          </>
        );
      case 'reset':
        return (
          <>
            <path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2" />
            <path d="M12 2.5v2.8H9.2" />
          </>
        );
      case 'chevronLeft':
        return <path d="m10 3.5-4.5 4.5 4.5 4.5" />;
      case 'chevronRight':
        return <path d="m6 3.5 4.5 4.5-4.5 4.5" />;
      case 'close':
        return <path d="m4.5 4.5 7 7m0-7-7 7" />;
      case 'duplicate':
        return (
          <>
            <rect height="8" rx="1" width="8" x="5.5" y="5.5" />
            <path d="M10.5 3.5v-1h-8v8h1" />
          </>
        );
      case 'move':
        return (
          <>
            <path d="M1.5 4.5v8h13v-7h-6.5l-1.5-1.5h-5z" />
            <path d="m7.5 7.5 2 1.5-2 1.5M5 9h4.5" />
          </>
        );
      case 'rename':
        return <path d="M10.5 2.5 13.5 5.5 6 13H3v-3zM9 4l3 3" />;
      case 'trash':
        return <path d="M3.5 4.5h9M6 2.5h4l.5 2h-5l.5-2Zm-1 2 .5 9h5l.5-9M7 7v4M9 7v4" />;
      case 'openInEditor':
        return (
          <>
            <path d="M7 3.5H3.5v9h9V9" />
            <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5" />
          </>
        );
    }
  })();

  return (
    <svg aria-hidden="true" className="action-icon" viewBox="0 0 16 16">
      {content}
    </svg>
  );
}
