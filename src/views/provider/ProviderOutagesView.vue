<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from '@nuxt/ui/composables'
import { useProviderStore } from '@/stores/provider'
import OutageFormModal from '@/components/OutageFormModal.vue'
import type { ProviderOutage, OutageStatus } from '@/types/provider'

const toast = useToast()

const providerStore = useProviderStore()
const { outages, isLoading, error, isEditor, selectedProvider, memberships } =
  storeToRefs(providerStore)

const statusFilter = ref<OutageStatus | 'all'>('all')
const showDeleteModal = ref(false)
const deletingOutage = ref<ProviderOutage | null>(null)

// --- Form modal ---
const showFormModal = ref(false)
const editingOutageId = ref<number | null>(null)

// --- Provider selector ---
const providerOptions = computed(() =>
  memberships.value.map((m) => ({ label: m.provider, value: m.provider })),
)

const selectedProviderModel = computed({
  get: () => selectedProvider.value ?? undefined,
  set: (v: string | undefined) => { selectedProvider.value = v ?? null },
})

onMounted(() => {
  providerStore.fetchOutages({ includeDrafts: true, includeHidden: true })
})

watch(selectedProvider, () => {
  providerStore.fetchOutages({ includeDrafts: true, includeHidden: true })
})

function getOutageStatus(outage: ProviderOutage): OutageStatus {
  if (outage.isHidden) return 'hidden'
  if (outage.isDraft) return 'draft'
  if (outage.endTs) return 'ended'
  return 'active'
}

const statusColor: Record<OutageStatus, string> = {
  draft: 'warning',
  active: 'success',
  hidden: 'neutral',
  ended: 'info',
}

const statusLabel: Record<OutageStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  hidden: 'Hidden',
  ended: 'Ended',
}

const statusCounts = computed(() => {
  const counts: Record<OutageStatus, number> = { draft: 0, active: 0, hidden: 0, ended: 0 }
  for (const o of outages.value) {
    counts[getOutageStatus(o)]++
  }
  return counts
})

const filteredOutages = computed(() => {
  if (statusFilter.value === 'all') return outages.value
  return outages.value.filter((o) => getOutageStatus(o) === statusFilter.value)
})

const statusFilterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'Ended', value: 'ended' },
]

