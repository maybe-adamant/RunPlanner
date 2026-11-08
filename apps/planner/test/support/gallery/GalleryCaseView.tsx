import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';

import { catalog } from '@run-planner/hades2-catalog';
import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { catalogFindingLabels } from '@planner/projections/evaluationProjection';
import { semanticOwnerFocused, semanticOwnerOpened } from '@planner/state/editorSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { useAppSelector } from '@planner/state/store';
import { BiomeWorkspace } from '@planner/ui/editor/biome/BiomeWorkspace';
import { FindingTargetScope } from '@planner/ui/feedback/useFindingTarget';
import { buildGalleryProject, galleryTargetOwner, type GalleryCase } from './galleryCase';

type CaseView = 'timeline' | 'overview';

/**
 * One case's own application, opened on its target as the editor opens it: on its Timeline, or
 * focused on the room so it shows its default Overview tab.
 */
function openCaseApplication(entry: GalleryCase, view: CaseView): PlannerApplication {
  const project = buildGalleryProject(entry);
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(project));
  if (view === 'overview') {
    application.store.dispatch(semanticOwnerFocused(galleryTargetOwner(project, entry.target)));
    return application;
  }
  application.store.dispatch(
    semanticOwnerOpened({
      owner: galleryTargetOwner(project, entry.target),
      presentation:
        entry.target.kind === 'room'
          ? { kind: 'roomTimeline' }
          : { kind: 'hubSegment', segment: entry.target.segment ?? 0 },
    }),
  );
  return application;
}

function CaseWorkspace({
  application,
  entry,
}: {
  readonly application: PlannerApplication;
  readonly entry: GalleryCase;
}) {
  const workspace = useAppSelector(application.selectStructuredWorkspace);
  const labels = useMemo(() => catalogFindingLabels(catalog), []);
  if (workspace === undefined) throw new Error('the project has no workspace projection');
  const biome = workspace.route.biomes.find(
    (candidate) => candidate.biomeKey === entry.target.biomeKey,
  );
  if (biome === undefined) throw new Error(`the route has no biome ${entry.target.biomeKey}`);
  return (
    <FindingTargetScope
      authoringReadiness={workspace.authoringReadiness}
      findings={workspace.findingsByRepairTarget}
      labels={labels}
    >
      {/* The editor's own frame, so container widths match the app at the same viewport. */}
      <div className="editor-workspace" data-navigation-pinned="true">
        <div className="panel-navigation-column" aria-hidden />
        <div className="editor-panel">
          <div className="editor-panel-content" data-editor-layout="biome">
            <BiomeWorkspace
              biome={biome}
              focusByOwner={workspace.focusByOwner}
              interactions={workspace.interactions}
              runStateLaunchers={workspace.runStateLaunchers}
            />
          </div>
        </div>
      </div>
    </FindingTargetScope>
  );
}

class CaseBoundary extends Component<
  { readonly children: ReactNode },
  { readonly error: string | null }
> {
  override state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? (error.stack ?? error.message) : String(error) };
  }

  override render() {
    return this.state.error === null ? (
      this.props.children
    ) : (
      <pre className="gallery-case-error" data-gallery-error>
        {this.state.error}
      </pre>
    );
  }
}

// Built once per case and view, outside render, so Strict Mode's repeated renders reuse it.
const applications = new Map<GalleryCase, Map<CaseView, PlannerApplication>>();

function caseApplication(entry: GalleryCase, view: CaseView): PlannerApplication {
  const views = applications.get(entry) ?? new Map<CaseView, PlannerApplication>();
  applications.set(entry, views);
  let application = views.get(view);
  if (application === undefined) {
    application = openCaseApplication(entry, view);
    views.set(view, application);
  }
  return application;
}

