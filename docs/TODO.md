# Map Improvements TODO

Tracking enhancements for the map component.

---

## Code Audit (January 2026)

### 🔴 Critical Issues

- [x] **Split MapComp.vue (1722 lines)** - Extract into composables and sub-components:
  - [x] `useMapLayers.ts` - marker/polygon/heatmap logic
  - [x] `useMapControls.ts` - zoom, fullscreen, location
  - [x] `useMinimap.ts` - minimap setup
  - [x] `MapControls.vue` - control buttons component
  - [x] Move CSS to external file or use Tailwind more

- [x] **Move `computeBoundsAndArea` to utils.ts** - Duplicate geometry logic in HomeView.vue should be centralized

- [x] **Fix cluster cache key performance** - Current keys are huge strings of all outage data

  ```typescript
  // Change from full outage data to just IDs:
  const makeClusterCacheKey = (outages: Outage[], radiusPx: number): string =>
    `${radiusPx}:${ids.length}:${ids.join(',')}`
  ```

---

### 🟡 Performance Improvements

- [ ] **Lazy popup data computation** - Don't pre-compute `buildPopupData` for all markers in computed property; compute on popup open instead

- [ ] **Remove deep watchers on large arrays** - Replace `{ deep: true }` watchers on markers/polygons with shallow comparison or manual triggers

- [ ] **Cache parsed WKT polygons** - `wktToGeoJSON` is called repeatedly; add memoization with WeakMap

- [ ] **Consider CircleMarkers for large datasets** - DivIcon HTML is heavy for hundreds of markers

---

### 🟡 Code Quality

- [ ] **Remove `any` type assertions** - Add proper type augmentation for Leaflet instead of `eslint-disable` comments

- [ ] **Extract magic numbers to config** - Constants like `MAX_ROWS = 6`, `POLYGON_VISIBLE_ZOOM = 5`, playback interval `500ms`

- [ ] **Audit unused code**:
  - [ ] Check if `minimumEnclosingCircle` (~150 lines in utils.ts) is used
  - [ ] Check if `HorizontalTimeScrubber.vue` is used (only Vertical is imported)

- [ ] **Improve error handling** - Many catch blocks silently swallow errors; log in dev mode at minimum

---

### 🟢 Bundle Size

- [ ] **Lazy-load leaflet.heat** - Heatmap is off by default; dynamic import when enabled

  ```typescript
  const loadHeatmap = () => import('leaflet.heat')
  ```

- [ ] **Tree-shake Leaflet** - Import specific modules instead of entire library if needed

---

### Quick Wins

- [ ] Remove `HorizontalTimeScrubber.vue` if unused
- [x] Extract ~600 lines of CSS from MapComp.vue to separate file
- [x] Consolidate geometry utils in one place
- [x] Simplify cluster cache key string generation

---

### Priority Order

| Priority | Task                               | Impact          |
| -------- | ---------------------------------- | --------------- |
| 🔴 High   | Split MapComp.vue into composables | Maintainability |
| 🔴 High   | Fix cluster cache key performance  | Memory/CPU      |
| 🟡 Medium | Lazy popup data computation        | CPU             |
| 🟡 Medium | Remove deep watchers               | CPU             |
| 🟢 Low    | Extract magic numbers              | Maintainability |
| 🟢 Low    | Remove unused code                 | Bundle size     |
| 🟢 Low    | Extract magic numbers              | Maintainability |
| 🟢 Low    | Remove unused code                 | Bundle size     |
