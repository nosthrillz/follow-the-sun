<template>
  <div class="debug-info" v-if="sunInfo">
    <details>
      <summary>Debug: Sun Events</summary>
      <div class="debug-content">
        <div><strong>Astronomical Twilight:</strong> {{ formatMinutes(astroTwilightBegin) }} - {{ formatMinutes(astroTwilightEnd) }}</div>
        <div><strong>Nautical Twilight:</strong> {{ formatMinutes(nauticalTwilightBegin) }} - {{ formatMinutes(nauticalTwilightEnd) }}</div>
        <div><strong>Civil Twilight:</strong> {{ formatMinutes(civilTwilightBegin) }} - {{ formatMinutes(civilTwilightEnd) }}</div>
        <div><strong>Sunrise:</strong> {{ formatMinutes(sunrise) }}</div>
        <div><strong>Solar Noon:</strong> {{ formatMinutes(solarNoon) }}</div>
        <div><strong>Sunset:</strong> {{ formatMinutes(sunset) }}</div>
        <hr>
        <div><strong>Current Time (minutes):</strong> {{ currentMinutes.toFixed(2) }}</div>
        <div v-if="currentLux !== undefined"><strong>Light Intensity (lux):</strong> {{ currentLux.toFixed(2) }}</div>
        <div><strong>Darkness Value:</strong> {{ darkValue.toFixed(2) }}%</div>
        <div v-if="textContrast !== undefined"><strong>Text Contrast:</strong> {{ textContrast.toFixed(2) }}%</div>
        <div v-if="textContrast !== undefined"><strong>Contrast Diff:</strong> {{ Math.abs(darkValue - textContrast).toFixed(2) }}%</div>
        <hr>
        <div><strong>Moon Phase:</strong> {{ moonPhaseName }} ({{ moonIllumination.toFixed(1) }}%)</div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { timeToMinutes, formatTime, type SunInformation } from '../composables/useSunCalculations';
import { getMoonIllumination, getMoonPhase } from '../composables/useMoonCalculations';

interface Props {
  sunInfo: SunInformation | null;
  currentMinutes: number;
  darkValue: number;
  textContrast?: number;
  currentLux?: number;
}

const props = defineProps<Props>();

// Calculate moon info for current time
const moonDate = computed(() => {
  const date = new Date();
  date.setHours(Math.floor(props.currentMinutes / 60));
  date.setMinutes(props.currentMinutes % 60);
  date.setSeconds(0);
  return date;
});

const moonIllumination = computed(() => getMoonIllumination(moonDate.value));
const moonPhase = computed(() => getMoonPhase(moonDate.value));

const moonPhaseName = computed(() => {
  const phase = moonPhase.value;
  if (phase < 0.03 || phase > 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
});

const astroTwilightBegin = computed(() => props.sunInfo ? timeToMinutes(props.sunInfo.results.astronomical_twilight_begin) : 0);
const astroTwilightEnd = computed(() => props.sunInfo ? timeToMinutes(props.sunInfo.results.astronomical_twilight_end) : 0);
const nauticalTwilightBegin = computed(() => props.sunInfo ? timeToMinutes(props.sunInfo.results.nautical_twilight_begin) : 0);
const nauticalTwilightEnd = computed(() => props.sunInfo ? timeToMinutes(props.sunInfo.results.nautical_twilight_end) : 0);
const civilTwilightBegin = computed(() => props.sunInfo ? timeToMinutes(props.sunInfo.results.civil_twilight_begin) : 0);
const civilTwilightEnd = computed(() => props.sunInfo ? timeToMinutes(props.sunInfo.results.civil_twilight_end) : 0);
const sunrise = computed(() => props.sunInfo ? timeToMinutes(props.sunInfo.results.sunrise) : 0);
const sunset = computed(() => props.sunInfo ? timeToMinutes(props.sunInfo.results.sunset) : 0);
const solarNoon = computed(() => props.sunInfo ? timeToMinutes(props.sunInfo.results.solar_noon) : 0);

const formatMinutes = (minutes: number) => formatTime(minutes);
</script>

<style scoped>
.debug-info {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.85rem;
  z-index: 1000;
  max-width: 300px;
}

details summary {
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.debug-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-family: monospace;
  font-size: 0.8rem;
}

.debug-content hr {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  margin: 0.5rem 0;
}
</style>

