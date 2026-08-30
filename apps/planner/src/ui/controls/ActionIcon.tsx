export type ActionIconName = 'discard' | 'info' | 'load' | 'new' | 'redo' | 'save' | 'undo';

export function ActionIcon({ name }: { readonly name: ActionIconName }) {
  const content = (() => {
    switch (name) {
      case 'new':
        return (
          <>
            <path d="M4 2.5h5l3 3v8H4z" />
            <path d="M9 2.5v3h3M8 8v3M6.5 9.5h3" />
          </>
        );
      case 'save':
        return (
          <>
            <path d="M3 2.5h9.5l1 1v10h-11v-11Z" />
            <path d="M5 2.5v4h6v-4M5 13.5v-5h6v5" />
          </>
        );
      case 'load':
        return (
          <>
            <path d="M2.5 5.5h4l1-2h6v9h-11z" />
            <path d="m5.5 9 2 2 3-3" />
          </>
        );
      case 'discard':
        return (
          <>
            <path d="M3.5 4.5h9M6 2.5h4l.5 2h-5l.5-2Zm-1 2 .5 9h5l.5-9M7 7v4M9 7v4" />
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
