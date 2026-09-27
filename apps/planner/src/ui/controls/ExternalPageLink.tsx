import type { GameModuleLink } from '@planner/projections/gameModuleSettings';

/** A host-allowlisted page, opened in the default browser rather than the app window. */
export function ExternalPageLink({
  link,
  onOpen,
}: {
  readonly link: GameModuleLink;
  readonly onOpen: (url: string) => void;
}) {
  return (
    <a
      aria-label={link.accessibleName}
      className="external-page-link"
      href={link.url}
      onClick={(event) => {
        event.preventDefault();
        onOpen(link.url);
      }}
      rel="noreferrer"
    >
      {link.label}
    </a>
  );
}
