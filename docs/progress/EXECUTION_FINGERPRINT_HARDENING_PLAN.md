# Execution fingerprint hardening

Status: locked for implementation.

## Contract

The compiler and both execution decoders must fingerprint the same expanded
execution product regardless of host number formatting, locale, or string
escaping. Authored values and gameplay tolerances do not change. The current
Slot 1 witness fails solely because its 2:1 generated-enemy shares stringify
differently in Lua and JavaScript.

Keep the existing bounded FNV-1a checksum, with one explicit canonical input:
finite numbers use big-endian IEEE-754 binary64 hexadecimal bits (negative zero
normalizes to zero); strings use UTF-8 bytes encoded as hexadecimal; object
keys sort by those encoded bytes; arrays preserve order. Typed delimiters keep
values unambiguous. This canonical stream is not the published JSON format.
Reject non-finite numbers. No rounding of shares or weakening of verification.

The engine compiler and decoder share one fingerprint implementation. The Lua
decoder implements the same documented encoding. Bump execution protocol once;
authored schema and catalog version stay unchanged. Older publications require
republishing rather than an alternate legacy hash path.

## Delivery

1. Implement canonical fingerprinting and shared cross-language vectors covering
   thirds, decimal fractions, exponents, subnormals, extreme finite values,
   negative zero, key ordering, Unicode, controls, nesting, and mutation.
2. Refresh protocol fixtures through their owning products, preserve standard
   Prettier formatting, mirror to the module byte-for-byte, and update installed
   compatibility metadata. Compile the supplied authored plan and verify it
   through the Lua decoder without modifying the user's files or active slot.
3. Independent review; focused tests, Lua suite, full repository gate. Describe
   canonical encoding in the integration authority and retire this plan.

Main session owns fixtures, integration documentation, verification, and Git.
Executor owns engine/module fingerprint code and focused tests. Do not change
encounter semantics, conformance tolerances, UI, publication destinations, or
unrelated fixtures. No runtime dependency on test vectors or another hashing
library; no schema migration or installed-profile writes.
