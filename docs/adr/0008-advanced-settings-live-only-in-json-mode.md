# Advanced Settings live only in JSON Mode

The TrustTunnel core takes knobs the app has always hard-coded — kill switch,
anti-DPI, MTU, fallback protocol, the LAN routes excluded from the tunnel. Power
users asked for them; adding a Form field for each would grow the Profile Form
for everyone, for settings almost nobody changes.

The Setup Profile now stores them as **Advanced Settings** (document v4, seeded
with the old constants), the encoder reads them instead of constants, and the
only place to see or change them is **JSON Mode** — a second face of the profile
screen that edits the whole Profile Draft as one JSON document. The Form stays
as it is. Profile Link and Share Profile do not carry Advanced Settings.

## Considered Options

- **Show the raw core config (the TOML-ish text) and let the user edit it.**
  Rejected: it bypasses the Setup Profile model; the app could no longer
  reason about a profile, gate Save on completeness, or migrate it.
- **JSON of the Setup Profile only, no new knobs.** Rejected: a second face
  with no new power is a novelty.
- **Advanced fields in the Profile Form behind a toggle.** Rejected: the Form
  was just redesigned to collapse nothing (#124); a hidden section is what it
  replaced.

## Consequences

- Any new core knob gets a home without a UI decision: add it to Advanced
  Settings, it appears in JSON Mode.
- JSON Mode needs a schema validator of its own; the Form's per-field controls
  no longer guarantee well-typed data. The validator is hand-written, no
  library.
- A Profile Link cannot express Advanced Settings; two devices sharing a link
  may run with different MTU or kill-switch values. Revisit if anyone asks.
