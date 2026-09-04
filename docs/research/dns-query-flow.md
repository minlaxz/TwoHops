# How a DNS query flows through TwoHops (research, 2026-09-03)

Question: "Device -> DNS (say 1.1.1.1) -> query returns e.g. 1.2.3.1 -> decide Tunnel or Bypass. Is that correct?"

Scope: TwoHops `main` at 3029324 (`android/app/build.gradle:144` pins
`com.adguard.trusttunnel:trusttunnel-client-android:1.1.3`), upstream
[TrustTunnel/TrustTunnelClient](https://github.com/TrustTunnel/TrustTunnelClient) checked out at
`/Users/minlatt/development/TrustTunnelClient` (tag `v1.1.4`, the Android adapter matches 1.1.3, see
`bypass-block-detection.md`), and the Android `VpnService` reference. Every claim cites a file:line
or URL; nothing comes from secondary write-ups.

## 1. TL;DR verdict: partly correct, but the order is backwards

- **The DNS query is itself a routed connection, and it is routed by the _domain name_, before any
  IP exists.** The core intercepts every UDP/TCP packet to port 53 on the TUN and matches the
  question name (qname) against the rules to pick which resolver answers it.
- **The tunnel/bypass decision for the real connection is made per connection, from three signals
  in this order:** (1) rule match on the destination IP/CIDR, (2) "this IP came back in a DNS answer
  for an excluded domain" (a hint seeded by the DNS step), (3) the hostname sniffed from the first
  packet (TLS SNI / HTTP Host / QUIC). The resolved IP alone decides only when the rule _is_ an IP or
  CIDR.
- **The device never talks to 1.1.1.1 directly.** When the Profile lists DNS Servers, Android is
  told the VPN's DNS server is the fake address `198.18.53.53`; the core answers as that address and
  forwards to the Profile's resolvers through the VPN endpoint (or to the system resolvers,
  direct) depending on the qname.

Corrected sequence (general mode, Profile with DNS Servers set, rule `example.com`):

```
app          Android stub resolver        TUN / TrustTunnel core                 network
 |  getaddrinfo("example.com")  |                                                  |
 |----------------------------->|  UDP 198.18.53.53:53  qname=example.com          |
 |                              |------------------------------------------------->| core DnsHandler
 |                              |   match_domain(qname): EXCLUSION -> "not included"|
 |                              |   -> system DNS proxy (device resolvers, DIRECT)  |--> ISP resolver
 |                              |   answer A 1.2.3.1; name is excluded ->           |
 |                              |   add_exclusion_suspect(1.2.3.1, ttl)             |
 |<-----------------------------|<--------------------------------------------------|
 |  TCP connect 1.2.3.1:443     |                                                  |
 |----------------------------->|  match_tag(1.2.3.1): not a rule IP, but SUSPECT   |
 |                              |  -> attach to fake upstream, read first packet    |
 |                              |  -> SNI = example.com -> match_domain: EXCLUSION   |
 |                              |  -> action inverted: BYPASS; cache 1.2.3.1->name  |
 |                              |  -> connect DIRECT; ConnectionInfo{bypass,domain} |--> 1.2.3.1
```

For a non-rule domain (`facebook.com`) the qname is "included": the query goes to the Profile's
resolver _through the tunnel_, no suspect is recorded, and the later TCP connect takes the mode's
default (general: TUNNEL) unless the sniffed SNI later matches a rule.

## 2. Step-by-step, with code

### 2.1 What TwoHops hands to the core

- `tunnelStartInput` copies the Profile's DNS Servers, Routing Mode and Effective Rules into the
  start input (`src/services/setupProfile.ts:309-323`).
- `encodeConfig` writes them as `vpn_mode`, `exclusions` and `dns_upstreams` in the TOML config
  (`src/services/configEncoder.ts:20-28`). `expandRules` emits each domain rule twice, `example.com`
  and `*.example.com`; IPs/CIDRs pass through untouched (`src/services/routingRules.ts:38-58`).
- Upstream semantics: `vpn_mode` general = "route all except exclusions", selective = "route only
  exclusions"; `exclusions` accept domain, `*.` wildcard, IP[:port], CIDR
  (`trusttunnel/README.md:103-108, 143-152`; `core/include/vpn/vpn.h:390-393, 414-417`).
