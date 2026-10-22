# Community events live acceptance

Requires a planner release that ships the real event public key
(`apps/planner/src-tauri/event-feed.pub`) and reads feed version 2, the events
repository (`maybe-adamant/RunPlanner-Events`) with its signing secrets, and a
ready game target with that release's module installed. Automated tests are not
live verification; the owner confirms or waives each check.

## Setup

- [ ] Generate the event key, add the events repository secrets, install the
      public key in the planner and release it (CONTRIBUTING, Community
      events).
- [ ] In the events repository, open a pull request adding a test event whose
      window contains now (with a complete project). Its validation check
      passes. Before merging, dispatch **Publish events** on the pull request's
      branch with dry run on: the summary lists the event with its project
      schema and nothing is uploaded. Merging publishes it.
- [ ] After the merge (or a manual run with dry run off), the `events` release holds
      `events.json`, `events.json.sig` and `<id>.runplanner.json`, is marked
      pre-release, and the events repository's own latest release is not it.
      Running again with no change reports the feed unchanged and uploads
      nothing.

## App and game

- [ ] Start the app: Home's Game tab reads **Game · event**, and the Game tab's
      event card reads `Event: <title> · ends <date>`. **Details** shows the
      description and rules below the card's first row; **Copy link** copies the
      project URL and reads Copied briefly without moving the buttons.
- [ ] **Set as active** makes the Event slot active: the button reads
      **Active** and the slot table's Event row has its Next run dot filled.
- [ ] The Event slot holds the event's plan, compiled by the app from the
      event's project, without a feed republish for this planner release.
- [ ] **Open project** adds the event's plan to the library as a copy and opens
      it. The copy sent to a slot does not count as the event.
- [ ] The Game tab shows the **Event** row above the twelve slots with the title
      marked community event, route and loadout, a Next run choice, and no send
      action.
- [ ] In game, the **Plan** picker lists `Event: <title> (<label>)` first;
      details show the event and its end. Pick it and finish the run: Current
      Run reads `Event: <title>`, and the victory screen's first row reads
      `Planned event - <title>` above the usual status row.
- [ ] **Dismiss** hides the notice across restarts; the Event slot still holds
      the plan.

## Ending, offline and integrity

- [ ] With the Event slot active, let the event end (or publish an earlier end
      date) with the app running: shortly after the end, slot 0 is cleared,
      slot 1 becomes active and the notice says the event ended and what the
      next run uses. In game the picker no longer lists the event.
- [ ] Start the app offline after a successful fetch: the notice and the Event
      slot stay until the event ends. Start offline with no cached feed: the
      Event slot is kept until its own end time.
- [ ] Replace the published `<id>.runplanner.json` with another file (keeping
      the feed): the Event slot is not rewritten and **Open project** refuses
      it as not matching the event.
- [ ] With the Event slot active, let an event end while the next event starts
      at once with a project the planner cannot play (a newer
      `projectSchemaVersion`, or its project file missing): slot 0 is cleared,
      slot 1 becomes active and the notice says the event ended; the next sync
      shows the new event's notice without **Set as active**.
- [ ] Publish an event whose `projectSchemaVersion` is newer than the
      installed planner's schema: the notice reads "Update the planner to play
      this event." with no **Set as active**, and the Event slot is not
      written.
