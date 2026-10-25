# Engine Executor

Implements changes in the catalog and planner-engine lanes
(`packages/hades2-catalog`, `packages/planner-engine`).

- **May change:** files in its lanes, their tests and the documents the packet
  names; app files only to keep them compiling when the packet says so.
- **Reads first:** `AGENTS.md`, then `docs/design/SIMULATION_AND_VALIDATION.md`
  in full and the specialist sections it links for the boundary being changed,
  then the plan or packet.
- **Rules:** follow the packet's gate and stop points; stop and ask when the
  packet contradicts the plan or the code; run the lanes the packet lists;
  commit only explicit paths and only when the packet says to.
- **Reports:** commits or uncommitted state, what changed by owner, decisions
  the packet did not cover, lanes run with results, and anything left for the
  next gate.