function OpenedCase({
  entry,
  pickersClosed,
  view,
}: {
  readonly entry: GalleryCase;
  readonly pickersClosed: boolean;
  readonly view: CaseView;
}) {
  const application = caseApplication(entry, view);
  const frame = useRef<HTMLDivElement>(null);
  // Some rooms open on another tab; the Overview pane switches to its tab as a user would.
  useEffect(() => {
    if (view !== 'overview') return;
    frame.current
      ?.querySelector<HTMLButtonElement>('[data-room-tab="overview"][aria-selected="false"]')
      ?.click();
  }, [view]);
  // A case showing another room tab opens it as a user would.
  useEffect(() => {
    if (view !== 'timeline' || entry.roomTab === undefined) return;
    frame.current
      ?.querySelector<HTMLButtonElement>(
        `[data-room-tab="${CSS.escape(entry.roomTab)}"][aria-selected="false"]`,
      )
      ?.click();
  }, [entry, view]);
  // A case showing the door rows expands the door editor as a user would.
  useEffect(() => {
    if (view !== 'timeline' || entry.doorsExpanded !== true) return;
    frame.current
      ?.querySelector<HTMLButtonElement>(
        '.timeline-banner-toggle[aria-controls$="-doors-detail"][aria-expanded="false"]',
      )
      ?.click();
  }, [entry, view]);
  // A case showing an Optional actions list opens its picker once it is enabled, as a user would.
  const pickerOpened = useRef(false);
  useEffect(() => {
    if (view !== 'timeline' || pickersClosed || entry.openPicker === undefined) return;
    const name = entry.openPicker;
    const timer = window.setInterval(() => {
      const trigger = frame.current?.querySelector<HTMLButtonElement>(
        `.room-add button[aria-label="${CSS.escape(name)}"]`,
      );
      if (pickerOpened.current || trigger === null || trigger === undefined || trigger.disabled)
        return;
      pickerOpened.current = true;
      window.clearInterval(timer);
      trigger.click();
    }, 50);
    const stop = window.setTimeout(() => window.clearInterval(timer), 3000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [entry, pickersClosed, view]);
  // A case showing an Overview list opens that picker once the Overview shows it.
  const overviewPickerOpened = useRef(false);
  useEffect(() => {
    if (view !== 'overview' || pickersClosed || entry.openOverviewPicker === undefined) return;
    const name = entry.openOverviewPicker;
    const timer = window.setInterval(() => {
      const trigger = frame.current?.querySelector<HTMLButtonElement>(
        `.room-overview-workbench button[aria-label="${CSS.escape(name)}"]`,
      );
      if (overviewPickerOpened.current || trigger === null || trigger === undefined) return;
      overviewPickerOpened.current = true;
      window.clearInterval(timer);
      trigger.click();
    }, 50);
    const stop = window.setTimeout(() => window.clearInterval(timer), 3000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [entry, pickersClosed, view]);
  return (
    <Provider store={application.store}>
      <div ref={frame}>
        <CaseWorkspace application={application} entry={entry} />
      </div>
    </Provider>
  );
}

export function GalleryCaseView({
  entry,
  everyOverview = false,
  pickersClosed = false,
}: {
  readonly entry: GalleryCase;
  /** Shows the Overview under the Timeline even where the case does not ask for it. */
  readonly everyOverview?: boolean;
  /** Leaves every picker the case would open closed. */
  readonly pickersClosed?: boolean;
}) {
  return (
    <section className="gallery-case" data-gallery-case={entry.id} id={entry.id}>
      <header className="gallery-case-heading">
        <h2>
          <a href={`?case=${encodeURIComponent(entry.id)}`}>{entry.label}</a>
        </h2>
        <p>
          <code>{entry.id}</code> · {entry.shows.join(' · ')}
        </p>
      </header>
      <CaseBoundary>
        <OpenedCase entry={entry} pickersClosed={pickersClosed} view="timeline" />
      </CaseBoundary>
      {entry.overview === true || everyOverview ? (
        <CaseBoundary>
          <OpenedCase entry={entry} pickersClosed={pickersClosed} view="overview" />
        </CaseBoundary>
      ) : null}
    </section>
  );
}
