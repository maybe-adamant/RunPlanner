import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';

import { PROJECT_DOCUMENT_SCHEMA_VERSION } from '@run-planner/engine/authored-project';
import type { Catalog, CatalogSummary } from '@run-planner/engine/catalog-schema';

import type { BuildIdentity } from '@planner/composition/buildIdentity';
import { homeBackdropArtwork } from '@planner/ui/artwork/home-backdrop/homeBackdropArtwork';
import type { GameStatusController } from '@planner/persistence/gameModuleHost';
import type { ReleaseUpdateController } from '@planner/persistence/releaseUpdates';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import { projectGamePanel } from '@planner/projections/gamePanel';
import { viewChanged, type HomeTab } from '@planner/state/librarySessionSlice';
import { useAppDispatch } from '@planner/state/store';
import type { BugReportOperations } from '@planner/workspace/bugReport';
import type { CatalogFeedController } from '@planner/workspace/catalogFeed';
import type { CommunityEventController } from '@planner/workspace/communityEvents';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import type { RecordingController } from '@planner/workspace/run-recording/recordingController';
import type { SlotRebuildController } from '@planner/workspace/slotRebuild';
import { hintProps } from '@planner/ui/controls/hint';
import { BugReportDialog } from '../shell/BugReportDialog';
import { CatalogScreen } from './CatalogScreen';
import { ReleaseUpdateCheck } from '../shell/ReleaseUpdates';
import type { AppScale } from '../shell/useAppScale';
import { GameScreen } from './GameScreen';
import { LibraryScreen } from './LibraryScreen';
import { RecentRunsScreen } from './RecentRunsScreen';
import { RecordingControl } from './RecordingControl';
import { SettingsScreen } from './SettingsScreen';
import {
  useGameStatusRefresh,
  useGameStatusSnapshot,
  useLibraryRescan,
  useLibrarySlotLinks,
} from './useLibrarySlotLinks';

const noSubscription = () => () => undefined;

const TABS: readonly { readonly tab: HomeTab; readonly label: string }[] = [
  { tab: 'library', label: 'Library' },
  { tab: 'catalog', label: 'Catalog' },
  { tab: 'runs', label: 'Recent runs' },
  { tab: 'game', label: 'Game' },
  { tab: 'settings', label: 'Settings' },
];

function AboutPopover({
  bugReport,
  buildIdentity,
  catalogSummary,
  releaseUpdates,
}: {
  readonly bugReport: BugReportOperations | undefined;
  readonly releaseUpdates: ReleaseUpdateController | undefined;
  readonly buildIdentity: BuildIdentity;
  readonly catalogSummary: CatalogSummary;
}) {
  const [reporting, setReporting] = useState(false);
  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="quiet-action action-compact" type="button">
            About
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            aria-label="About Run Planner"
            className="about-popover"
            collisionPadding={12}
            sideOffset={8}
          >
            <dl className="about-product-summary">
              <div>
                <dt>Version</dt>
                <dd>{buildIdentity.version}</dd>
              </div>
              <div>
                <dt>Build</dt>
                <dd
                  {...hintProps(
                    buildIdentity.commit === undefined ? undefined : buildIdentity.commit,
                  )}
                >
                  {buildIdentity.build}
                </dd>
              </div>
              <div>
                <dt>Schema</dt>
                <dd>{PROJECT_DOCUMENT_SCHEMA_VERSION}</dd>
              </div>
              <div>
                <dt>Catalog</dt>
                <dd>{catalogSummary.version}</dd>
              </div>
            </dl>
            {releaseUpdates === undefined ? null : (
              <ReleaseUpdateCheck controller={releaseUpdates} />
            )}
            {bugReport === undefined ? null : (
              <div className="about-support">
                <Popover.Close asChild>
                  <button
                    className="secondary-action action-compact"
                    onClick={() => setReporting(true)}
                    type="button"
                  >
                    Create bug report…
                  </button>
                </Popover.Close>
              </div>
            )}
            <section className="about-shortcuts" aria-labelledby="about-shortcuts-title">
              <h2 id="about-shortcuts-title">Keyboard shortcuts</h2>
              <dl>
                <div>
                  <dt>App scale</dt>
                  <dd>
                    <kbd>Ctrl/Cmd</kbd> + <kbd>+</kbd> / <kbd>−</kbd>
                    <span className="shortcut-alternative">or</span>
                    <kbd>Ctrl</kbd> + mouse wheel
                  </dd>
                </div>
                <div>
                  <dt>Reset scale</dt>
                  <dd>
                    <kbd>Ctrl/Cmd</kbd> + <kbd>0</kbd>
                  </dd>
                </div>
                <div>
                  <dt>Undo</dt>
                  <dd>
                    <kbd>Ctrl/Cmd</kbd> + <kbd>Z</kbd>
                  </dd>
                </div>
                <div>
                  <dt>Redo</dt>
                  <dd>
                    <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>
                    <span className="shortcut-alternative">or</span>
                    <kbd>Ctrl</kbd> + <kbd>Y</kbd>
                  </dd>
                </div>
              </dl>
            </section>
            <p className="about-credit">
              Artwork © Supergiant Games, used under their fan content policy.
            </p>
            <Popover.Arrow className="about-popover-arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {reporting && bugReport !== undefined && (
        <BugReportDialog onClose={() => setReporting(false)} operations={bugReport} />
      )}
    </>
  );
}

