<template>
  <div class="flex flex-col gap-1 md:text-lg">
    <div class="info-item">
      <span class="label">Current time:</span>
      <span class="value">{{ currentTime }}</span>
    </div>
    <div class="info-item">
      <span class="label">Next event:</span>
      <span class="value">{{ nextEvent }}</span>
    </div>
    <div class="info-item">
      <span class="label">Time until:</span>
      <span class="value">{{ timeUntil }}</span>
    </div>
    <div class="info-item">
      <span class="label">UI Darkness:</span>
      <span class="value">{{ blendPercentage.toFixed(2) }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentTime: string;
  nextEvent: string;
  timeUntil: string;
  blendPercentage: number;
}

defineProps<Props>();
</script>

<style scoped>

.info-item {
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: baseline;
}

.label {
  font-weight: 500;
  opacity: 0.8;
}

.value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>

