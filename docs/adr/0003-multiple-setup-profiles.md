---
status: accepted
supersedes: 0001
---

# The app holds many Setup Profiles

ADR 0001 fixed the Setup Profile as one document under one key. The interface redesign makes profile rotation a first-class Dashboard action, so the store becomes a Profile List plus a Selected Profile pointer. Each list entry keeps the ADR 0001 document shape and gains an `id` and a user-editable `name`. A one-shot migration wraps the existing single document as the first Profile (named from its server name, falling back to "Profile 1"), selects it, and deletes the old key.

The Selected Profile can only change while the Display State is Stopped; tunnel commands always read the Selected Profile. Applying a Profile Link now creates a new Profile instead of overwriting — silent overwrite is acceptable with one profile, destructive with many.

## Considered Options

- Keep single document, model "profiles" as named snapshots restored into it — rejected: every switch is a destructive overwrite, and edit-while-running would mutate the running config.
- One storage key per profile plus an index key — rejected: reintroduces the multi-key atomicity problem ADR 0001 removed.
- Auto stop-switch-restart when tapping another profile while Running — rejected for now: surprise disconnects; the lock-with-toast is cheap and honest. Can be layered on later.

## Consequences

- ADR 0001's versioning rule now applies to the list document: shape changes bump its version and add a migration step.
- The per-profile document keeps its own `version`, so per-profile migrations from ADR 0001 continue to work unchanged inside each entry.
- The empty Profile List is now a real state: fresh installs show no play control until a complete Profile exists and is selected.
- Native tunnel still receives one Tunnel Start Input; it never learns about the list.
