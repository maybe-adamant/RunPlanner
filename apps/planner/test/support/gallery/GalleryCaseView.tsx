import { Component, useMemo, type ReactNode } from 'react';
import { Provider } from 'react-redux';

import { catalog } from '@run-planner/hades2-catalog';
import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { catalogFindingLabels } from '@planner/projections/evaluationProjection';
import { semanticOwnerOpened } from '@planner/state/editorSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { useAppSelector } from '@planner/state/store';
import { BiomeWorkspace } from '@planner/ui/editor/biome/BiomeWorkspace';
import { FindingTargetScope } from '@planner/ui/feedback/useFindingTarget';
import { buildGalleryProject, galleryTargetOwner, type GalleryCase } from './galleryCase';

/** One case's own application, opened on its target as the editor opens it. */
function openCaseApplication(entry: GalleryCase): PlannerApplication {
  const project = buildGalleryProject(entry);
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(project));
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

// Built once per case, outside render, so Strict Mode's repeated renders reuse it.
const applications = new Map<GalleryCase, PlannerApplication>();

function caseApplication(entry: GalleryCase): PlannerApplication {
  let application = applications.get(entry);
  if (application === undefined) {
    application = openCaseApplication(entry);
    applications.set(entry, application);
  }
  return application;
}

function OpenedCase({ entry }: { readonly entry: GalleryCase }) {
  const application = caseApplication(entry);
  return (
    <Provider store={application.store}>
      <CaseWorkspace application={application} entry={entry} />
    </Provider>
  );
}

export function GalleryCaseView({ entry }: { readonly entry: GalleryCase }) {
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
        <OpenedCase entry={entry} />
      </CaseBoundary>
    </section>
  );
}
