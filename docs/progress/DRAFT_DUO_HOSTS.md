# Draft Basket by Giver

Status: locked 2026-10-25. Base commit: `c31da949a`.

## Objective

A Duo becomes an ordinary entry in one god's ordered basket list. Its timing
comes from the order the player authors, and pacing spreads it like any trait.
Today Duos sit outside every queue, in a shared Duos section, and either god may
offer one once its prerequisites are held. The same delivery fixes two walk
gaps any basket can hit: Travel Deal refills and mutually exclusive traits.

## Model

1. **Basket by giver.** The draft spec stores `basketByGiver`
   (`giverKey → ordered traitKeys`) in place of the flat `basketTraitKeys`.
   Order matters only within a giver. A Duo is stored in exactly one of its
   gods' lists; that god is its host. Old projects' `basketTraitKeys` is an
   unknown key under tolerant decoding and is dropped, so the basket opens
   empty and the player re-picks it (owner-approved, announced in release
   notes). No schema revision, no migration, no fixture change.
2. **Tolerant decoding.** Unknown givers and traits, a trait under a giver that
   does not offer it, and a trait already listed (first occurrence in pool
   order wins) are dropped. A supply trait is keyed by its own giver; the
   executor inventories basket-eligible traits without a single giver before
   coding and reports them.
3. **Queue position and host.** The engine derives each giver's queue and each
   Duo's host from the record. Only the host offers the Duo, and it counts
   toward its host's traits-per-god cap.
4. **Prerequisites by deferral.** When the host's queue reaches a Duo before its
   prerequisites are held, the walk takes the host's next queued trait and
   returns to the Duo once they are held (`nextQueued`). The static
   `prerequisiteAfter` order refusal does not apply to a Duo.
5. **Mutually exclusive traits.** Exclusions come from the catalog's
   `notEquippedTrait` requirements (today the cast set: Glowing Coal, Lightning
   Lance, Howling Soul, Tipsy Shot and the Hostile Environment Duo). A basket
   holds at most one of a mutually exclusive set: the editor stops offering the
   others and a saved basket holding two is refused at draft time. The walk
   never takes a trait outside the basket that a basket trait still to come
   excludes.
6. **Travel Deal refills.** The walk fills a Travel Deal refill from the
   refilled slot's options, as settlement does, instead of finding none.
7. **Share codes.** The per-giver lists replace the flat basket in layout 3's
   positional world section; layout 3 is unreleased, so no bump.

## Ownership

- **Planner engine:** spec field, tolerant decode, equality; queues
  (`draftSourceQueues`, `draftCappedGiver`), refusals (including exclusive
  sets), budget, schedule, steering (`readyDuos` retired, `nextQueued`
  deferral), trait offers, the walk's refill path; share-code layout.
- **Planner application:** basket projection and panel. Each god section edits
  its own list; a Duo shows in both its gods' sections, picking it in one adds
  it to that list and the other shows it taken by the host (visible text, not a
  hover); excluded traits are unavailable once one of their set is picked; the
  shared Duos section is removed. Edits go through `ReplaceDraftSpec`.

## Gates

1. **Engine basket by giver:** model items 1–4 and 7 on top of the rebuilt Duo
   engine work; `duoHostByTrait` and its share-code tag removed. Tests at their
   owners; the healing matrix stays in `draft-spec.test.ts`.
2. **Travel Deal refill** (item 6), its own commit with a walk witness.
3. **Mutually exclusive traits** (item 5, engine part), its own commit;
   the misleading `slotBan` refusal label renamed to what it reports.
4. **Corpus:** rerun, explain deltas (Duo-met should hold or rise; the small
   god-met cost on the trait after a hosted Duo is accepted), rewrite the
   baseline.
5. **Application:** basket UI per the approved mock-up and item 5's editor
   part; UI tests.
6. **Closure:** docs (authored model draft spec, draft steering, share codes),
   release-note line, delete this plan.

## Non-goals

- Changing which Duos exist or their prerequisites.
- Letting both gods offer a hosted Duo.
- Raising the default per-god cap.
- Tuning the host's tail after a Duo.
