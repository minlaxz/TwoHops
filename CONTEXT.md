# TwoHops — domain glossary

## Language

**Setup Profile**:
One named, identified tunnel configuration: the user's Server Credentials, DNS Servers, Routing Mode, Local Rules, Remote Rules URL, plus the Imported Rules cache. The app keeps many; each is one document.
_Avoid_: setup config, settings, saved profile

**Profile List**:
Every Setup Profile the app remembers. May be empty on a fresh install.
_Avoid_: profiles array

**Selected Profile**:
The one Setup Profile that tunnel commands act on and the Dashboard shows. Can only change while the Display State is Stopped. Deleting it while Stopped selects another Profile, or none.
_Avoid_: active profile, current profile

**Server Credentials**:
The server identity and login used to start the tunnel: name, IP address, domain, login, password, protocol. Name is the native tunnel's profile identifier.
_Avoid_: server config

**DNS Servers**:
The list of DNS server addresses the tunnel uses. Part of the Setup Profile; the text field is only a display of the list.
_Avoid_: dns servers text

**Routing Rule**:
One domain, IP address, or CIDR that the tunnel excludes or includes, depending on the Routing Mode.

**Routing Mode**:
How the tunnel treats Routing Rules: `general` or `selective`.

**Local Rules**:
Routing Rules the user typed by hand. Always kept as the user wrote them.
_Avoid_: local routing rules text, rules text

**Remote Rules URL**:
An HTTP(S) address from which Routing Rules can be imported.

**Imported Rules**:
The Routing Rules last fetched from the Remote Rules URL, cached in the Setup Profile with the time of import. Derived data — never edited by hand; a failed import keeps the previous Imported Rules.
_Avoid_: remote rules, merged rules

**Effective Rules**:
Local Rules merged with Imported Rules, deduplicated, local first. Derived on demand from the Setup Profile; never stored.
_Avoid_: merged rules text, rules text

**Profile Link**:
A `twohops:` URL that carries Server Credentials, DNS Servers and a Remote Rules URL. Applying one creates a new Setup Profile without any network access; it never overwrites an existing Profile.
_Avoid_: auto fill, import URL

**Profile Completeness**:
Whether the Setup Profile has every field needed to start the tunnel: name, IP address, domain, login, password. Expressed as the list of missing fields.
_Avoid_: is profile complete (boolean only)

**Tunnel Start Input**:
The value handed to the native tunnel, derived from the Setup Profile: Server Credentials, DNS Servers, Routing Mode and Effective Rules. Distinct from Profile Completeness — a profile can be complete yet unable to start.

**Tunnel Session**:
The one long-lived object that owns the tunnel's lifecycle: its current Session State, the last Session Error, and the connect / disconnect commands. Exists always; "disconnected" is one of its states, not its absence. Takes a Tunnel Start Input; knows nothing about the Setup Profile.
_Avoid_: vpn client, vpn session, vpn manager

**Session State**:
Where the Tunnel Session is right now: `disconnected`, `connecting`, `connected`, `disconnecting`, `waitingForRecovery`, `recovering`, `waitingForNetwork`. All but `disconnecting` are reported by the native tunnel; `disconnecting` is session-owned. The native tunnel is the source of truth — an optimistic state only bridges the gap until the native tunnel confirms.
_Avoid_: vpn state, manager state, connection status

**Session Error**:
The reason the last command did not end where it was expected to (for example the native tunnel never confirmed a start). Kept beside the Session State, never encoded as a state. Cleared by the next command.
_Avoid_: error state

**Reconciliation**:
The window after a connect or disconnect command during which the Tunnel Session re-reads the native tunnel until the state settles. A command is in flight until Reconciliation ends; a second connect during that window is ignored, a disconnect during it cancels.
_Avoid_: state probe, sync

**Display State**:
The UI-facing collapse of Session State into three values: Stopped (`disconnected`), Busy (`connecting`, `disconnecting`), Running (`connected` and the recovery states, which add a detail label such as "Reconnecting…"). The play/stop control and profile-switch lock follow the Display State, never a raw Session State.
_Avoid_: ui state, simple state

**Traffic Logs**:
The per-connection query rows the native tunnel emits (action, protocol, domain, addresses, time). Collected globally from tunnel start into a capped buffer, independent of which screen is open. Deliberately outside the Tunnel Session.
_Avoid_: query log (in UI copy), connection log

**Core Version**:
The version of the TrustTunnel core library bundled in the build. A build-time fact — the Android Gradle pin is the source of truth; iOS bundles no core today.
_Avoid_: native version, sdk version

**Debug Logs**:
App-side narration of lifecycle events (commands sent, state changes, profile edits). In-memory only; gone on app restart.
_Avoid_: ui debug logs, app logs
