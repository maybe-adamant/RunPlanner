# Platform Notes

Platform-specific mechanics behind [orchestration](ORCHESTRATION.md). Roles in
[roles](roles/) stay platform-agnostic; each platform wraps them.

## Claude Code

- **Wrappers:** `.claude/agents/<role>.md` hold the description, model and
  tool list, and point at the role file. Read-only roles run on a smaller model;
  executors run on the session model.
- **Context size:** a subagent notification's token count is cumulative usage,
  not context. Real context is the last assistant turn's input plus cache-read
  plus cache-creation tokens in the agent's transcript; a compaction shows as a
  `compact_boundary` system line. Read those fields with a small script, never
  the whole transcript.
- **Read-only to writer:** an agent launched read-only and later told to edit
  has its edits refused by the auto-mode permission check, since orchestrator
  messages are not owner approval. Start a writer instead, or quote the
  owner's approval verbatim.
- **Interrupts:** an agent stopped by the owner's interrupt cannot be resumed;
  start a fresh one from the worktree and written plan.
