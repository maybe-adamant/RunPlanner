# Snap mode live acceptance

Turn on **Snap back to the plan** and play a plan. Desync on purpose in a room,
then take any door. The hero leaves the room in the plan's state, you enter the
planned next room, and the header shows Synchronized. Check each item in the
next room unless it says otherwise.

## Exit correction

- [ ] Save & Quit after a correction, then reload: traits and maxima persist,
      and the run continues unsteered.

## Integrity

- [ ] An undeviated run with snap on shows 0 snaps, and the log has no
      `conformance/snap disagreement` line.
- [ ] After a victory with snaps, the summary shows "Snapped back N times".
