import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import '@planner/ui/styles.css';
import { HintLayer } from '@planner/ui/controls/HintLayer';
import './gallery.css';
import { GalleryCaseView } from './GalleryCaseView';
import { galleryCases } from './cases';
import { filterGalleryCases } from './galleryCase';

const filter = new URLSearchParams(globalThis.location.search).get('case');
const shown = filterGalleryCases(galleryCases, filter);

function Gallery() {
  // Capture waits for this mark: every case has rendered or shown its error.
  useEffect(() => {
    document.body.dataset.galleryReady = 'true';
  }, []);
  return (
    <main className="gallery">
      <h1 className="gallery-title">
        Timeline row gallery · {shown.length} of {galleryCases.length} cases
      </h1>
      <nav className="gallery-index">
        {shown.map((entry) => (
          <a href={`#${entry.id}`} key={entry.id}>
            {entry.id}
          </a>
        ))}
      </nav>
      {shown.map((entry) => (
        <GalleryCaseView entry={entry} key={entry.id} />
      ))}
      <HintLayer />
    </main>
  );
}

const root = document.getElementById('root');
if (root === null) throw new Error('gallery root element is missing');
createRoot(root).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
