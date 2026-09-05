# TwoHops — domain glossary

## Language

**Setup Profile**:
One named, identified tunnel configuration: the user's Server Credentials, Tunnel DNS Servers, Bypass DNS Source, Bypass DNS Servers, Bypass DNS Route, Routing Mode, Local Rules, Remote Rules URL, plus the Imported Rules cache. The app keeps many; each is one document.
_Avoid_: setup config, settings, saved profile

**Profile List**:
Every Setup Profile the app remembers. May be empty on a fresh install.
_Avoid_: profiles array

**Selected Profile**:
The one Setup Profile that tunnel commands act on and the Dashboard shows. The Dashboard shows only this Profile (name, domain, protocol) with its Edit and Share actions; the rest of the Profile List lives behind the Profile Picker. Can only change or be edited while the Display State is Stopped; otherwise the Edit tap is refused with a Toast. Share is never locked. Deleting it while Stopped selects another Profile, or none.
_Avoid_: active profile, current profile

**Profile Picker**:
The sheet opened by tapping the Selected Profile on the Dashboard, listing every Profile in the Profile List with the Selected Profile marked. Choosing a row changes the Selected Profile. Opens only while the Display State is Stopped; otherwise the tap is refused with a Toast. Adding a Profile is not done from the Picker.
_Avoid_: profile dropdown, profile menu, switcher

**Server Credentials**:
The server identity and login used to start the tunnel: name, server address (IP address or hostname, with an optional port; 443 when absent), domain, login, password, protocol. The address and its port are one value; the profile screen shows them as two boxes. Name is the Profile's one and only name: what the Profile List, Dashboard and Profile Picker show, and the label the native tunnel is started with. It plays no part in the connection itself. There is no separate display name.
_Avoid_: server config

**Tunnel DNS Servers**:
The list of resolvers the tunnel uses for Tunnel-side Queries. Reached through the tunnel. Part of the Setup Profile; the profile screen shows one row per server, at most three added by hand, more only when a Profile Link or an older profile brought them. Empty means the core's own default resolvers.
_Avoid_: DNS Servers (unqualified), dns servers text, dns upstreams (in UI copy)

**Bypass DNS Source**:
Where the Bypass DNS Servers come from: `same-as-tunnel` (the Bypass DNS Servers are the Tunnel DNS Servers, whatever they are at the time; the default for a new Setup Profile) or `custom` (a list the user typed; what every Setup Profile stored before this choice existed has). Part of the Setup Profile; a Profile Link that carries no Bypass DNS Servers leaves it unchanged, one that does makes it `custom`.
_Avoid_: same as above (in code), inherit dns, dns mirror

**Bypass DNS Servers**:
The list of resolvers the tunnel uses for Bypass-side Queries. Decided by the Bypass DNS Source: a copy of the Tunnel DNS Servers, or the user's own list (same row limits as Tunnel DNS Servers). Empty — an empty Tunnel DNS Servers under `same-as-tunnel`, or nothing typed under `custom` — means the device's system resolvers, as before this list existed, and hides the Bypass DNS Route control. Not part of Profile Completeness.
_Avoid_: direct DNS, system DNS override