- Native side just passes the string to the AAR (`android/app/src/main/java/com/nativetrusttunnel/NativeTrustTunnelModule.kt:50-63, 101-103`).

### 2.2 What the Android VpnService is told (DNS server + routes)

`platform/android/lib/src/main/java/com/adguard/trusttunnel/VpnService.kt`:

- `createTunInterface` builds `Builder().addAddress("172.20.2.13",32).addAddress("fdfd:29::2",64)`
  (lines 222-225).
- **DNS server:** if `dns_upstreams` is empty it calls `addDnsServer` for AdGuard's public resolvers
  (`46.243.231.30/31`, `2a10:50c0::…`); otherwise it adds the single fake server `198.18.53.53`
  (lines 42-43, 227-233). Per Android, `addDnsServer` "Add[s] a DNS server to the VPN connection"
  and "If none is set, the DNS servers of the default network will be used"
  (https://developer.android.com/reference/android/net/VpnService.Builder#addDnsServer(java.net.InetAddress)).
- **Routes:** `included_routes` minus `excluded_routes` minus `0.0.0.0/8, 224.0.0.0/3` become
  `addRoute` calls (lines 41, 236-244). TwoHops sends `0.0.0.0/0, 2000::/3` included and the LAN
  ranges excluded (`src/services/configEncoder.ts:4-13, 46-49`), so everything non-LAN, including
  the DNS packets, enters the TUN.

So the OS routes the stub resolver's query for `198.18.53.53:53` (or AdGuard's IP) into the TUN.
There is no per-app "resolve then route" step in Android; the VPN owns the DNS server address.

### 2.3 Interception on the TUN: port 53 goes to the DNS handler

- Every new connection whose destination port is 53 is flagged `CONNF_PLAIN_DNS_CONNECTION`
  (`core/src/vpn_connection.cpp:34`).
- Such connections are attached to the in-process `DnsHandler` instead of a network upstream
  (`core/src/tunnel.cpp:917-918`); `report_connection_info` skips them, so they never appear in the
  Logs screen (`core/src/tunnel.cpp:485-491`).
- `vpn.h` documents the intent: "If configured, the library will intercept and route plain DNS
  queries to the DNS resolvers" (`core/include/vpn/vpn.h:125-136`).

### 2.4 Routing the query by qname (`core/src/dns_handler.cpp:859-907`)

1. If the endpoint is not connected: with kill switch off, forward to the system DNS proxy; with
   kill switch on (TwoHops sets `killswitch_enabled = true`, `configEncoder.ts:24`), only the
   VPN server's own hostname is allowed, everything else is dropped (lines 879-892).
2. `status = match_domain(qname)`; `included = general ? status==DEFAULT : status==EXCLUSION`
   (lines 894-896). "Included" means "this name's traffic will go through the tunnel".
3. Included and user resolvers configured -> **user DNS proxy** (line 898-900). That proxy is an
   embedded AdGuard dnsproxy whose outbound goes through a local SOCKS listener
   (`dns_handler.cpp:597-650`, `dns_proxy_accessor.cpp:71-77`); connections from that listener are
   forced `VPN_CA_FORCE_REDIRECT`, i.e. **through the VPN endpoint** (`tunnel.cpp:1559-1561`).
   This matches the README: `dns_upstreams` are "DNS resolvers for queries routed through VPN"
   (`trusttunnel/README.md:108`).
4. Not included -> **system DNS proxy** (lines 901-903): a second dnsproxy built from the device's
   own resolvers, without the SOCKS outbound and bound to the underlying interface, so it goes
   **direct** (`dns_handler.cpp:652-663, 709-724`; `dns_proxy_accessor.cpp:28, 48-55, 71-79`).