function formatLocation(lat: number, lng: number) {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

function formatDateTime(value: string | null) {
  if (!value) return '--'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRelative(value: string) {
  const d = new Date(value)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function openCreateModal() {
  editingOutageId.value = null
  showFormModal.value = true
}

function openEditModal(outage: ProviderOutage) {
  editingOutageId.value = outage.id
  showFormModal.value = true
}

function onFormSaved() {
  providerStore.fetchOutages({ includeDrafts: true, includeHidden: true })
}

async function handleHideToggle(outage: ProviderOutage) {
  try {
    if (outage.isHidden) {
      await providerStore.unhideOutage(outage.id)
      toast.add({ title: 'Outage unhidden', color: 'success', icon: 'i-heroicons-check-circle' })
    } else {
      await providerStore.hideOutage(outage.id)
      toast.add({ title: 'Outage hidden', color: 'success', icon: 'i-heroicons-check-circle' })
    }
  } catch {
    toast.add({
      title: outage.isHidden ? 'Failed to unhide outage' : 'Failed to hide outage',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}

function openDeleteModal(outage: ProviderOutage) {
  deletingOutage.value = outage
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingOutage.value) return
  try {
    await providerStore.deleteOutage(deletingOutage.value.id)
    showDeleteModal.value = false
    deletingOutage.value = null
    toast.add({ title: 'Outage deleted', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch {
    toast.add({
      title: 'Failed to delete outage',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}
</script>

<template>
  <div class="p-6">
    <div class="max-w-6xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold text-default">Outages</h1>
        <UButton
          v-if="isEditor"
          icon="i-heroicons-plus"
          color="primary"
          size="sm"
          label="Report Outage"
          @click="openCreateModal"
        />
      </div>

      <!-- Filter bar -->
      <div class="flex items-center gap-3 mb-4">
        <USelect
          v-if="providerOptions.length > 1"
          v-model="selectedProviderModel"
          :items="providerOptions"
          size="sm"
          class="w-48"
        />
        <USelect v-model="statusFilter" :items="statusFilterOptions" size="sm" class="w-36" />
      </div>

      <!-- Status stat cards -->
      <div v-if="outages.length" class="grid grid-cols-4 gap-3 mb-4">
        <button
          v-for="status in (['active', 'draft', 'hidden', 'ended'] as OutageStatus[])"
          :key="status"
          class="rounded-lg border px-4 py-3 text-left transition-colors"
          :class="statusFilter === status
            ? 'border-primary bg-primary/5'
            : 'border-default bg-elevated hover:bg-elevated/80'"
          @click="statusFilter = statusFilter === status ? 'all' : status"
        >
          <div class="text-2xl font-bold tabular-nums text-default">
            {{ statusCounts[status] }}
          </div>
          <div class="text-xs text-muted">{{ statusLabel[status] }}</div>
        </button>
      </div>

      <!-- Error state -->
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="error"
        class="mb-6"
      />

      <!-- Loading state -->
      <div v-if="isLoading && !outages.length" class="flex items-center justify-center py-8">
        <div class="text-center">
          <div class="mb-3">
            <span class="relative flex h-10 w-10 mx-auto">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
              ></span>
              <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
            </span>
          </div>
          <p class="text-xs font-medium text-muted">Loading outages...</p>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!isLoading && !outages.length"
        class="text-center py-12 bg-elevated rounded-lg border border-default"
      >
        <UIcon name="i-heroicons-bolt" class="h-10 w-10 text-dimmed mx-auto mb-3" />
        <h3 class="text-base font-semibold text-default mb-1">No outages yet</h3>
        <p class="text-muted text-xs mb-4">Report your first outage to get started</p>
        <UButton
          v-if="isEditor"
          icon="i-heroicons-plus"
          color="primary"
          size="sm"
          label="Report Outage"
          @click="openCreateModal"
        />
      </div>

      <!-- Filtered empty state -->
      <div
        v-else-if="!isLoading && outages.length && !filteredOutages.length"
        class="text-center py-12 bg-elevated rounded-lg border border-default"
      >
        <UIcon name="i-heroicons-funnel" class="h-10 w-10 text-dimmed mx-auto mb-3" />
        <h3 class="text-base font-semibold text-default mb-1">No matching outages</h3>
        <p class="text-muted text-xs">Try changing the status filter</p>
      </div>

      <!-- Outage table -->
      <div v-else-if="filteredOutages.length" class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated border-b border-default">
            <tr>
              <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Status</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Location</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Customers</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Cause</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Started</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">ETR</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Updated</th>
              <th v-if="isEditor" class="text-right px-4 py-3 text-xs font-medium text-muted uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="outage in filteredOutages"
              :key="outage.id"
              class="hover:bg-elevated/50 transition-colors"
            >
              <td class="px-4 py-3">
                <UBadge
                  :color="statusColor[getOutageStatus(outage)] as any"
                  variant="soft"
                  size="xs"
                >
                  {{ statusLabel[getOutageStatus(outage)] }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-default font-mono text-xs">
                {{ formatLocation(outage.latitude, outage.longitude) }}
              </td>
              <td class="px-4 py-3 text-default">
                {{ outage.customerCount ?? '--' }}
              </td>
              <td class="px-4 py-3 text-default max-w-40 truncate">
                {{ outage.cause ?? '--' }}
              </td>
              <td class="px-4 py-3 text-default text-xs">
                {{ formatDateTime(outage.outageStartLocal || outage.outageStartUtc) }}
              </td>
              <td class="px-4 py-3 text-default text-xs">
                {{ formatDateTime(outage.etrLocal || outage.etrUtc) }}
              </td>
              <td class="px-4 py-3 text-muted text-xs">
                {{ formatRelative(outage.updatedAt) }}
              </td>
              <td v-if="isEditor" class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip text="Edit" :delay-open="0">
                    <UButton
                      icon="i-heroicons-pencil-square"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      @click="openEditModal(outage)"
                    />
                  </UTooltip>
                  <UTooltip :text="outage.isHidden ? 'Unhide' : 'Hide'" :delay-open="0">
                    <UButton
                      :icon="outage.isHidden ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      @click="handleHideToggle(outage)"
                    />
                  </UTooltip>
                  <UTooltip text="Delete" :delay-open="0">
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="xs"
                      @click="openDeleteModal(outage)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="showDeleteModal" title="Delete Outage">
      <template #body>
        <div class="space-y-4">
          <p class="text-default">
            Are you sure you want to delete this outage? This action cannot be undone.
          </p>
          <div v-if="deletingOutage" class="bg-accented px-4 py-3 rounded">
            <p class="text-sm text-default">
              <span class="font-medium">ID:</span> {{ deletingOutage.id }}
            </p>
            <p class="text-sm text-default">
              <span class="font-medium">Location:</span>
              {{ formatLocation(deletingOutage.latitude, deletingOutage.longitude) }}
            </p>
          </div>
          <UAlert
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            title="This will soft-delete the outage"
            description="The outage will no longer appear on the public map."
          />
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showDeleteModal = false" />
          <UButton color="error" label="Delete" :loading="isLoading" @click="handleDelete" />
        </div>
      </template>
    </UModal>

    <!-- Outage form modal -->
    <OutageFormModal
      v-model:open="showFormModal"
      :outage-id="editingOutageId"
      @saved="onFormSaved"
    />
  </div>
</template>
