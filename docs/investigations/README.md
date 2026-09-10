# Investigations

This directory holds temporary analysis performed before an implementation
plan is locked. An investigation may inventory a bug family, compare competing
models, trace current code, record live-game probes, or determine whether a
change is justified.

Investigations are working documents, not repository authority. They may be
revised freely while the question is open and must not be cited as the source
of production behavior.

## Lifecycle

```text
open question
  -> investigation
  -> locked plan, when implementation is warranted
  -> implementation and review
  -> promote durable conclusions
  -> delete the investigation and temporary plan
```

At delivery closure:

- source-backed Hades II facts and bounded unknowns move to `docs/audits/`;
- accepted cross-cutting policy moves to `docs/design/`;
- accepted biome behavior moves to `docs/biomes/`;
- the investigation and its `docs/progress/` plan are deleted by default.

An investigation may remain only while it owns a concrete unresolved question
or pending probe. Once that question is answered, promote only the durable
result rather than preserving the historical reasoning trail.

## Contents

Keep each investigation focused on:

- the question being decided;
- current evidence and relevant source/code contacts;
- uncertainties or required probes;
- competing explanations or designs; and
- the recommended disposition, if one has emerged.

Do not put locked gate sequencing, schema migrations, commit boundaries, or
implementation progress here; those belong in a temporary plan under
`docs/progress/`. Do not add investigations to the root documentation map or
make stable documents depend on them.
