<template>
  <div class="info">
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
.info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  font-size: 1.5rem;
  text-align: center;
}

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

