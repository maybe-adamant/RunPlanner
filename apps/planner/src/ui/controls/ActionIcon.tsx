export type ActionIconName =
  'chevronLeft' | 'chevronRight' | 'close' | 'load' | 'redo' | 'reset' | 'undo' | 'zoom';

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
    }
  })();

  return (
    <svg aria-hidden="true" className="action-icon" viewBox="0 0 16 16">
      {content}
    </svg>
  );
}
