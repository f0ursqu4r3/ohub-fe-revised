# Customer Outage Reporting — Implementation Plan

## Overview

Allow public users to report outages they're experiencing. Reports go to `POST /v1/outage-reports` (already built in backend). This is distinct from the provider portal — customer reports are lightweight, mostly anonymous, and unverified.

## Backend API (already implemented)

**Endpoint:** `POST /v1/outage-reports`

- Public (no auth required), optional Auth0 token attaches `reporterCustomerId`
- Rate-limited per IP
- Honeypot field `website` (hidden input, reject if filled)
- 64 KB JSON body limit

**Request body (`CreateUserOutageRequest`):**

| Field               | Type      | Required | Notes                                                |
| ------------------- | --------- | -------- | ---------------------------------------------------- |
| `latitude`          | `number`  | yes      | -90 to 90                                            |
| `longitude`         | `number`  | yes      | -180 to 180                                          |
| `provider`          | `string`  | no       | Must match a known provider from `GET /v1/providers` |
| `notes`             | `string`  | no       | Max 4000 chars                                       |
| `cause`             | `string`  | no       | Max 256 chars                                        |
| `isPlanned`         | `boolean` | no       |                                                      |
| `customerCount`     | `number`  | no       |                                                      |
| `observedTs`        | `number`  | no       | Unix timestamp, within +-30 days                     |
| `outageStartTs`     | `number`  | no       | Unix timestamp, within +-30 days                     |
| `locationAccuracyM` | `number`  | no       | Geolocation accuracy in meters                       |
| `addressText`       | `string`  | no       | Max 512 chars, reverse-geocoded or user-entered      |
| `contactEmail`      | `string`  | no       | Max 320 chars, basic format validation               |
| `raw`               | `object`  | no       | Arbitrary metadata                                   |
| `website`           | `string`  | no       | **Honeypot** — must be empty or absent               |

**Response:** `201 Created` → `{ id: number, status: string }`

**Error responses:** `400` (validation), `429` (rate limit), `500`

## Frontend Implementation

### Phase 1: Report Form + Submission

#### 1. Types — `src/types/userOutage.ts`

```ts
export interface CreateUserOutageRequest {
  latitude: number
  longitude: number
  provider?: string
  notes?: string
  cause?: string
  isPlanned?: boolean
  customerCount?: number
  observedTs?: number
  outageStartTs?: number
  locationAccuracyM?: number
  addressText?: string
  contactEmail?: string
  raw?: Record<string, unknown>
  website?: string // honeypot — always send empty
}

export interface CreateUserOutageResponse {
  id: number
  status: string
}
```

#### 2. Store — `src/stores/userOutages.ts`

Thin Pinia store (follows `outages.ts` pattern):

- `submitReport(req: CreateUserOutageRequest): Promise<CreateUserOutageResponse>`
  - `POST` to `${BASE_URL}/v1/outage-reports`
  - Attaches Bearer token if user is authenticated (optional auth)
  - Returns `{ id, status }` on success
  - Handles 429 (show "please wait" toast) and 400/500 errors
- `submitting: boolean` — loading state
- `lastSubmission: { id, status } | null` — for success confirmation

#### 3. Component — `src/components/ReportOutageModal.vue`

Modal dialog (Nuxt UI `UModal`) triggered from the map view.

**Form fields:**

- **Location** (required)
  - "Use my location" button — browser `navigator.geolocation.getCurrentPosition()`
  - Or click-on-map to place a pin (emit lat/lng from MapComp)
  - Show resolved address text (reverse geocode via Nominatim, same pattern as OutageFormModal)
  - Hidden: `locationAccuracyM` captured from geolocation API
- **Provider** (optional)
  - `USelectMenu` populated from `GET /v1/providers` (already fetched by `useOutageStore`)
  - "I don't know" / leave blank option
- **What happened?** (optional)
  - `UTextarea` → maps to `notes`, max 4000 chars
- **Contact email** (optional)
  - `UInput` type=email → `contactEmail`
  - Helper text: "Only used if we need to follow up"
- **Honeypot**
  - Hidden `<input name="website">` with `display: none` or `aria-hidden`
  - Bound to `website` field, sent as-is (empty = legit)

**Intentionally omitted from MVP form** (send as backend defaults):

- `cause`, `isPlanned`, `customerCount`, `observedTs`, `outageStartTs` — these are power-user/provider fields; keep the customer form simple. `observedTs` can be auto-set to `Date.now() / 1000` on submission.

**UX flow:**

1. User clicks "Report Outage" → modal opens
2. Prompt for location (geolocation or map click)
3. Optional: pick provider, describe issue, leave email
4. Submit → loading state → success confirmation with report ID
5. On 429 → toast "Too many reports. Please try again later."
6. Close modal, optionally drop a temporary marker on the map

#### 4. Map Integration — `src/views/map/MapView.vue`

- Add a floating "Report Outage" button (bottom-right, above map controls)
- Clicking opens `ReportOutageModal`
- Support "click to place pin" mode:
  - When modal is open and user hasn't geolocated, allow a single map click
  - Capture lat/lng, reverse-geocode for `addressText`
  - Show pin on map at selected location
- After successful submission, show a temporary marker at the reported location (with a different style from provider outages — e.g. a user-report icon)

#### 5. Route (optional)

No new route needed for Phase 1 — the modal is triggered from within MapView. If we later want a standalone `/report` page, it can wrap the same component.

### Phase 2: Visualization (future)

- Fetch user-reported outages from a new backend endpoint (not yet built)
- Render as a separate map layer with distinct styling
- Cluster using existing Supercluster infra
- Show in popups alongside provider-confirmed data
- Toggle layer visibility in MapControls

### Phase 3: Admin Review (future)

- Admin page (see TODO.md) lists incoming user reports
- Status workflow: `new` → `reviewed` → `confirmed` / `dismissed`
- Confirmed reports optionally promote to a provider outage
- Provider portal shows customer report activity in their service area

## File Checklist

| File                                   | Action | Description                                                                    |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `src/types/userOutage.ts`              | Create | Request/response interfaces                                                    |
| `src/stores/userOutages.ts`            | Create | Pinia store for report submission                                              |
| `src/components/ReportOutageModal.vue` | Create | Report form modal                                                              |
| `src/views/map/MapView.vue`            | Edit   | Add "Report Outage" button + modal integration                                 |
| `src/components/map/MapComp.vue`       | Edit   | Support "click to place pin" mode (optional, can use geolocation only for MVP) |
