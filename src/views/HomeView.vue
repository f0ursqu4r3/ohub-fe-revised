<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOutageStore } from '@/stores/outages'
import { storeToRefs } from 'pinia'

import MapComp from '@/components/map/MapComp.vue'
import VerticalTimeScrubber from '@/components/VerticalTimeScrubber.vue'

const outageStore = useOutageStore()
const { selectedBlockOutages } = storeToRefs(outageStore)

const zoomLevel = ref(4)
const markers = computed(() =>
  selectedBlockOutages.value.map((outage) => ({
    lat: outage.latitude,
    lng: outage.longitude,
    popupText: `Outage ID: ${outage.id}`,
  })),
)
</script>

<template>
  <div class="flex relative w-full h-full">
    <MapComp :markers="markers" :zoomLevel="zoomLevel" class="z-0" />
    <VerticalTimeScrubber class="fixed left-0 h-full z-10" />
  </div>
</template>
