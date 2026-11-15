export type TextGlyphName = 'collapsed' | 'expanded' | 'grip' | 'cross' | 'menu';

/**
 * A symbol set in running text that the bundled Inter lacks, drawn at the text's size and
 * colour so it looks the same on every platform.
 */
export function TextGlyph({ name }: { readonly name: TextGlyphName }) {
  const content = (() => {
    switch (name) {
      case 'collapsed':
        return <path className="text-glyph-fill" d="M6 4.5 11 8l-5 3.5z" />;
      case 'expanded':
        return <path className="text-glyph-fill" d="M4.5 6h7L8 11z" />;
      case 'grip':
        return (
          <g className="text-glyph-fill">
            <circle cx="6" cy="3.5" r="1.25" />
            <circle cx="10" cy="3.5" r="1.25" />
            <circle cx="6" cy="8" r="1.25" />
            <circle cx="10" cy="8" r="1.25" />
            <circle cx="6" cy="12.5" r="1.25" />
            <circle cx="10" cy="12.5" r="1.25" />
          </g>
        );
      case 'cross':
        return <path d="m4.5 4.5 7 7m0-7-7 7" />;
      case 'menu':
        return <path d="M3 4.5h10M3 8h10M3 11.5h10" />;
    }
  })();

  return (
    <svg aria-hidden="true" className="text-glyph" viewBox="0 0 16 16">
      {content}
    </svg>
  );
}
