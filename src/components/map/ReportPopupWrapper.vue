<script lang="ts" setup>
import type { UserOutageReport } from '@/types/userOutage'
import ReportPopupComp from './ReportPopupComp.vue'

defineProps<{
  reports: UserOutageReport[]
}>()
</script>

<template>
  <UApp>
    <ReportPopupComp :reports="reports" />
  </UApp>
</template>
