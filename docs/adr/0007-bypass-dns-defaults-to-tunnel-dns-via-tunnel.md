---
status: accepted
---

# Bypass DNS defaults to the Tunnel DNS Servers, reached through the tunnel

ADR 0006 gave the Setup Profile a second resolver list for Bypass-side
Queries and a Bypass DNS Route, both empty/`direct` by default, so a new
profile kept the core's original behaviour: bypass-side names resolved by
the device's system resolvers over the local network. That default leaks
every bypassed name to the local network, and in selective mode bypassed is
most traffic. It also made the DNS section the most-typed part of the profile
screen: the same resolver list entered twice.

A new Setup Profile now has a **Bypass DNS Source** of `same-as-tunnel` — the
Bypass DNS Servers *are* the Tunnel DNS Servers, whatever they are at start
time — and a Bypass DNS Route of `tunnel`. Every DNS query therefore leaves
the device through the tunnel by default; the local network sees none. The
user can switch the source to `custom` and type up to three resolvers, and
can switch the route to `direct`, which shows a persistent exposure note.

The source is stored as an explicit field. Profiles stored before this ADR
load as `custom` with whatever list they had and keep their `direct` route,
so nothing changes for them. The Profile Link format is unchanged: a link
omits `bypassDns` under `same-as-tunnel`, and a link without `bypassDns`
leaves the source at `same-as-tunnel`; a link with it lands as `custom`.

## Considered Options

- Keep `direct` + system resolvers as default — rejected: leaks bypassed names by default, and the user must type the list twice to avoid it.
- Sentinel: empty Bypass DNS Servers means "same as tunnel" — rejected: silently flips every existing profile from system resolvers to tunnel DNS, and removes the "empty = device resolvers" state that ADR 0006 promised.
- Copy button (snapshot the Tunnel list into the Bypass list once) — rejected: two lists drift the moment the user edits one; the user asked for follow-live semantics.
- Same-as-tunnel with empty Tunnel DNS resolving to the core's default resolvers through the tunnel — deferred: needs core support; today an empty copy means device resolvers, same as before.

## Consequences

- Bypass-side answers come from the tunnel-side resolver by default, so CDN/geo answers for bypassed domains may point far from the device. Accepted; `custom` + `direct` restores the old behaviour per profile.
- Tunnel Start Input resolves the source before handing the list to the core; the core never sees the flag.
- The Setup Profile document gains a field; the loader defaults it to `custom` when absent.
- The Bypass DNS Route control is shown whenever the resolved Bypass DNS Servers are non-empty, whichever source produced them.
