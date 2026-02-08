<script setup lang="ts">
import { ref, computed, watch, shallowRef, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from '@nuxt/ui/composables'
import { CalendarDate, Time } from '@internationalized/date'
import { useProviderStore } from '@/stores/provider'
import { parsePolygonWKT } from '@/lib/utils'
import type { ProviderOutageCreateRequest, ProviderOutagePatchRequest } from '@/types/provider'
import PolygonDrawMap from '@/components/PolygonDrawMap.vue'

const props = defineProps<{
  outageId: number | null
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const toast = useToast()
const providerStore = useProviderStore()
const { selectedProvider, memberships, currentOutage } = storeToRefs(providerStore)

const isEditMode = computed(() => props.outageId !== null)
const isSaving = ref(false)
const isFormLoading = ref(false)

const form = ref({
  latitude: '',
  longitude: '',
  outageStartTz: '',
  etrTz: '',
  customerCount: '',
  cause: '',
  outageType: '',
  isPlanned: false,
  notes: '',
})

const polygonCoords = ref<[number, number][] | null>(null)

const showPolygonMap = computed(() => {
  const lat = Number(form.value.latitude)
  const lng = Number(form.value.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
})

const initialPolygonWkt = computed(() => currentOutage.value?.polygon ?? null)

const outageStartDate = shallowRef<CalendarDate | undefined>()
const outageStartTime = shallowRef<Time | undefined>()
const etrDate = shallowRef<CalendarDate | undefined>()
const etrTime = shallowRef<Time | undefined>()

// --- Timezone selector ---
const allTimezones = [
  'America/St_Johns',
  'America/Halifax',
  'America/Moncton',
  'America/Toronto',
  'America/Winnipeg',
  'America/Regina',
  'America/Edmonton',
  'America/Vancouver',
  'America/Whitehorse',
  'America/Yellowknife',
  'America/Iqaluit',
  'America/Rankin_Inlet',
  'America/Resolute',
  'America/Atikokan',
  'America/Creston',
  'America/Dawson',
  'America/Dawson_Creek',
  'America/Fort_Nelson',
  'America/Glace_Bay',
  'America/Goose_Bay',
  'America/Inuvik',
  'America/Swift_Current',
]

const timezoneItems = allTimezones.map((tz) => ({ label: tz, value: tz }))

const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

const defaultTimezone = computed(() => {
  const membership = memberships.value.find((m) => m.provider === selectedProvider.value)
  return membership?.timezone ?? userTimezone
})

// --- Address search ---
type AddressResult = {
  id: string
  label: string
  description: string
  lat: number
  lon: number
}

const addressQuery = ref('')
const addressResults = ref<AddressResult[]>([])
const addressLoading = ref(false)
const addressFocused = ref(false)
const addressActiveIndex = ref(-1)
let addressDebounceId: number | null = null
let addressController: AbortController | null = null

const showAddressDropdown = computed(
  () =>
    addressFocused.value &&
    addressQuery.value.trim().length >= 3 &&
    (addressLoading.value || addressResults.value.length > 0),
)

async function fetchAddresses(term: string) {
  addressController?.abort()
  addressController = new AbortController()
  addressLoading.value = true

  try {
    const params = new URLSearchParams({
      q: term,
      format: 'json',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'ca',
    })
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en-CA' },
      signal: addressController.signal,
    })
    if (!response.ok) throw new Error('Search failed')
    const data = await response.json()
    addressResults.value = Array.isArray(data)
      ? data
          .map((item: Record<string, unknown>) => {
            const lat = Number(item.lat)
            const lon = Number(item.lon)
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
            const fullAddress = String(item.display_name ?? '')
            const label = fullAddress.split(',')[0]?.trim() || fullAddress
            const addr = (item.address ?? {}) as Record<string, string>
            const city = addr.city || addr.town || addr.village || addr.hamlet || ''
            const province = addr.state || addr.region || addr.province || ''
            const parts = [city, province].filter(Boolean)
            return {
              id: String(item.place_id ?? `${lat}-${lon}`),
              label,
              description: parts.join(', ') || 'Canada',
              lat,
              lon,
            } as AddressResult
          })
          .filter((r: AddressResult | null): r is AddressResult => r !== null)
      : []
    addressActiveIndex.value = addressResults.value.length ? 0 : -1
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    addressResults.value = []
  } finally {
    addressLoading.value = false
  }
}

function scheduleAddressSearch(term: string) {
  if (addressDebounceId) clearTimeout(addressDebounceId)
  if (term.trim().length < 3) {
    addressResults.value = []
    addressLoading.value = false
    return
  }
  addressDebounceId = window.setTimeout(() => fetchAddresses(term), 250)
}

function selectAddress(result: AddressResult) {
  form.value.latitude = String(result.lat)
  form.value.longitude = String(result.lon)
  addressQuery.value = result.label
  addressResults.value = []
  addressFocused.value = false
}

function onAddressKeydown(event: KeyboardEvent) {
  if (!addressResults.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    addressActiveIndex.value = (addressActiveIndex.value + 1) % addressResults.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    addressActiveIndex.value =
      addressActiveIndex.value <= 0 ? addressResults.value.length - 1 : addressActiveIndex.value - 1
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const choice = addressResults.value[addressActiveIndex.value] ?? addressResults.value[0]
    if (choice) selectAddress(choice)
  }
}

const closeAddressDropdown = () => {
  setTimeout(() => {
    addressFocused.value = false
  }, 120)
}

watch(() => addressQuery.value.trim(), scheduleAddressSearch)

onBeforeUnmount(() => {
  if (addressDebounceId) clearTimeout(addressDebounceId)
  addressController?.abort()
})

// --- Form helpers ---
function parseDateTimeLocal(value: string): { date: CalendarDate; time: Time } | null {
  const d = new Date(value)
  if (!isNaN(d.getTime())) {
    return {
      date: new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      time: new Time(d.getHours(), d.getMinutes()),
    }
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (match) {
    return {
      date: new CalendarDate(Number(match[1]), Number(match[2]), Number(match[3])),
      time: new Time(Number(match[4]), Number(match[5])),
    }
  }
  return null
}

function toLocalString(date: CalendarDate | undefined, time: Time | undefined): string | null {
  if (!date) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${date.year}-${pad(date.month)}-${pad(date.day)}`
  if (!time) return `${dateStr}T00:00`
  return `${dateStr}T${pad(time.hour)}:${pad(time.minute)}`
}

function resetForm() {
  form.value = {
    latitude: '',
    longitude: '',
    outageStartTz: defaultTimezone.value,
    etrTz: defaultTimezone.value,
    customerCount: '',
    cause: '',
    outageType: '',
    isPlanned: false,
    notes: '',
  }
  outageStartDate.value = undefined
  outageStartTime.value = undefined
  etrDate.value = undefined
  etrTime.value = undefined
  addressQuery.value = ''
  addressResults.value = []
  polygonCoords.value = null
}

async function loadOutage(id: number) {
  isFormLoading.value = true
  await providerStore.fetchOutage(id)
  if (currentOutage.value) {
    const o = currentOutage.value
    form.value.latitude = String(o.latitude)
    form.value.longitude = String(o.longitude)
    form.value.customerCount = o.customerCount != null ? String(o.customerCount) : ''
    form.value.cause = o.cause ?? ''
    form.value.outageType = o.outageType ?? ''
    form.value.isPlanned = o.isPlanned ?? false
    form.value.notes = o.notes ?? ''
    form.value.outageStartTz = o.outageStartTz ?? defaultTimezone.value

    if (o.outageStartLocal) {
      const parsed = parseDateTimeLocal(o.outageStartLocal)
      if (parsed) {
        outageStartDate.value = parsed.date
        outageStartTime.value = parsed.time
      }
    }
    if (o.etrLocal) {
      const parsed = parseDateTimeLocal(o.etrLocal)
      if (parsed) {
        etrDate.value = parsed.date
        etrTime.value = parsed.time
      }
    }
    form.value.etrTz = o.etrTz ?? defaultTimezone.value

    // Parse existing polygon WKT so it's included in updates even without map interaction
    if (o.polygon) {
      const parsed = parsePolygonWKT(o.polygon)
      if (parsed.length > 0 && parsed[0]?.[0]) {
        // parsePolygonWKT returns [lat, lon]; API needs [lng, lat]
        polygonCoords.value = parsed[0][0].map(([lat, lon]) => [lon, lat] as [number, number])
      }
    } else {
      polygonCoords.value = null
    }
  }
  isFormLoading.value = false
}

// Reset and load when modal opens
watch(open, (isOpen) => {
  if (isOpen) {
    resetForm()
    if (props.outageId !== null) {
      loadOutage(props.outageId)
    }
  }
})

const isFormValid = computed(() => {
  const lat = Number(form.value.latitude)
  const lng = Number(form.value.longitude)
  return (
    selectedProvider.value &&
    form.value.latitude &&
    form.value.longitude &&
    !isNaN(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    !isNaN(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    outageStartDate.value &&
    form.value.outageStartTz
  )
})

async function handleSubmit(asDraft: boolean) {
  if (!isFormValid.value) return
  isSaving.value = true

  try {
    const outageStartLocal = toLocalString(outageStartDate.value, outageStartTime.value)
    const etrLocal = toLocalString(etrDate.value, etrTime.value)

    if (isEditMode.value && props.outageId) {
      const patch: ProviderOutagePatchRequest = {
        latitude: Number(form.value.latitude),
        longitude: Number(form.value.longitude),
        outageStartLocal: outageStartLocal!,
        outageStartTz: form.value.outageStartTz,
        customerCount: form.value.customerCount ? Number(form.value.customerCount) : null,
        cause: form.value.cause || null,
        outageType: form.value.outageType || null,
        isPlanned: form.value.isPlanned || null,
        notes: form.value.notes || null,
        isDraft: asDraft,
        polygon: polygonCoords.value && polygonCoords.value.length >= 3
          ? polygonCoords.value
          : null,
      }
      if (etrLocal && form.value.etrTz) {
        patch.etrLocal = etrLocal
        patch.etrTz = form.value.etrTz
      } else {
        patch.etrLocal = null
        patch.etrTz = null
      }
      await providerStore.updateOutage(props.outageId, patch)
      toast.add({ title: 'Outage updated', color: 'success', icon: 'i-heroicons-check-circle' })
    } else {
      const request: ProviderOutageCreateRequest = {
        provider: selectedProvider.value!,
        latitude: Number(form.value.latitude),
        longitude: Number(form.value.longitude),
        outageStartLocal: outageStartLocal!,
        outageStartTz: form.value.outageStartTz,
        isDraft: asDraft,
      }
      if (etrLocal && form.value.etrTz) {
        request.etrLocal = etrLocal
        request.etrTz = form.value.etrTz
      }
      if (form.value.customerCount) request.customerCount = Number(form.value.customerCount)
      if (form.value.cause) request.cause = form.value.cause
      if (form.value.outageType) request.outageType = form.value.outageType
      if (form.value.isPlanned) request.isPlanned = form.value.isPlanned
      if (form.value.notes) request.notes = form.value.notes
      if (polygonCoords.value && polygonCoords.value.length >= 3) {
        request.polygon = polygonCoords.value
      }
      await providerStore.createOutage(request)
      toast.add({ title: 'Outage created', color: 'success', icon: 'i-heroicons-check-circle' })
    }
    open.value = false
    emit('saved')
  } catch {
    toast.add({
      title: isEditMode.value ? 'Failed to update outage' : 'Failed to create outage',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  } finally {
    isSaving.value = false
  }
}

async function handleMarkEnded() {
  if (!props.outageId) return
  isSaving.value = true
  try {
    await providerStore.updateOutage(props.outageId, {
      endTs: Math.floor(Date.now() / 1000),
    })
    toast.add({
      title: 'Outage marked as ended',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
    open.value = false
    emit('saved')
  } catch {
    toast.add({
      title: 'Failed to end outage',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="isEditMode ? 'Edit Outage' : 'Report Outage'">
    <template #body>
      <!-- Loading state for edit mode -->
      <div v-if="isFormLoading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="mb-3">
            <span class="relative flex h-10 w-10 mx-auto">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
              ></span>
              <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
            </span>
          </div>
          <p class="text-xs font-medium text-muted">Loading outage...</p>
        </div>
      </div>

      <form v-else class="space-y-6" @submit.prevent>
        <!-- Location Section -->
        <fieldset class="rounded-lg border border-default p-4">
          <legend class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <UIcon name="i-heroicons-map-pin" class="size-3.5" />
            Location
          </legend>

          <!-- Address search -->
          <div class="relative mb-3 w-full">
            <UInput
              v-model="addressQuery"
              class="w-full"
              icon="i-heroicons-magnifying-glass"
              placeholder="Search for an address..."
              size="sm"
              :loading="addressLoading"
              @focus="addressFocused = true"
              @blur="closeAddressDropdown"
              @keydown="onAddressKeydown"
            />
            <div
              v-if="showAddressDropdown"
              class="absolute z-10 left-0 right-0 top-full mt-1 rounded-lg border border-default bg-elevated shadow-lg overflow-hidden"
            >
              <div v-if="addressLoading" class="px-4 py-3 text-sm text-muted">Searching...</div>
              <ul v-else class="max-h-48 overflow-y-auto divide-y divide-default">
                <li
                  v-for="(result, index) in addressResults"
                  :key="result.id"
                  class="cursor-pointer px-4 py-2.5 transition hover:bg-primary-50 dark:hover:bg-primary-950/50"
                  :class="{
                    'bg-primary-50 dark:bg-primary-950/50': index === addressActiveIndex,
                  }"
                  @mousedown.prevent="selectAddress(result)"
                >
                  <p class="text-sm font-medium text-default">{{ result.label }}</p>
                  <p class="text-xs text-muted">{{ result.description }}</p>
                </li>
              </ul>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-muted mb-1">Latitude</label>
              <UInput
                v-model="form.latitude"
                type="number"
                step="any"
                placeholder="e.g. 45.4215"
                size="sm"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted mb-1">Longitude</label>
              <UInput
                v-model="form.longitude"
                type="number"
                step="any"
                placeholder="e.g. -75.6972"
                size="sm"
              />
            </div>
          </div>

          <!-- Polygon drawing map -->
          <div v-if="showPolygonMap" class="mt-3">
            <PolygonDrawMap
              :center-lat="Number(form.latitude)"
              :center-lng="Number(form.longitude)"
              :initial-polygon-wkt="isEditMode ? initialPolygonWkt : null"
              @update:polygon="polygonCoords = $event"
            />
          </div>
        </fieldset>

        <!-- Timing Section -->
        <fieldset class="rounded-lg border border-default p-4">
          <legend class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <UIcon name="i-heroicons-clock" class="size-3.5" />
            Timing
          </legend>

          <div class="space-y-4">
            <!-- Outage Start -->
            <div>
              <p class="text-xs font-medium text-default mb-2">Outage Start</p>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs text-muted mb-1">Date</label>
                  <UInputDate v-model="outageStartDate" size="sm" />
                </div>
                <div>
                  <label class="block text-xs text-muted mb-1">Time</label>
                  <UInputTime v-model="outageStartTime" size="sm" />
                </div>
                <div>
                  <label class="block text-xs text-muted mb-1">Timezone</label>
                  <USelectMenu
                    v-model="form.outageStartTz"
                    :items="timezoneItems"
                    value-key="value"
                    size="sm"
                    class="w-full"
                    searchable
                    placeholder="Select timezone"
                  />
                </div>
              </div>
            </div>

            <USeparator />

            <!-- ETR -->
            <div>
              <p class="text-xs font-medium text-default mb-2">
                Estimated Time of Restoration
                <span class="text-muted font-normal">(optional)</span>
              </p>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs text-muted mb-1">Date</label>
                  <UInputDate v-model="etrDate" size="sm" />
                </div>
                <div>
                  <label class="block text-xs text-muted mb-1">Time</label>
                  <UInputTime v-model="etrTime" size="sm" />
                </div>
                <div>
                  <label class="block text-xs text-muted mb-1">Timezone</label>
                  <USelectMenu
                    v-model="form.etrTz"
                    :items="timezoneItems"
                    value-key="value"
                    size="sm"
                    class="w-full"
                    searchable
                    placeholder="Select timezone"
                  />
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        <!-- Details Section -->
        <fieldset class="rounded-lg border border-default p-4">
          <legend class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <UIcon name="i-heroicons-clipboard-document-list" class="size-3.5" />
            Details
          </legend>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-muted mb-1">Customer Count</label>
              <UInput
                v-model="form.customerCount"
                type="number"
                placeholder="e.g. 1500"
                size="sm"
                icon="i-heroicons-users"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted mb-1">Outage Type</label>
              <UInput v-model="form.outageType" placeholder="e.g. Power" size="sm" icon="i-heroicons-bolt" />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted mb-1">Cause</label>
              <UInput v-model="form.cause" placeholder="e.g. Storm damage" size="sm" icon="i-heroicons-exclamation-triangle" />
            </div>
            <div class="flex items-end pb-0.5">
              <label class="flex items-center gap-2 text-sm text-default">
                <UCheckbox v-model="form.isPlanned" />
                Planned outage
              </label>
            </div>
          </div>

          <div class="mt-3">
            <label class="block text-xs font-medium text-muted mb-1">Notes</label>
            <UTextarea
              v-model="form.notes"
              placeholder="Additional details about this outage..."
              :rows="3"
              size="sm"
              class="w-full"
            />
          </div>
        </fieldset>
      </form>
    </template>

    <template #footer>
      <div class="flex items-center justify-between">
        <div>
          <UButton
            v-if="isEditMode && currentOutage && !currentOutage.endTs"
            color="warning"
            variant="soft"
            size="sm"
            label="Mark as Ended"
            icon="i-heroicons-clock"
            :loading="isSaving"
            @click="handleMarkEnded"
          />
        </div>
        <div class="flex items-center gap-3">
          <UButton color="neutral" variant="ghost" label="Cancel" size="sm" @click="open = false" />
          <UButton
            color="neutral"
            variant="soft"
            label="Save as Draft"
            size="sm"
            icon="i-heroicons-document"
            :loading="isSaving"
            :disabled="!isFormValid"
            @click="handleSubmit(true)"
          />
          <UButton
            color="primary"
            label="Publish"
            size="sm"
            icon="i-heroicons-paper-airplane"
            :loading="isSaving"
            :disabled="!isFormValid"
            @click="handleSubmit(false)"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
