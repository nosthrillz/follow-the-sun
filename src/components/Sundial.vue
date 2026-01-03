<template>
  <div class="sundial-container">
    <svg class="sundial" viewBox="0 0 200 200">
      <!-- Outer circle -->
      <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>

      <!-- Event markers -->
      <g v-if="events.length > 0">
        <line
          v-for="event in events"
          :key="event.name"
          :x1="100 + 95 * Math.cos(event.angle)"
          :y1="100 + 95 * Math.sin(event.angle)"
          :x2="100 + 85 * Math.cos(event.angle)"
          :y2="100 + 85 * Math.sin(event.angle)"
          stroke="currentColor"
          :stroke-width="event.isMajor ? 2 : 1"
          :opacity="event.isMajor ? 0.6 : 0.3"
        />
        <text
          v-for="event in events.filter(e => e.isMajor)"
          :key="`label-${event.name}`"
          :x="100 + 75 * Math.cos(event.angle)"
          :y="100 + 75 * Math.sin(event.angle)"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="8"
          opacity="0.7"
        >
          {{ event.label }}
        </text>
      </g>

      <!-- Progress arc (from midnight to current time) -->
      <path
        v-if="progressAngle !== null"
        :d="progressArc"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        opacity="0.8"
        stroke-linecap="round"
      />

      <!-- Current sun position indicator -->
      <circle
        v-if="progressAngle !== null"
        :cx="100 + 90 * Math.cos(progressAngle)"
        :cy="100 + 90 * Math.sin(progressAngle)"
        r="4"
        fill="currentColor"
      />

      <!-- Center dot -->
      <circle cx="100" cy="100" r="3" fill="currentColor" opacity="0.5"/>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SundialEvent } from '../composables/useSunCalculations';

interface Props {
  events: SundialEvent[];
  progressAngle: number | null;
}

const props = defineProps<Props>();

const progressArc = computed(() => {
  if (props.progressAngle === null) return '';
  
  const radius = 90;
  const centerX = 100;
  const centerY = 100;
  const startAngle = -Math.PI / 2;
  
  const startX = centerX + radius * Math.cos(startAngle);
  const startY = centerY + radius * Math.sin(startAngle);
  const endX = centerX + radius * Math.cos(props.progressAngle);
  const endY = centerY + radius * Math.sin(props.progressAngle);
  
  const angleDiff = props.progressAngle - startAngle;
  const largeArc = Math.abs(angleDiff) > Math.PI ? 1 : 0;
  
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
});
</script>

<style scoped>
.sundial-container {
  margin-top: 2rem;
}

.sundial {
  width: 300px;
  height: 300px;
  max-width: 90vw;
  max-height: 90vw;
}
</style>

