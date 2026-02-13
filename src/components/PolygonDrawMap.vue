<script setup lang="ts">
import { ref, shallowRef, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { useDarkModeStore } from '@/stores/darkMode'
import { TILE_LAYERS } from '@/composables/map/useMinimap'
import { parsePolygonWKT } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    centerLat: number
    centerLng: number
    initialPolygonWkt?: string | null
  }>(),
  { initialPolygonWkt: null },
)

const emit = defineEmits<{
  (e: 'update:polygon', value: [number, number][] | null): void
}>()

const { isDark } = storeToRefs(useDarkModeStore())
const tileStyle = computed(() => (isDark.value ? 'dark' : 'light') as 'light' | 'dark')

const mapEl = ref<HTMLElement | null>(null)
const map = shallowRef<L.Map | null>(null)
const tileLayer = shallowRef<L.TileLayer | null>(null)
const drawnItems = shallowRef<L.FeatureGroup | null>(null)
const marker = shallowRef<L.CircleMarker | null>(null)
const hasPolygon = ref(false)

type Mode = 'idle' | 'drawing' | 'editing'
const mode = ref<Mode>('idle')

const drawHandler = shallowRef<L.Draw.Polygon | null>(null)

const POLYGON_STYLE: L.PathOptions = {
  color: '#1ec968',
  weight: 2,
  fillColor: '#1ec968',
  fillOpacity: 0.15,
}

function emitPolygonCoords() {
  if (!drawnItems.value) {
    hasPolygon.value = false
    emit('update:polygon', null)
    return
  }
  const layers = drawnItems.value.getLayers()
  if (layers.length === 0) {
    hasPolygon.value = false
    emit('update:polygon', null)
    return
  }
  const polygon = layers[0] as L.Polygon
  const latlngs = polygon.getLatLngs()[0] as L.LatLng[]
  const coords: [number, number][] = latlngs.map((ll) => [ll.lng, ll.lat])
  hasPolygon.value = true
  emit('update:polygon', coords)
}

function startDrawing() {
  if (!map.value) return
  // Clear existing polygon before drawing new one
  drawnItems.value?.clearLayers()
  hasPolygon.value = false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = new L.Draw.Polygon(map.value as any, {
    allowIntersection: false,
    drawError: { color: '#e1453c', message: 'Edges cannot cross!' },
    shapeOptions: POLYGON_STYLE,
  })
  drawHandler.value = handler
  handler.enable()
  mode.value = 'drawing'
}

function cancelDrawing() {
  drawHandler.value?.disable()
  drawHandler.value = null
  mode.value = 'idle'
}

function startEditing() {
  if (!drawnItems.value) return
  drawnItems.value.eachLayer((layer) => {
    // .editing is added by leaflet-draw at runtime, not in base Leaflet types
    const editable = layer as L.Polygon & { editing?: { enable(): void; disable(): void } }
    editable.editing?.enable()
  })
  mode.value = 'editing'
}

function stopEditing() {
  if (!drawnItems.value) return
  drawnItems.value.eachLayer((layer) => {
    const editable = layer as L.Polygon & { editing?: { enable(): void; disable(): void } }
    editable.editing?.disable()
  })
}

function saveEdit() {
  stopEditing()
  mode.value = 'idle'
  emitPolygonCoords()
}

function cancelEdit() {
  stopEditing()
  mode.value = 'idle'
}

function clearPolygon() {
  drawnItems.value?.clearLayers()
  mode.value = 'idle'
  emitPolygonCoords()
}

onMounted(() => {
  if (!mapEl.value) return

  const m = L.map(mapEl.value, {
    center: [props.centerLat, props.centerLng],
    zoom: 14,
    zoomControl: true,
    attributionControl: false,
  })
  map.value = m

  const tile = L.tileLayer(TILE_LAYERS[tileStyle.value].url, {
    maxZoom: 19,
  }).addTo(m)
  tileLayer.value = tile

  marker.value = L.circleMarker([props.centerLat, props.centerLng], {
    radius: 7,
    color: '#1ec968',
    weight: 2,
    fillColor: 'white',
    fillOpacity: 1,
  }).addTo(m)

  const fg = L.featureGroup().addTo(m)
  drawnItems.value = fg

  // Load existing polygon in edit mode
  if (props.initialPolygonWkt) {
    const parsed = parsePolygonWKT(props.initialPolygonWkt)
    if (parsed.length > 0 && parsed[0] && parsed[0][0]) {
      const ring = parsed[0][0] as [number, number][]
      const polygon = L.polygon(ring, POLYGON_STYLE)
      fg.addLayer(polygon)
      m.fitBounds(polygon.getBounds(), { padding: [30, 30] })
      hasPolygon.value = true
    }
  }

  // Listen for polygon creation (from programmatic draw handler)
  m.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
    const evt = e as L.DrawEvents.Created
    fg.clearLayers()
    fg.addLayer(evt.layer)
    drawHandler.value = null
    mode.value = 'idle'
    emitPolygonCoords()
  })

  // Handle draw cancelled via escape key
  m.on('draw:drawstop', () => {
    if (mode.value === 'drawing') {
      drawHandler.value = null
      mode.value = 'idle'
    }
  })

  nextTick(() => m.invalidateSize())
})

