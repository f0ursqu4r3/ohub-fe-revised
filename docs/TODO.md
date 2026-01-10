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

- [x] **Lazy popup data computation** - Don't pre-compute `buildPopupData` for all markers in computed property; compute on popup open instead

- [x] **Remove deep watchers on large arrays** - Replace `{ deep: true }` watchers on markers/polygons with shallow comparison or manual triggers

- [x] **Cache parsed WKT polygons** - `wktToGeoJSON` is called repeatedly; add memoization with Map

- [x] **Consider CircleMarkers for large datasets** - DivIcon HTML is heavy for hundreds of markers (auto-switches when >150 markers)

---

### 🟡 Code Quality

- [x] **Remove `any` type assertions** - Add proper type augmentation for Leaflet instead of `eslint-disable` comments
  - Note: `any` retained for vue-use-leaflet interop (types don't match @types/leaflet), added JSDoc comments

- [x] **Extract magic numbers to config** - Constants like `MAX_ROWS = 6`, `POLYGON_VISIBLE_ZOOM = 5`, playback interval `500ms`
  - Created `/src/config/map.ts` with all map-related constants

- [x] **Audit unused code**:
  - [x] Removed `minimumEnclosingCircle` (~150 lines) and `Circle` type from utils.ts
  - [x] Removed `HorizontalTimeScrubber.vue` (was unused)

- [x] **Improve error handling** - Many catch blocks silently swallow errors; log in dev mode at minimum
  - Added `logDevError()` helper that logs in dev mode only

---

### 🟢 Bundle Size

- [ ] **Lazy-load leaflet.heat** - Heatmap is off by default; dynamic import when enabled

  ```typescript
  const loadHeatmap = () => import('leaflet.heat')
  ```

- [ ] **Tree-shake Leaflet** - Import specific modules instead of entire library if needed

---

### Quick Wins

- [x] Remove `HorizontalTimeScrubber.vue` if unused
- [x] Extract ~600 lines of CSS from MapComp.vue to separate file
- [x] Consolidate geometry utils in one place
- [x] Simplify cluster cache key string generation

---

### Priority Order

| Priority | Task                               | Impact          | Status |
| -------- | ---------------------------------- | --------------- | ------ |
| 🔴 High   | Split MapComp.vue into composables | Maintainability | ✅      |
| 🔴 High   | Fix cluster cache key performance  | Memory/CPU      | ✅      |
| 🟡 Medium | Lazy popup data computation        | CPU             | ✅      |
| 🟡 Medium | Remove deep watchers               | CPU             | ✅      |
| 🟡 Medium | Cache WKT polygons                 | CPU             | ✅      |
| 🟢 Low    | Extract magic numbers              | Maintainability | ✅      |
| 🟢 Low    | Remove unused code                 | Bundle size     | ✅      |
