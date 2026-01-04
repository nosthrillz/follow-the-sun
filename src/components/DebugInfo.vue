<template>
  <Dialog :open="open" @close="$emit('close')" class="dialog" :style="dialogStyles">
    <DialogOverlay class="dialog-backdrop" :style="backdropStyles" />
    <div class="dialog-container">
      <DialogPanel class="debug-panel" :style="panelStyles">
        <div class="debug-header">
          <DialogTitle class="debug-title">Debug: Sun Events</DialogTitle>
          <button @click="$emit('close')" class="close-button" aria-label="Close">
            <svg class="close-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="debug-content" v-if="sunInfo">
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
          <hr>
          <div class="color-section">
            <div><strong>Background Color:</strong></div>
            <div class="color-detail">Hue: {{ bgHue.toFixed(1) }}°</div>
            <div class="color-detail">Saturation: {{ bgSaturation.toFixed(2) }}%</div>
            <div class="color-detail">Lightness: {{ bgLightness.toFixed(2) }}%</div>
            <div class="color-detail">Lightness (darker): {{ bgLightnessDarker.toFixed(2) }}%</div>
            <div class="color-detail">HSL: hsl({{ bgHue.toFixed(1) }}, {{ bgSaturation.toFixed(2) }}%, {{ bgLightness.toFixed(2) }}%)</div>
          </div>
          <div class="color-section">
            <div><strong>Text Color:</strong></div>
            <div class="color-detail">Hue: {{ textHue.toFixed(1) }}°</div>
            <div class="color-detail">Saturation: {{ textSaturation.toFixed(2) }}%</div>
            <div class="color-detail">Lightness: {{ textLightness.toFixed(2) }}%</div>
            <div class="color-detail">HSL: hsl({{ textHue.toFixed(1) }}, {{ textSaturation.toFixed(2) }}%, {{ textLightness.toFixed(2) }}%)</div>
          </div>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Dialog, DialogPanel, DialogTitle, DialogOverlay } from '@headlessui/vue';
import { extractSunTimes, formatTime, type SunInformation } from '../composables/useSunCalculations';
import { getMoonIllumination, getMoonPhase } from '../composables/useMoonCalculations';

interface Props {
  open: boolean;
  sunInfo: SunInformation | null;
  currentMinutes: number;
  darkValue: number;
  textContrast?: number;
  currentLux?: number;
  bgHue: number;
  bgSaturation: number;
  bgLightness: number;
  bgLightnessDarker: number;
  textHue: number;
  textSaturation: number;
  textLightness: number;
}

const props = defineProps<Props>();

defineEmits<{
  close: [];
}>();

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

const sunTimes = computed(() => props.sunInfo ? extractSunTimes(props.sunInfo) : null);
const astroTwilightBegin = computed(() => sunTimes.value?.astroTwilightBegin ?? 0);
const astroTwilightEnd = computed(() => sunTimes.value?.astroTwilightEnd ?? 0);
const nauticalTwilightBegin = computed(() => sunTimes.value?.nauticalTwilightBegin ?? 0);
const nauticalTwilightEnd = computed(() => sunTimes.value?.nauticalTwilightEnd ?? 0);
const civilTwilightBegin = computed(() => sunTimes.value?.civilTwilightBegin ?? 0);
const civilTwilightEnd = computed(() => sunTimes.value?.civilTwilightEnd ?? 0);
const sunrise = computed(() => sunTimes.value?.sunrise ?? 0);
const sunset = computed(() => sunTimes.value?.sunset ?? 0);
const solarNoon = computed(() => sunTimes.value?.solarNoon ?? 0);

const formatMinutes = (minutes: number) => formatTime(minutes);

// Computed styles using the color props
const dialogStyles = computed(() => ({
  '--tint': `${props.bgHue}`,
  '--sat': `${props.bgSaturation}%`,
  '--light': `${props.bgLightness}%`,
  '--tint-comp': `${props.textHue}`,
  '--sat-text': `${props.textSaturation}%`,
  '--light-comp': `${props.textLightness}%`,
}));

const backdropStyles = computed(() => ({
  backgroundColor: `hsla(${props.bgHue}, ${props.bgSaturation}%, 0%, 0.5)`,
}));

const panelStyles = computed(() => ({
  backgroundColor: `hsl(${props.bgHue}, ${props.bgSaturation}%, ${props.bgLightness}%)`,
  color: `hsl(${props.textHue}, ${props.textSaturation}%, ${props.textLightness}%)`,
  borderColor: `hsla(${props.textHue}, ${props.textSaturation}%, ${props.textLightness}%, 0.2)`,
}));
</script>

<style scoped>
.dialog {
  position: relative;
  z-index: 50;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(4px);
}

.dialog-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.debug-panel {
  backdrop-filter: blur(10px);
  padding: 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.debug-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: inherit;
}

.close-button {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  opacity: 1;
}

.close-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.debug-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-family: monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  color: inherit;
}

.debug-content hr {
  border: none;
  border-top: 1px solid;
  border-color: inherit;
  opacity: 0.2;
  margin: 0.75rem 0;
}

.color-section {
  margin-top: 0.5rem;
}

.color-detail {
  margin-left: 1rem;
  opacity: 0.9;
}
</style>

