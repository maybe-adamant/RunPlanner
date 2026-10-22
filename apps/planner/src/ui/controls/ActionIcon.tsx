export type ActionIconName =
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'info'
  | 'load'
  | 'new'
  | 'publish'
  | 'redo'
  | 'reset'
  | 'duplicate'
  | 'undo'
  | 'zoom';

export function ActionIcon({ name }: { readonly name: ActionIconName }) {
  const content = (() => {
    switch (name) {
      case 'zoom':
        return (
          <>
            <circle cx="6.5" cy="6.5" r="4" />
            <path d="m9.5 9.5 4 4" />
          </>
        );
      case 'new':
        return (
          <>
            <path d="M4 2.5h5l3 3v8H4z" />
            <path d="M9 2.5v3h3M8 8v3M6.5 9.5h3" />
          </>
        );
      case 'duplicate':
        return (
          <>
            <path d="M5.5 5.5h7.5v8h-7.5z" />
            <path d="M3 11V2.5h7.5" />
          </>
        );
      case 'publish':
        return (
          <>
            <path d="M8 10.5v-8M5.5 5 8 2.5 10.5 5" />
            <path d="M3 8.5v5h10v-5" />
          </>
        );
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
      case 'info':
        return (
          <>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 7v4M8 5h.01" />
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
