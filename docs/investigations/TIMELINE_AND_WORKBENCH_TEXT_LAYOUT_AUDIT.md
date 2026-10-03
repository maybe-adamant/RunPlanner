# Timeline and Workbench Text Layout Audit

Status: open for the remaining audit surface only. Delivered slices live in
`docs/design/STRUCTURED_EDITOR_WORKSPACE.md`; visual confirmation is tracked in
`docs/testing/EDITOR_LAYOUT_LIVE_ACCEPTANCE.md`.

This note records the audit criteria for text that appears on the timeline,
overview, and Door Exit tabs, and the surface still to review. It is not
durable product authority.

## Original question

Text added while editing can appear unexpectedly and shift nearby controls. The
goal was to identify those messages, decide which belong in findings, and keep
useful game rules and state explanations in deliberately stable positions. The
goal was not to remove all explanatory text. Narrow layouts may wrap across
multiple lines when that reads more clearly than compressed controls.

The central disposition established during the discussion:

- Repair guidance that already has a finding should live in the finding and
  route to the control that fixes it. Do not repeat the same repair paragraph
  inline on a timeline or workbench.
- Explanations of game rules or authored outcomes may remain visible when they
  help the user make a decision. Place them in a deliberate information area
  associated with the relevant controls, rather than allowing them to appear
  between controls as incidental text.
- Keep the layout stable while a user edits, especially when evaluation changes
  a row from valid to invalid or makes a control temporarily inactive.
- Door Exit notes are appropriate because that tab is less dynamic and its
  rules (such as minimum/maximum links and Fields cage order) are useful there.
  Keep their layout intentional and stable.

## Text and states intentionally retained

The audit found several messages that communicate state or a rule rather than
duplicating repair guidance. Keep these unless a separate review shows their
layout is unstable or their meaning is already available at the point of use:

- Door Exit explanations such as link minimum/maximum rules and Fields cage
  ordering.
- Hub completion guidance, fountain timing, and outcome summaries.
- Legitimate empty or not-yet-generated states, including no reward, no
  outgoing door, a closed Hub room awaiting its opening, and an empty shop
  inventory. Keep “Hidden on this door” distinct from “No reward.”
- The shop's unselected inventory state and other picker placeholder guidance.
- Dynamic blocked/unentered states that explain why the whole view has no
  editable controls.

The review criterion is whether the message tells the user a game rule, a
current result, or a necessary state. A repair instruction already represented
by a finding should instead be consolidated into that finding.

## Remaining audit surface

The following areas were identified as separate follow-up inventory rather than
part of the delivered slices:

- “Stale” versus “Required” badges: stale state may overlap a finding, while a
  required obligation can be meaningful independently.
- Nemesis fallback text such as “Choose an event”; its reachability and layout
  impact were not established.
- Side-room “No reward until generated” state, which currently changes the
  displayed control area.
- Dialogs and popovers, which need a separate review because draft feedback can
  differ from project-level findings. This includes encounter customization,
  Trait/Pom drafts, Echo/Circe/Chaos loading and results, and Hub map popovers.
- Any remaining timeline, overview, or exit text not covered by the focused
  slices above.

These are not accepted defects by themselves. Review each against the same
criteria: whether it duplicates a finding, whether it communicates a necessary
rule/result/state, whether it stays in a stable location during edits, and
whether navigation points to the control that owns the repair.
