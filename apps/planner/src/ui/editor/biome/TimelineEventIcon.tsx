/** A room event as its Timeline marker draws it on the spine. */
export type TimelineEventName =
  | 'roomEntered'
  | 'encounterBegun'
  | 'encounterStarted'
  | 'encounterEnd'
  | 'bossDefeated'
  | 'wheelsOpen'
  | 'doorsOpened'
  | 'returned';

export function TimelineEventIcon({ name }: { readonly name: TimelineEventName }) {
  const content = (() => {
    switch (name) {
      case 'roomEntered':
        return (
          <>
            <path d="M9.5 2.5h3.5v11H9.5" />
            <path d="M2.5 8h7M7 5.5 9.5 8 7 10.5" />
          </>
        );
      case 'encounterBegun':
        return (
          <>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 5v3.5M8 11h.01" />
          </>
        );
      case 'encounterStarted':
        return (
          <>
            <path d="M3 3l7.5 7.5M13 3l-7.5 7.5" />
            <path d="M8.8 12.2l3.4-3.4M3.8 8.8l3.4 3.4M11.5 11.5l2 2M4.5 11.5l-2 2" />
          </>
        );
      case 'encounterEnd':
        return (
          <>
            <circle cx="8" cy="8" r="5.5" />
            <path d="m5.5 8 1.8 1.8 3.2-3.3" />
          </>
        );
      case 'bossDefeated':
        return <path d="M2.5 12.5h11M3.3 10.5 2.5 5l3 2.3L8 3.5l2.5 3.8 3-2.3-.8 5.5z" />;
      case 'wheelsOpen':
        return (
          <>
            <circle cx="8" cy="8" r="4.5" />
            <circle cx="8" cy="8" r="1.3" />
            <path d="M8 1.5v5.2M8 9.3v5.2M1.5 8h5.2M9.3 8h5.2M4.8 4.8l2.3 2.3M11.2 4.8 8.9 7.1M4.8 11.2l2.3-2.3M11.2 11.2 8.9 8.9" />
          </>
        );
      case 'doorsOpened':
        return <path d="M1.5 13.5h13M3.5 13.5V7a4.5 4.5 0 0 1 9 0v6.5M8 13.5V8.5" />;
      case 'returned':
        return (
          <>
            <path d="M12.5 3.5v3a3.5 3.5 0 0 1-3.5 3.5H3" />
            <path d="M5.5 7.5 3 10l2.5 2.5" />
          </>
        );
    }
  })();
  return (
    <svg aria-hidden="true" className="action-icon timeline-event-icon" viewBox="0 0 16 16">
      {content}
    </svg>
  );
}