/** The app's home: the library, the game and settings, entered at startup. */
export function HomeScreen({
  bugReport,
  buildIdentity,
  catalog,
  catalogSummary,
  communityEvents,
  gameStatus,
  operations,
  planCatalog,
  recording,
  releaseUpdates,
  routes,
  scale,
  slotRebuild,
  tab,
  notices,
}: {
  readonly bugReport: BugReportOperations | undefined;
  readonly buildIdentity: BuildIdentity;
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
  readonly communityEvents: CommunityEventController | undefined;
  readonly gameStatus: GameStatusController | undefined;
  readonly operations: ProjectOperations;
  /** The plan catalog; absent where there is no host to read it, as in the browser. */
  readonly planCatalog: CatalogFeedController | undefined;
  /** Run recording; absent where there is no host to watch saves, as in the browser. */
  readonly recording: RecordingController | undefined;
  readonly releaseUpdates: ReleaseUpdateController | undefined;
  readonly routes: readonly RouteEditorNavigation[];
  readonly scale: AppScale;
  readonly slotRebuild: SlotRebuildController | undefined;
  readonly tab: HomeTab;
  /** The app's notices, shown under Home's header. */
  readonly notices: ReactNode;
}) {
  const dispatch = useAppDispatch();
  const [tabActions, setTabActions] = useState<HTMLElement | null>(null);
  useGameStatusRefresh(gameStatus);
  const snapshot = useGameStatusSnapshot(gameStatus);
  const index = useLibrarySlotLinks(operations, gameStatus);
  useLibraryRescan(index.refresh, tab === 'library' || tab === 'catalog' || tab === 'runs');
  const shown =
    (tab === 'catalog' && planCatalog === undefined) || (tab === 'runs' && recording === undefined)
      ? 'library'
      : tab;
  const eventActive = useSyncExternalStore(
    communityEvents?.subscribe ?? noSubscription,
    () => communityEvents?.getSnapshot().kind === 'active',
    () => false,
  );
  const moduleState =
    snapshot.status === null ? null : (projectGamePanel(snapshot.status).module?.state ?? null);
  return (
    <>
      <header
        className="app-header home-header"
        data-backdrop="home"
        style={{ '--window-backdrop': `url("${homeBackdropArtwork}")` } as CSSProperties}
      >
        <div className="home-brand-row">
          <h1>Run Planner</h1>
          <div className="home-brand-actions">
            {recording === undefined ? null : <RecordingControl controller={recording} />}
            <AboutPopover
              bugReport={bugReport}
              buildIdentity={buildIdentity}
              catalogSummary={catalogSummary}
              releaseUpdates={releaseUpdates}
            />
          </div>
        </div>
        <div className="home-tab-row">
          <nav aria-label="Home" className="home-nav">
            {TABS.filter(
              (entry) =>
                (entry.tab !== 'catalog' || planCatalog !== undefined) &&
                (entry.tab !== 'runs' || recording !== undefined),
            ).map((entry) => (
              <button
                aria-current={entry.tab === tab ? 'page' : undefined}
                className="home-nav-tab"
                key={entry.tab}
                onClick={() => dispatch(viewChanged({ kind: 'home', tab: entry.tab }))}
                type="button"
              >
                {entry.label}
                {entry.tab === 'game' && (moduleState === 'updateAvailable' || eventActive) ? (
                  <span className="home-nav-note">
                    {moduleState === 'updateAvailable' ? ' · update' : null}
                    {eventActive ? <span data-tone="event"> · event</span> : null}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          {/* The shown tab's own actions, such as the Library's New plan. */}
          <div className="home-tab-actions" ref={setTabActions} />
        </div>
      </header>
      <div className="home-body">
        {notices}
        {shown === 'library' ? (
          <LibraryScreen
            actionsSlot={tabActions}
            catalog={catalog}
            catalogShown={planCatalog !== undefined}
            gameStatus={gameStatus}
            index={index}
            operations={operations}
            routes={routes}
          />
        ) : shown === 'runs' ? (
          <RecentRunsScreen
            catalog={catalog}
            controller={recording!}
            index={index}
            operations={operations}
          />
        ) : shown === 'catalog' ? (
          <CatalogScreen
            catalog={catalog}
            controller={planCatalog!}
            index={index}
            operations={operations}
            routes={routes}
          />
        ) : shown === 'game' ? (
          <GameScreen
            catalog={catalog}
            {...(communityEvents === undefined ? {} : { communityEvents })}
            {...(gameStatus === undefined ? {} : { gameStatus })}
            index={index}
            operations={operations}
            {...(slotRebuild === undefined ? {} : { slotRebuild })}
          />
        ) : (
          <SettingsScreen catalog={catalog} scale={scale} />
        )}
      </div>
    </>
  );
}