**Bypass DNS Route**:
Which network a Bypass-side Query travels on to reach the Bypass DNS Servers: `tunnel` (through the tunnel; the default for a new Setup Profile, so no resolver is exposed to the local network) or `direct` (the device's own network; what every Setup Profile stored before the default changed has). Choosing `direct` shows a persistent note that the resolver can be exposed. Only the query changes path; the connection to the answer still goes direct. Meaningless while Bypass DNS Servers is empty.
_Avoid_: dns via tunnel, dns detour
Paths and leak notes: `docs/dns-resolution-paths.md`.

**Tunnel-side Query**:
A DNS query whose name the Effective Rules and Routing Mode place inside the tunnel. Answered by the Tunnel DNS Servers. The connection that follows goes through the tunnel.
_Avoid_: included query, routed query

**Bypass-side Query**:
A DNS query whose name the Effective Rules and Routing Mode place outside the tunnel. Answered by the Bypass DNS Servers. The connection that follows goes direct.
_Avoid_: excluded query, direct query

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
A `twohops:` URL that carries Server Credentials (except the server name), Tunnel DNS Servers, Bypass DNS Servers (present only under a `custom` Bypass DNS Source), Bypass DNS Route and a Remote Rules URL. Applying one fills profile fields without any network access; it never overwrites a stored Profile — on the profile screen it patches the Profile Draft in place, defaulting the missing server name from the domain. A link that parses is *applied*; the Profile Draft it produced may still be incomplete.
_Avoid_: auto fill, import URL

**Share Profile**:
Handing the Selected Profile to another device as a Profile Link through the OS share sheet. The link carries exactly what a Profile Link carries — including the password in clear — and nothing more; the user's choice of recipient is the only safeguard. Available whenever there is a Selected Profile, whatever its Profile Completeness; empty fields are left out of the link.
_Avoid_: export profile, copy config

**Profile Draft**:
The in-memory Setup Profile being created or edited on the profile screen. Not part of the Profile List and never persisted until Save is pressed; navigating away (header or Android back — there is no Cancel control, #71) discards it, after a discard confirmation when it has been touched. A new Draft starts blank — no generated name.
_Avoid_: unsaved profile, pending profile, temp profile

**Link Mode**:
The profile screen as opened by "Paste profile link": only the Profile Link input, the outcome of applying it (parse failure, or the Profile Draft's missing fields), Save when the applied Draft is complete, and Modify. Modify switches the same screen to the Profile Form with the Draft kept. "New profile" and Edit never enter Link Mode.
_Avoid_: link screen, import mode

**Profile Form**:
The profile screen's full editor: the profile name on top, then four groups — Server (address and port, TLS domain, protocol), User (login, password), DNS (Tunnel DNS Servers, Bypass DNS Source and Servers, Bypass DNS Route), Routing (Remote Rules URL, Import, Local Rules, Effective Rules summary, Routing Mode). Nothing collapses. Save is always shown and disabled until the Draft is complete, with the missing fields listed beside it; Delete stays outside the groups for a stored Profile.
_Avoid_: advanced settings, advanced section

**Profile Completeness**:
Whether the Setup Profile has every field needed to start the tunnel: name, server address, domain, login, password, and a port (when given) between 1 and 65535. Expressed as the list of missing or out-of-range fields. Save requires a complete Profile Draft (for a stored Profile, Save additionally requires a touched Draft — touched-flag semantics, not value-diff, #71), so only Profiles stored before that rule can be incomplete — connecting refuses them. The connect control stays visible for an incomplete legacy profile (superseding the hide-when-incomplete rule from #40): with no Dashboard hint left to explain a hidden control, the connect-refusal alert is the only guard.
_Avoid_: is profile complete (boolean only)

**Tunnel Start Input**:
The value handed to the native tunnel, derived from the Setup Profile: Server Credentials, Tunnel DNS Servers, Bypass DNS Servers, Bypass DNS Route, Routing Mode and Effective Rules. Distinct from Profile Completeness — a profile can be complete yet unable to start.

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
The UI-facing collapse of Session State into three values: Stopped (`disconnected`), Busy (`connecting`, `disconnecting`), Running (`connected` and the recovery states, which add a detail label such as "Reconnecting…"). The play/stop control and the profile-switch and Edit locks follow the Display State, never a raw Session State. Never rendered as a status caption: the connect control's appearance carries the persistent state, Toasts announce transitions, and only the recovery detail label stays on screen while recovery lasts.
_Avoid_: ui state, simple state, status label

**Toast**:
A transient, self-dismissing notice announcing a state transition or a refused action ("Connected", "Stop the tunnel to switch profiles"). Global — any screen can raise one. Not for persistent state: anything the user must still know a minute later belongs elsewhere.
_Avoid_: snackbar, inline notice, hint

**Direct Probe**:
An on-demand `HEAD https://<domain>` from the app, started from a bypassed Traffic Log row, to learn whether the domain answers when reached direct. Any HTTP status is "works"; reset, DNS failure or a 5 s timeout is "failed" and offers the Local Rule. A row shows one control at a time: the probe, then only on failure the offer; "works" leaves a verdict and no control. Never runs automatically: the core gives no failure signal for bypass connections, so this is the only detection that does not guess. DPI that serves a fake page passes as "works".
_Avoid_: connectivity check, ping, health check

**Traffic Logs**:
The per-connection query rows the native tunnel emits (action, protocol, domain, addresses, time). Collected globally from tunnel start into a capped buffer, independent of which screen is open. Deliberately outside the Tunnel Session. Cleared on each connect command and by hand from the Logs screen; the recovery states never clear them.
_Avoid_: query log (in UI copy), connection log

**Traffic Logging**:
Whether Traffic Logs are being captured. A persisted app setting, off by default, switched from the Settings screen. Off stops capture and hides the traffic tab on the Logs screen; already-captured rows are kept, not cleared.
_Avoid_: traffic debug, traffic debug mode

**Debug Logging**:
Whether Debug Logs are being captured. A persisted app setting, off by default, switched from the Settings screen. Off stops capture and hides the debug tab on the Logs screen; already-captured rows are kept, not cleared.
_Avoid_: ui debug, debug mode

**Core Version**:
The version of the TrustTunnel core library bundled in the build. A build-time fact — the Android Gradle pin is the source of truth; iOS bundles no core today.
_Avoid_: native version, sdk version

**Debug Logs**:
App-side narration of lifecycle events (commands sent, state changes, profile edits). In-memory only; gone on app restart. Cleared on each connect command and by hand from the Logs screen; the recovery states never clear them.
_Avoid_: ui debug logs, app logs

**Installed Version**:
The release version the running build was made from. A build-time fact; the build number beside it is a date stamp, not part of the version. Every release bumps the version — a version is never rebuilt.
_Avoid_: app version (in code), current version

**Latest Release**:
The newest published, non-prerelease GitHub release of the app: its version and its release page. Android is the only platform it ships for.
_Avoid_: latest tag, remote version

**Update Check**:
One attempt to learn the Latest Release. Runs once per app launch on its own and again whenever the user asks from the Settings screen. Its outcome is persistent state shown on the Settings screen, never a Toast; only a user-requested attempt announces its failure with a Toast. A second attempt while one is in flight is ignored.
_Avoid_: version check, update poll

**Available Update**:
A Latest Release whose version is greater than the Installed Version. Derived from the last successful Update Check, never stored; a failed Update Check keeps the previous answer. Signalled by a dot on the Settings tab and a row in Settings that opens the release page. Stays until the Installed Version catches up.
_Avoid_: new version flag, update pending
