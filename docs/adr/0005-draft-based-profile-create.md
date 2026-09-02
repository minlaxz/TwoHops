---
status: accepted
supersedes: 0004
---

# Profile creation edits a Profile Draft; Apply Link patches the draft

＋ used to persist a blank "Profile n" entry into the Profile List and then
open its editor, with every keystroke written through. Backing out was
impossible: abandoned taps left junk profiles, and ADR 0004 had to carve an
exception out of ADR 0003 so the create screen's Apply Link could populate
that just-persisted blank in place.

＋ now opens the profile screen with a **Profile Draft**: an in-memory Setup
Profile plus a blank profile name (no generated "Profile n"). Apply Link and
the field editors patch the draft locally. **Create** — gated on Profile
Completeness — commits the draft to the Profile List in one append; **Cancel**
or backing out discards it, after a discard confirmation only when the draft
has unsaved changes. Killing the app mid-create persists nothing.

This supersedes ADR 0004: with nothing persisted until Create, the carve-out
it existed for disappears. ADR 0003's rule (a Profile Link never overwrites a
stored Profile) now holds by construction — the draft is not stored. OS deep
links keep ADR 0003's behavior: always create, never overwrite.

Since a Profile Link cannot carry the server name, applying one to a profile
whose server name is empty defaults the name from the link's domain (still
editable) so the link alone reaches Profile Completeness.

## Considered Options

- Keep auto-persist but garbage-collect abandoned blanks on next launch —
  rejected: heuristics for "abandoned" are guesses, and cancel still isn't
  a real operation.
- Persist the draft under a separate "draft" storage key for crash recovery —
  rejected: a crashed create is cheap to redo; a draft key adds a second
  document with migration duties.

## Consequences

- The generated-name helper ("Profile n") and the add-then-navigate flow are
  gone; the committed entry is named from the typed profile name, falling
  back to the server name (the Completeness gate guarantees one exists).
- The Profile List can no longer gain incomplete entries; only profiles
  stored before the gate can be incomplete, and connect keeps refusing them.
- Edit mode moved onto the same draft (#62): opening a profile seeds the
  draft from its entry, **Save** — gated on the same Completeness rule —
  commits name and fields in one write, and write-through per keystroke is
  gone. Saving the Running tunnel's profile is allowed; a "Changes apply on
  next connect" Toast says the live tunnel keeps its config.
- Amended by #71: the Cancel control is gone — header back and Android back
  are the discard paths (same confirmation). The edit footer is Delete +
  Save, and Save adds a touched-Draft gate on top of Completeness
  (touched-flag semantics, not value-diff). Create mode keeps a single
  Create button.
- Amended by #89: the separate "Profile name" is gone. The Draft's only name
  is the Server Credentials Name; Create and Save write the entry name from
  it (trimmed), so a blank Draft starts with the env server name, not blank.
