<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from '@nuxt/ui/composables'
import { useOutageStore } from '@/stores/outages'
import { useUserOutageStore } from '@/stores/userOutages'
import type { CreateUserOutageRequest } from '@/types/userOutage'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  (e: 'submitted', payload: { lat: number; lng: number }): void
}>()

const toast = useToast()
const outageStore = useOutageStore()
const userOutageStore = useUserOutageStore()
const { providers } = storeToRefs(outageStore)
const { submitting } = storeToRefs(userOutageStore)

// Form state
const form = ref({
  provider: '',
  notes: '',
  contactEmail: '',
})
const latitude = ref<number | null>(null)
const longitude = ref<number | null>(null)
const locationAccuracyM = ref<number | null>(null)
const addressText = ref('')
const honeypot = ref('')

// Location detection
const geolocating = ref(false)
const geoError = ref<string | null>(null)
const submitted = ref(false)

// Address search
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
let closeDropdownTimer: number | null = null
let submitCloseTimer: number | null = null

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
  latitude.value = result.lat
  longitude.value = result.lon
  addressText.value = `${result.label}, ${result.description}`
  addressQuery.value = addressText.value
  addressResults.value = []
  addressFocused.value = false
  locationAccuracyM.value = null
  geoError.value = null
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
  if (closeDropdownTimer) clearTimeout(closeDropdownTimer)
  closeDropdownTimer = window.setTimeout(() => {
    closeDropdownTimer = null
    addressFocused.value = false
  }, 120)
}

watch(() => addressQuery.value.trim(), scheduleAddressSearch)

