# Application closure reassessment

Baseline: `07c161a8`. Question: what concrete application work still earns its
cost after the completed ownership and bridge maintenance?

## Retained boundaries

A fresh read-only review found no further structural correction warranted in
`source-index.ts`, `occurrence-reward-assembly.ts`,
`occurrence-interaction-binding.ts`, or `OccurrenceRoomActions.tsx`. These own,
respectively, authored/reached coverage, complete reward projection, closed
command binding, and rendering/drag selection of already-bound proposals.
Their size reflects coherent joins rather than duplicated engine policy.
Further extraction without a demonstrated defect would add indirection.

## Reproduced layout defect

Select Transcendent Embryo and Revelation in the route loadout. The two numeric
operand fields overflow their allocated widths. At a 1440-pixel viewport the
Weapon Speed field has 221 pixels of scrollable content in 137 pixels of width;
Property Speed has 229 in 141. Their content overlaps adjacent controls. At
600 pixels, operand content extends beyond the visible route panel. A root
document-overflow check alone misses this because an ancestor clips overflow.

Evidence was reproduced in the real browser at 1440, 1000, 800, 600 and 390
pixels using the existing Underworld fixture, not synthetic CSS-only markup.
The defect predates the stylesheet move, whose expanded cascade is unchanged.

Owners: `ui/styles/biome-layout.css` defines the shared Embryo row as nonwrapping
and gives operands a minimum smaller than their intrinsic label/slider/output
width. `project-route-shell.css` and `responsive.css` retain a two-column
keepsake grid even when either half cannot contain its controls. The same
Embryo fields are used for loadout, rack results and automatic timeline outcomes.

Disposition: one focused responsive-layout correction, preserving bindings,
labels, authored values and engine rarity/magnitude semantics. Prefer wrapping
whole controls to clipping/shrinking their contents. No broader UI redesign or
new layout framework. After this correction, stop unless validation produces
another concrete issue; no additional structural plan is justified presently.
