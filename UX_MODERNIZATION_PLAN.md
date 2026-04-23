# UX Modernization Plan

Last updated: `2026-04-21`
Project: `isp-entertainment-portal`
Status: `Foundation refresh in progress`

## Purpose

This plan replaces the older "Phase 1 completed" snapshot with the current live-audit roadmap so engineering work stays aligned with what users are actually feeling on `https://data.speed4you.net/portal/`.

## Current Live-Audit Priorities

The `2026-04-21` audit showed the product has a good visual base, but several high-impact foundation gaps still affect real-world UX:

1. Frontend delivery is heavier than it should be
   - main JS bundle is too large for slow/mobile networks
   - compression and cache strategy are not strong enough yet

2. API contract is inconsistent
   - `/portal-api/api/content` should return a valid catalog response instead of a route miss

3. Security hardening needs to be tighter
   - wildcard CORS is too open for a private portal deployment

4. Data quality still hurts polish
   - TV channel naming and similar metadata issues reduce trust and searchability

5. TV playback depends on an internal upstream source
   - resilience, fallback, and operator visibility need improvement

## Execution Strategy

### Phase 1: Foundation Hardening
Status: `In progress`
Target window: `Week 1-2`

Scope:

- fix API consistency for content endpoints
- tighten CORS with environment-based allowlist control
- improve cache headers for static assets
- add compression-friendly delivery on the Node side
- reduce first-load JS weight through frontend chunking

Success criteria:

- `/portal-api/api/content` returns a stable JSON payload
- production origins are explicitly allowlisted
- hashed frontend assets ship with long-lived cache headers
- HTML stays revalidatable while assets become cacheable
- initial JS entry weight drops through route-level splitting

### Phase 2: Home Personalization + Search Upgrade
Status: `Planned`
Target window: `Week 3-4`

Scope:

- continue watching rail
- "because you watched" and local trending sections
- smarter search suggestions
- typo-tolerant and mixed Bangla/English query support
- stronger search empty/fallback states

### Phase 3: Playback Premium + TV Resilience
Status: `Planned`
Target window: `Week 5-8`

Scope:

- intro skip / next episode / resume continuity
- quality and subtitle/audio controls where available
- TV source fallback strategy
- operator diagnostics for upstream degradation
- channel data cleanup and naming normalization

### Phase 4: App Experience + Trust Layer
Status: `Planned`
Target window: `Week 9-12`

Scope:

- PWA installability and offline shell
- push notification groundwork
- unified skeletons, retries, and empty states
- stronger microcopy consistency
- family profile / kids mode groundwork

## Design Direction To Preserve

Future work should build on the portal's current cinematic direction instead of replacing it:

- bold hero with clear primary actions
- richer card states without noisy animation
- sticky navigation and stronger search affordance
- mobile-first controls with larger tap targets
- subtle motion only where it helps orientation

## Immediate Work Order

1. Ship foundation fixes first.
2. Re-verify build output and endpoint behavior.
3. Move to home personalization and search only after foundation gaps are closed.
4. Leave TV data cleanup and resilience as the next major backend/content track.

## Notes For Continuation

- Keep `/portal/` and `/portal-api` deployment assumptions intact.
- Centralize rules where possible so future modules inherit the same behavior.
- Prefer resilient fallback behavior over blank or brittle states when upstream content is imperfect.