// Reverse geocode to get address text from coordinates
async function reverseGeocode(lat: number, lon: number) {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'json',
      addressdetails: '1',
    })
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'Accept-Language': 'en-CA' },
    })
    if (!response.ok) return
    const data = await response.json()
    if (data.display_name) {
      addressText.value = data.display_name
      addressQuery.value = data.display_name
    }
  } catch {
    // Non-critical — location still works without address text
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    geoError.value = 'Geolocation is not supported by your browser.'
    return
  }
  geolocating.value = true
  geoError.value = null
  navigator.geolocation.getCurrentPosition(
    (position) => {
      latitude.value = position.coords.latitude
      longitude.value = position.coords.longitude
      locationAccuracyM.value = position.coords.accuracy
        ? Math.round(position.coords.accuracy)
        : null
      geolocating.value = false
      reverseGeocode(position.coords.latitude, position.coords.longitude)
    },
    (err) => {
      geolocating.value = false
      if (err.code === err.PERMISSION_DENIED) {
        geoError.value = 'Location access denied. Please search for your address instead.'
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        geoError.value = 'Location unavailable. Please search for your address instead.'
      } else {
        geoError.value =
          'Could not determine your location. Please search for your address instead.'
      }
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}

const hasLocation = computed(() => latitude.value !== null && longitude.value !== null)

const providerItems = computed(() => providers.value.map((p) => ({ label: p, value: p })))

const isFormValid = computed(() => hasLocation.value)

function resetForm() {
  form.value = { provider: '', notes: '', contactEmail: '' }
  latitude.value = null
  longitude.value = null
  locationAccuracyM.value = null
  addressText.value = ''
  addressQuery.value = ''
  addressResults.value = []
  honeypot.value = ''
  geoError.value = null
  submitted.value = false
}

watch(open, (isOpen) => {
  if (isOpen) resetForm()
})

async function handleSubmit() {
  if (!isFormValid.value || latitude.value === null || longitude.value === null) return

  const req: CreateUserOutageRequest = {
    latitude: latitude.value,
    longitude: longitude.value,
    observedTs: Math.floor(Date.now() / 1000),
    website: honeypot.value, // honeypot — should be empty
  }

  if (form.value.provider) req.provider = form.value.provider
  if (form.value.notes.trim()) req.notes = form.value.notes.trim()
  if (form.value.contactEmail.trim()) req.contactEmail = form.value.contactEmail.trim()
  if (addressText.value) req.addressText = addressText.value
  if (locationAccuracyM.value !== null) req.locationAccuracyM = locationAccuracyM.value

  try {
    await userOutageStore.submitReport(req)
    submitted.value = true
    emit('submitted', { lat: latitude.value, lng: longitude.value })
    toast.add({
      title: 'Outage reported',
      description: 'Thank you for your report.',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
    submitCloseTimer = window.setTimeout(() => {
      submitCloseTimer = null
      open.value = false
    }, 1500)
  } catch (err) {
    toast.add({
      title: 'Failed to submit report',
      description: err instanceof Error ? err.message : 'Something went wrong.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}

function clearLocation() {
  latitude.value = null
  longitude.value = null
  locationAccuracyM.value = null
  addressText.value = ''
  addressQuery.value = ''
  geoError.value = null
}

onBeforeUnmount(() => {
  if (addressDebounceId) clearTimeout(addressDebounceId)
  if (closeDropdownTimer) clearTimeout(closeDropdownTimer)
  if (submitCloseTimer) clearTimeout(submitCloseTimer)
  addressController?.abort()
})
</script>

<template>
  <UModal v-model:open="open" title="Report an Outage" description="Help us track outages in your area by submitting a report.">
    <template #body>
      <!-- Success state -->
      <div v-if="submitted" class="flex flex-col items-center justify-center py-8 text-center">
        <div
          class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-50 dark:bg-success-950/50"
        >
          <UIcon name="i-heroicons-check-circle" class="h-8 w-8 text-success-500" />
        </div>
        <p class="text-base font-semibold text-default">Report submitted</p>
        <p class="mt-1 text-sm text-muted">Thank you for helping track outages in your area.</p>
      </div>

      <form v-else class="space-y-5" @submit.prevent="handleSubmit">
        <!-- Location Section -->
        <fieldset class="min-w-0 rounded-lg border border-default p-4">
          <legend
            class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted"
          >
            <UIcon name="i-heroicons-map-pin" class="size-3.5" />
            Location
          </legend>

          <div v-if="!hasLocation" class="space-y-3">
            <UButton
              icon="i-heroicons-map-pin"
              label="Use my location"
              color="primary"
              variant="soft"
              size="sm"
              block
              :loading="geolocating"
              @click="useMyLocation"
            />

            <div class="flex items-center gap-3">
              <USeparator class="flex-1" />
              <span class="text-xs text-muted">or search</span>
              <USeparator class="flex-1" />
            </div>

            <!-- Address search -->
            <div class="relative w-full">
              <UInput
                v-model="addressQuery"
                class="w-full"
                icon="i-heroicons-magnifying-glass"
                placeholder="Search for your address..."
                size="sm"
                :loading="addressLoading"
                @focus="addressFocused = true"
                @blur="closeAddressDropdown"
                @keydown="onAddressKeydown"
              />
              <div
                v-if="showAddressDropdown"
                class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-default bg-elevated shadow-lg"
              >
                <div v-if="addressLoading" class="px-4 py-3 text-sm text-muted">Searching...</div>
                <ul v-else class="max-h-48 divide-y divide-default overflow-y-auto">
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

            <p v-if="geoError" class="text-xs text-error-500">{{ geoError }}</p>
          </div>

          <!-- Location confirmed -->
          <div v-else class="space-y-2">
            <div
              class="flex items-center justify-between rounded-md bg-success-50 dark:bg-success-950/30 px-3 py-2"
            >
              <div class="flex flex-1 items-center gap-2 min-w-0">
                <UIcon name="i-heroicons-check-circle" class="h-4 w-4 shrink-0 text-success-500" />
                <span class="truncate text-sm text-success-700 dark:text-success-300">
                  {{ addressText || `${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}` }}
                </span>
              </div>
              <button
                type="button"
                class="ml-2 shrink-0 text-xs text-muted hover:text-default"
                @click="clearLocation"
              >
                Change
              </button>
            </div>
          </div>
        </fieldset>

        <!-- Details Section -->
        <fieldset class="rounded-lg border border-default p-4">
          <legend
            class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted"
          >
            <UIcon name="i-heroicons-clipboard-document-list" class="size-3.5" />
            Details
            <span class="font-normal text-dimmed">(optional)</span>
          </legend>

          <div class="space-y-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-muted">Provider</label>
              <USelectMenu
                v-model="form.provider"
                :items="providerItems"
                value-key="value"
                size="sm"
                class="w-full"
                searchable
                placeholder="Select your provider (if known)"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium text-muted">What happened?</label>
              <UTextarea
                v-model="form.notes"
                placeholder="Describe what you're experiencing..."
                :rows="3"
                size="sm"
                class="w-full"
                :maxlength="4000"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium text-muted">Contact email</label>
              <UInput
                v-model="form.contactEmail"
                type="email"
                placeholder="your@email.com"
                class="w-full"
                size="sm"
                icon="i-heroicons-envelope"
              />
              <p class="mt-1 text-xs text-dimmed">Only used if we need to follow up.</p>
            </div>
          </div>
        </fieldset>

        <!-- Honeypot — hidden from real users -->
        <div class="absolute -left-[9999px] opacity-0" aria-hidden="true" tabindex="-1">
          <label>
            Website
            <input v-model="honeypot" type="text" name="website" autocomplete="off" tabindex="-1" />
          </label>
        </div>
      </form>
    </template>

    <template #footer>
      <div v-if="!submitted" class="flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" label="Cancel" size="sm" @click="open = false" />
        <UButton
          color="primary"
          label="Submit Report"
          size="sm"
          icon="i-heroicons-paper-airplane"
          :loading="submitting"
          :disabled="!isFormValid"
          @click="handleSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
