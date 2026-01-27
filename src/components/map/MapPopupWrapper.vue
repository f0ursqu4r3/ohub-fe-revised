<script lang="ts" setup>
import type { PopupData, BoundsLiteral } from './types'
import MapPopupComp from './MapPopupComp.vue'

defineProps<{
  popupData: PopupData
}>()

const emit = defineEmits<{
  (e: 'zoom', bounds: BoundsLiteral): void
}>()
</script>

<template>
  <UApp>
    <MapPopupComp :popup-data="popupData" @zoom="emit('zoom', $event)" />
  </UApp>
</template>