// Dark mode tile switching
watch(tileStyle, (style) => {
  tileLayer.value?.setUrl(TILE_LAYERS[style].url)
})

// Re-center when coordinates change
watch(
  () => [props.centerLat, props.centerLng] as const,
  ([lat, lng]) => {
    if (!map.value || !Number.isFinite(lat) || !Number.isFinite(lng)) return
    map.value.setView([lat, lng], map.value.getZoom())
    marker.value?.setLatLng([lat, lng])
  },
)

onBeforeUnmount(() => {
  drawHandler.value?.disable()
  map.value?.remove()
  map.value = null
})
</script>

<template>
  <div>
    <div ref="mapEl" class="w-full h-[250px] rounded-lg border border-default overflow-hidden" />

    <!-- Toolbar below map -->
    <div class="mt-2 flex items-center justify-between gap-2">
      <!-- Left: status / hint -->
      <p class="text-xs text-muted">
        <template v-if="mode === 'drawing'">
          Click on the map to place vertices. Click the first point to close.
        </template>
        <template v-else-if="mode === 'editing'"> Drag vertices to reshape the area. </template>
        <template v-else-if="hasPolygon"> Affected area defined. </template>
        <template v-else> Draw a polygon to define the affected area. </template>
      </p>

      <!-- Right: action buttons -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Idle, no polygon -->
        <UButton
          v-if="mode === 'idle' && !hasPolygon"
          size="xs"
          color="primary"
          variant="soft"
          icon="i-heroicons-pencil"
          label="Draw Area"
          @click="startDrawing"
        />

        <!-- Idle, has polygon -->
        <template v-if="mode === 'idle' && hasPolygon">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-heroicons-pencil-square"
            label="Edit"
            @click="startEditing"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-heroicons-arrow-path"
            label="Redraw"
            @click="startDrawing"
          />
          <UButton
            size="xs"
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            label="Clear"
            @click="clearPolygon"
          />
        </template>

        <!-- Drawing mode -->
        <UButton
          v-if="mode === 'drawing'"
          size="xs"
          color="neutral"
          variant="ghost"
          label="Cancel"
          @click="cancelDrawing"
        />

        <!-- Editing mode -->
        <template v-if="mode === 'editing'">
          <UButton
            size="xs"
            color="primary"
            variant="soft"
            icon="i-heroicons-check"
            label="Done"
            @click="saveEdit"
          />
          <UButton size="xs" color="neutral" variant="ghost" label="Cancel" @click="cancelEdit" />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Vertex handles (corners) */
:deep(.leaflet-editing-icon) {
  width: 10px !important;
  height: 10px !important;
  margin-left: -5px !important;
  margin-top: -5px !important;
  border-radius: 9999px;
  border: 2px solid #1ec968;
  background: white;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
  cursor: grab;
}

:deep(.leaflet-editing-icon:hover) {
  background: #1ec968;
  transform: scale(1.3);
  transition:
    transform 0.1s,
    background 0.1s;
}

/* Midpoint handles (ghost vertices between corners) */
:deep(.leaflet-div-icon.leaflet-editing-icon) {
  opacity: 0.5;
  width: 8px !important;
  height: 8px !important;
  margin-left: -4px !important;
  margin-top: -4px !important;
}

:deep(.leaflet-div-icon.leaflet-editing-icon:hover) {
  opacity: 1;
}

/* Drawing vertex markers (placed while clicking to draw) */
:deep(.leaflet-marker-icon.leaflet-div-icon) {
  width: 10px !important;
  height: 10px !important;
  margin-left: -5px !important;
  margin-top: -5px !important;
  border-radius: 9999px;
  border: 2px solid #1ec968;
  background: white;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
}

/* Invisible mouse-follow marker used by leaflet-draw */
:deep(.leaflet-marker-icon.leaflet-mouse-marker) {
  opacity: 0 !important;
}

/* Guide dashed line while drawing */
:deep(.leaflet-draw-guide-dash) {
  background: #1ec968;
  opacity: 0.6;
}

/* Zoom control */
:deep(.leaflet-control-zoom a) {
  width: 24px !important;
  height: 24px !important;
  line-height: 24px !important;
  font-size: 14px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.leaflet-control-zoom) {
  border: none !important;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
