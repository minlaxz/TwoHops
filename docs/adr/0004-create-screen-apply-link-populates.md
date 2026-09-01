# 4. Create-screen Apply Link populates the fresh profile in place

Date: 2026-08-31

## Status

Superseded by [ADR 0005](0005-draft-based-profile-create.md): the create
screen now edits an unpersisted Profile Draft, so the carve-out below is moot.

Was: Accepted. Carves an exception out of
[ADR 0003](0003-multiple-setup-profiles.md).

## Context

ADR 0003 established that applying a Profile Link always creates a new
Setup Profile and never overwrites an existing one. With the Dashboard
redesign (issue #55), pressing ＋ creates a blank profile and opens it in
the editor's create mode, which offers a link input. Under a strict
reading of ADR 0003, applying a link there would create a _second_
profile, orphaning the blank one the user just created — or require
draft machinery so the blank is not persisted until the link resolves.

## Decision

On the create screen only, Apply Link populates the just-created blank
profile in place via the pure `applyProfileLink` + `updateEntryProfile`.
It does not create another profile. The carve-out is mode-based: it
applies for the whole create-screen session, even after manual edits to
the fields.

OS deep links (`ProfileLinkListener`) keep ADR 0003's strict behavior:
always create a new profile, never overwrite.

## Consequences

- No draft machinery and no orphan double-profiles from the ＋ flow.
- ADR 0003's intent is preserved: the overwrite target is a
  never-configured blank the user created moments ago, so no configured
  profile can be clobbered.
- Orphan blanks are still possible (＋ then back out); the user deletes
  them manually.
