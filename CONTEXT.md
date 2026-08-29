# TwoHops — domain glossary

**Routing Rule** — one domain, IP address, or CIDR that the tunnel excludes or includes, depending on the **Routing Mode**. Rules come from the local text field and an optional remote rules URL; the merged, deduplicated list (local first) is what the tunnel config consumes. Owned by `src/services/routingRules.ts`.

**Routing Mode** — how the tunnel treats Routing Rules (`RoutingConfig.mode`).

**Setup Profile** — server credentials plus routing settings persisted between launches (`SetupConfigContext`).