5. Included but no user resolvers (Profile DNS Servers empty) -> re-injected as an ordinary
   connection to the original destination (AdGuard's IP:53), which is forced through the tunnel
   (`dns_handler.cpp:904-906`, `tunnel.cpp:914-915`).

### 2.5 The answer seeds the IP-side decision

`on_dns_response` (`dns_handler.cpp:910-935`): if any name in the reply matches an exclusion, every
A/AAAA address in it is stored as an **exclusion suspect** with the record TTL
(`domain_filter.cpp:197`). It also strips ECH config from HTTPS records so the SNI stays sniffable.
The reply is then returned to the app unchanged otherwise.

### 2.6 The real connection: IP rule -> cache -> suspect -> SNI

When the app opens TCP/UDP to the resolved IP, `finalize_connect_action` runs
(`core/src/tunnel.cpp:1021-1062`) using `DomainFilter::match_tag` (`core/src/domain_filter.cpp:160-188`):

| Check (in order)                                        | Result                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| dst IP[:port] or CIDR is a rule                         | EXCLUSION: action inverted from the mode default                      |
| IP previously mapped to a domain by SNI sniff           | `match_domain(cached name)`                                           |
| IP is a DNS-seeded suspect and port is 443/80/8080/8008 | `CONNF_SUSPECT_EXCLUSION` (`tunnel.cpp:388-393`)                      |
| none                                                    | mode default: general=TUNNEL, selective=BYPASS (`tunnel.cpp:467-483`) |

Suspect connections are parked on a fake upstream while the first bytes are read
(`tunnel.cpp:921-926`); the domain extractor pulls SNI / Host / QUIC SNI
(`pass_through_domain_lookup`, `tunnel.cpp:344-380`). On a hit that is an exclusion the action is
inverted and the connection migrates to the other upstream (`tunnel.cpp:1662-1716`); the IP->domain
pair is cached for next time (`tunnel.cpp:373`). Non-suspect connections also get sniffed
(`tunnel.cpp:1297-1298`) but can only switch upstream on their very first packet
(`tunnel.cpp:1705-1708`, "Can't switch upstream in the middle of handshake").

The final action and sniffed domain are what TwoHops shows per row in Logs
(`ConnectionInfo::to_json`, `trusttunnel/src/connection_info.cpp:9-36`;
`NativeTrustTunnelModule.kt:119-120`; `src/services/vpn.ts:38-41`).

### 2.7 How "Add bypass rule" from Logs maps onto this

`addRule` appends the registrable domain to Local Rules (`src/screens/LogsScreen.tsx:310-317`,
`src/services/setupProfile.ts:259`). Nothing changes until reconnect, because
`updateConfiguration` is a no-op on Android (comment at `LogsScreen.tsx:316`). After reconnect the
rule is a _domain_ exclusion: it steers the DNS query (2.4), seeds suspects (2.5) and matches SNI
(2.6). It never becomes an IP route; the Android routing table is unchanged.

## 3. Where the user's model goes wrong, point by point

1. "Device -> 1.1.1.1": the device sends to the VPN-assigned DNS address inside the TUN; the core
   decides _which_ resolver sees the query, by qname. 1.1.1.1 is only reached if it is in the
   Profile's DNS Servers, and then through the tunnel.
2. "Query returns 1.2.3.1 -> decide": the decision is not "look up the IP in a table". Domain rules
   are matched on names (qname, then SNI). The IP only matters for IP/CIDR rules and as a TTL-bound
   hint that a hostname check is worth doing.
3. Order: for a rule domain the _DNS query itself_ is already bypassed (or tunneled, in selective
   mode) before the app ever sees an IP. "Resolve, then decide" is true only of the data connection,
   and even there the final say is the sniffed hostname.

## 4. Open questions (not confirmed from primary sources)

- Whether dnslibs' outbound sockets for the _system_ DNS proxy are also `VpnService.protect`ed on
  Android, or rely solely on the `outbound_interface` binding seen in `dns_proxy_accessor.cpp:28,53`.
  Either way they bypass the TUN; the mechanism was not traced into the dnslibs dependency.
- Behaviour for DNS-over-TLS/HTTPS clients on the device (Android Private DNS): those flows are
  not port 53 and so are not intercepted; how Android treats Private DNS while a VPN sets
  `addDnsServer` was not verified against Android source.
- The DNS answer for a _non-rule_ domain (included) does not seed suspects; a later SNI hit on such
  a connection can still flip it, but only on the first packet. Whether QUIC (UDP 443) retries make
  that reliable in practice was not tested on a device.
