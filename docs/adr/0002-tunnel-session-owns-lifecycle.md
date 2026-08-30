---
status: accepted
---

# Tunnel Session owns the tunnel lifecycle

The JS VPN wrapper was a pass-through to the native module; every behaviour that made it usable — optimistic `connecting`, an in-flight guard, a 300/900/1800 ms probe loop that compensates for Android `start()` resolving before the VPN permission dialog completes, and a debug log — lived in the Dashboard screen, so a second consumer would have to copy it. We now put that behaviour in one Tunnel Session module: a state machine over an injected native port (`start`, `stop`, `getCurrentState`, `onState`) exposing `subscribe`/`getSnapshot`, `connect(input)`/`disconnect()`, and `onDebug`. The native tunnel is the source of truth; optimistic states only bridge until Reconciliation settles. A command is in flight until Reconciliation ends, not until the native promise resolves.

## Considered Options

- Keep pass-through, extract a Dashboard hook — rejected: still React-bound, still untestable without a renderer, still one-consumer-shaped.
- Adopt a store library (zustand/redux) — rejected: the repo's house pattern is pure module + injected port + thin context; one state machine does not justify a dependency.
- Session-level 4-state model collapsing native recovery states into `connected` — rejected: `waitingForRecovery`/`recovering`/`waitingForNetwork` are real user-facing conditions from TrustTunnel; hiding them loses information for no gain.
- Reject a second `connect()` while in flight — rejected: forces every consumer to handle an error for a no-op; ignoring is simpler and equally safe.
- Timeout `connecting` after the last probe — rejected: if native still says `connecting` it is honest to wait for the event; only a native `disconnected` at the last probe is a failed start.

## Consequences

- Any consumer of tunnel state goes through the Tunnel Session; nothing reads the native module directly except the session's port.
- Session State is native's six states plus `disconnecting`; unknown native ordinals still collapse to `disconnected` but are logged via `onDebug`.
- Session takes a Tunnel Start Input and never reads the Setup Profile; the connecting→disconnected flicker on an incomplete profile disappears because the caller derives the input first.
- Probe delays are injectable so state-machine tests run against a fake port without real timers.
- On iOS (native stub reports `disconnected` and never emits) every connect ends `disconnected` with a Session Error — correct given native truth; no iOS special-casing.
- Query log stays outside the session (DebugScreen keeps subscribing directly). Dead `updateConfiguration` JS wrapper is removed.
