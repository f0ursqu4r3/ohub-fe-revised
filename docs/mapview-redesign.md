# MapView Redesign Plan

## Problem Statement

The current MapView has UI elements scattered across 5+ fixed positions around the screen edges with no cohesive information hierarchy. Users must hunt around the viewport for different functions. The time scrubber is narrow and tucked away, playback is hidden behind a layer toggle, provider filtering has no UI surface, and there's no detail panel for drilling into outages.

## Current Layout

```
 ┌─────────────────────────────────────────────────────────┐
 │  [SearchBar·····················]   [Report] [Analytics] [API] │
 │  [Loading / Error / Empty status]                              │
 │                                                                │
 │ ┌──────┐                                        ┌──┐          │
 │ │Time  │          MAP                           │Ctl│          │
 │ │Scrub │                                        │   │          │
 │ │      │                                        └──┘          │
 │ └──────┘                                                      │
 │                                                  ┌─────┐      │
 │  [Live Data]        [◄ ▶ ► 1x]                  │Mini │      │
 │                                                  │map  │      │
 └─────────────────────────────────────────────────────────┘
```

### Issues

- Controls in 6+ different locations — no visual grouping
- Time scrubber is vertical and narrow (hard to interact with)
- Playback controls hidden behind a layer toggle in MapControls
- Provider filtering exists in the store but has zero UI
- Marker popups (Leaflet native) are cramped — no room for rich outage detail
- Status indicators overlap with the search bar at top-center
- Nav links (Analytics, API) are loose buttons floating in the corner

---

## Redesigned Layout

```
 ┌──────────────────────────────────────────────────────────┐
 │ ┌─ Top Bar ───────────────────────────────────────────┐  │
 │ │ [Logo/Home]  [Search···············]  [Report] [≡]  │  │
 │ └─────────────────────────────────────────────────────┘  │
 │                                                          │
 │                                              ┌──┐       │
 │              MAP (full viewport)              │Ctl│      │
 │                                              │   │      │
 │                                              └──┘       │
 │                                                          │
 │                                              ┌─────┐    │
 │  [Live Data]                                 │Mini │    │
 │                                              │map  │    │
 │ ┌─ Bottom Timeline Bar ─────────────────────┐└─────┘    │
 │ │ [◄] [▶] [►] [1x]  ════════════════ 12:30  │          │
 │ │ Provider: [All ▾]  ▁▂▃▅▇▅▃▂▁▂▃▅▇▅▃  142  │          │
 │ └────────────────────────────────────────────┘          │
 └──────────────────────────────────────────────────────────┘

 On marker click → Right Detail Panel slides in:
 ┌──────────────────────────────────────────────────────────┐
 │                                         ┌────────────┐  │
 │              MAP                        │ Outage      │  │
 │                                         │ Detail      │  │
 │                                         │ Panel       │  │
 │                                         │             │  │
 │                                         └────────────┘  │
 │ ┌─ Bottom Timeline Bar ─────────────────────┐           │
 │ └────────────────────────────────────────────┘           │
 └──────────────────────────────────────────────────────────┘
```

---

## Components to Build / Modify

### 1. Top Bar (`MapTopBar.vue`) — NEW

A slim, fixed top bar replacing the scattered top-right buttons and floating search bar.

- **Left**: App logo / home link
- **Center**: Search input (reuse Nominatim logic from `FloatingSearchBar.vue`)
- **Right**: "Report Outage" CTA button, hamburger/overflow menu (Analytics, API links, dark mode toggle)
- Status indicators (loading, error, empty) render as inline badges within the bar

### 2. Bottom Timeline Bar (`TimelineBar.vue`) — NEW (replaces `VerticalTimeScrubber.vue`)

Horizontal bar pinned to the bottom of the viewport. Natural left-to-right time metaphor.

- **Left section**: Playback controls (step back, play/pause, step forward, speed) — always visible, no toggle needed
- **Center section**: Horizontal time scrubber with histogram sparkline, draggable handle, tick marks
- **Right section**: Selected time display, event count
- **Below playback controls**: Provider filter dropdown (`USelect` or `USelectMenu`)
- Collapsible (click to minimize to a thin strip showing just the selected time)

### 3. Detail Panel (`OutageDetailPanel.vue`) — NEW

A slide-in right sidebar triggered when a user clicks a marker/cluster on the map.

- Replaces Leaflet popup for richer interaction
- Shows: provider name, outage start/end, duration, affected area (with "zoom to" button), customer count
- For clusters: lists all outages in the cluster with sort/filter
- Close button returns to map-only view
- Transition: slides in from right, pushes or overlays the map

### 4. MapView.vue — MODIFY

- Remove: top-right nav buttons, `FloatingSearchBar` usage, inline loading/error/empty indicators, playback controls template & logic
- Add: `MapTopBar`, `TimelineBar`, `OutageDetailPanel`
- Move playback state management into `TimelineBar` or a `usePlayback` composable
- Wire marker click events to open the detail panel instead of Leaflet popups

### 5. MapComp.vue — MODIFY

- Remove or simplify popup rendering logic (detail panel replaces popups)
- Emit marker click events up to parent instead of opening popups
- Keep: layer rendering, zoom events, minimap, tile management
- The `showPlaybackControls` toggle becomes unnecessary (playback always in timeline bar)

### 6. MapControls.vue — MODIFY

- Remove: dark mode toggle (moves to top bar menu), playback toggle (no longer needed)
- Keep: zoom in/out, reset view, locate me, fullscreen, layer visibility popover
- Stays in its current right-center position

### 7. FloatingSearchBar.vue — DEPRECATE

- Search logic absorbed into `MapTopBar.vue`
- Nominatim composable can be extracted if not already (`useNominatimSearch`)

### 8. VerticalTimeScrubber.vue — DEPRECATE

- Replaced entirely by `TimelineBar.vue`
- Remove the `body.timeline-open` CSS class hack

---

## Execution Order

### Phase 1: Bottom Timeline Bar

1. Extract playback logic from `MapView.vue` into `usePlayback.ts` composable
2. Build `TimelineBar.vue` with horizontal scrubber, histogram, playback controls, provider filter
3. Wire into `MapView.vue`, remove `VerticalTimeScrubber` and inline playback template
4. Remove `body.timeline-open` class hack from scrubber and `MapComp.vue` styles

### Phase 2: Top Bar

1. Build `MapTopBar.vue` with search, report outage button, overflow menu
2. Extract Nominatim search logic into `useLocationSearch.ts` composable (if not already separated)
3. Wire into `MapView.vue`, remove `FloatingSearchBar` and top-right nav buttons
4. Move loading/error/empty state indicators into the top bar as inline badges

### Phase 3: Detail Panel

1. Build `OutageDetailPanel.vue` slide-in sidebar
2. Modify `MapComp.vue` to emit marker click events instead of opening popups
3. Wire panel open/close in `MapView.vue`
4. Remove popup mounting logic from `useMapLayers.ts` (or keep as fallback for embed view)

### Phase 4: Cleanup

1. Remove deprecated `FloatingSearchBar.vue` and `VerticalTimeScrubber.vue`
2. Clean up `MapControls.vue` (remove dark mode toggle, playback toggle)
3. Remove unused popup styles from `MapComp.vue`
4. Test all interactions end-to-end
