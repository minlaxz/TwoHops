# TwoHops — domain glossary

## Language

**Setup Profile**:
Everything the app remembers between launches: the user's Server Credentials, DNS Servers, Routing Mode, Local Rules, Remote Rules URL, plus the Imported Rules cache. One profile, one document.
_Avoid_: setup config, settings, saved profile

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
A `twohops:` URL that carries Server Credentials, DNS Servers and a Remote Rules URL. Applying one fills the Setup Profile without any network access.
_Avoid_: auto fill, import URL

**Profile Completeness**:
Whether the Setup Profile has every field needed to start the tunnel: name, IP address, domain, login, password. Expressed as the list of missing fields.
_Avoid_: is profile complete (boolean only)

**Tunnel Start Input**:
The value handed to the native tunnel, derived from the Setup Profile: Server Credentials, DNS Servers, Routing Mode and Effective Rules. Distinct from Profile Completeness — a profile can be complete yet unable to start.
