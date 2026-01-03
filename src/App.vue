<template>
  <main :style="{ '--dark': `${darkValue.toFixed(2)}%`, '--text-contrast': `${textContrastComputed.toFixed(2)}%` }">
    <TimeControls v-model="currentMinutes" />
    <DebugInfo 
      :sun-info="sunInfo"
      :current-minutes="currentMinutes"
      :dark-value="darkValue"
      :text-contrast="textContrastComputed"
      :current-lux="currentLux"
    />
    <h1 class="text-9xl font-black">Follow the Sun</h1>
    <InfoDisplay
      :current-time="currentTime"
      :next-event="nextEventInfo.event"
      :time-until="formatDuration(nextEventInfo.minutesUntil)"
      :blend-percentage="darkValue"
    />
    <Sundial
      :events="sundialEvents"
      :progress-angle="sunProgressAngle"
    />
    <footer class="attribution">
      Sun data from <a href="https://sunrise-sunset.org/" target="_blank" rel="noopener noreferrer">sunrise-sunset.org</a>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import { useSunCalculations, type SunInformation, formatTime, formatDuration, getTimeMinutes } from "./composables/useSunCalculations";
import Sundial from "./components/Sundial.vue";
import InfoDisplay from "./components/InfoDisplay.vue";
import TimeControls from "./components/TimeControls.vue";
import DebugInfo from "./components/DebugInfo.vue";

const lat = 47.3769;
const lng = 8.5417;

// Time state - can be controlled by demo mode or real time
const currentMinutes = ref(0);

// Sun information state
const sunInfo = ref<SunInformation | null>(null);

// Get sun information from API
async function getSunInformation(): Promise<SunInformation> {
  const response = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`);
  return await response.json() as SunInformation;
}

// Use the composable for calculations
const { darkValue, currentLux, sundialEvents, sunProgressAngle, nextEventInfo } = useSunCalculations(
  sunInfo,
  currentMinutes
);

// Computed current time display
const currentTime = computed(() => formatTime(currentMinutes.value));

// Computed text contrast value - ensures text is always readable
// Uses hysteresis to avoid sudden flips and creates more natural contrast
const textContrast = ref(50); // Track previous value for hysteresis

const textContrastComputed = computed(() => {
  const dark = darkValue.value;
  const previous = textContrast.value;
  
  // Use hysteresis: different thresholds for switching up vs down
  // This prevents rapid flipping when hovering around 50%
  const thresholdUp = 42;   // Switch to light text when going above this
  const thresholdDown = 58; // Switch to dark text when going below this
  const extremeContrast = 75; // Push to extremes for maximum readability
  
  let newContrast: number;
  
  // Determine if we should use light or dark text
  if (dark < thresholdDown && (previous < 50 || dark < thresholdUp)) {
    // Lighter background - use DARK text
    // Push text to near maximum darkness (85-100%) for strong contrast
    newContrast = Math.min(100, Math.max(dark + extremeContrast, 90));
  } else if (dark > thresholdUp && (previous >= 50 || dark > thresholdDown)) {
    // Darker background - use LIGHT text  
    // Push text to near minimum darkness (0-10%) for strong contrast
    newContrast = Math.max(0, Math.min(dark - extremeContrast, 10));
  } else {
    // In the transition zone - maintain current state to avoid flipping
    newContrast = previous;
  }
  
  // Smooth transition to avoid sudden jumps (but allow faster transitions)
  const smoothingFactor = Math.abs(newContrast - previous) > 30 ? 0.5 : 0.2; // Faster when big change needed
  const smoothed = previous + (newContrast - previous) * smoothingFactor;
  textContrast.value = smoothed;
  
  return smoothed;
});

// Watch for changes in currentMinutes to update calculations
watch(currentMinutes, () => {
  // Calculations are reactive through the composable
}, { immediate: true });

// Watch for changes in sunInfo to update calculations
watch(sunInfo, () => {
  // Calculations are reactive through the composable
}, { immediate: true });

// Initialize current time
function getCurrentTimeMinutes(): number {
  const now = new Date();
  return getTimeMinutes(now.getHours(), now.getMinutes(), now.getSeconds());
}

// Fetch and update sun information
async function fetchSunInfo() {
  try {
    const data = await getSunInformation();
    if (data.status === 'OK') {
      sunInfo.value = data;
    }
  } catch (error) {
    console.error('Error fetching sun information:', error);
  }
}

onMounted(() => {
  // Initialize with current time
  currentMinutes.value = getCurrentTimeMinutes();
  
  // Fetch sun information
  fetchSunInfo();

  // TimeControls handles time updates (both real-time and demo mode)

  // Update sun information every minute (since it changes daily)
  setInterval(() => {
    fetchSunInfo();
  }, 60000);
})
</script>


<style scoped>
main {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 25vh;
  gap: 2rem;

  --base-light-color: #fffde9;
  --base-dark-color: #141821;

  --dark: 50%;
  --text-contrast: 50%;
  --darker: min(var(--dark) + 20%, 100%);
  --light: calc(100% - var(--dark) + 10%);
  
  /* Background: mix based on darkness value */
  --bg: color-mix(in oklab, var(--base-light-color) var(--light), var(--base-dark-color) var(--dark));
  --bg-darker: color-mix(in oklab, var(--base-light-color) var(--light), var(--base-dark-color) var(--darker));

  background: radial-gradient(circle at bottom, var(--bg-darker) 0%, var(--bg) 100%);
  
  /* Text: use more extreme mixing for better contrast
     When text-contrast is high (>50%), we want dark text (more dark color)
     When text-contrast is low (<50%), we want light text (more light color)
     Use a wider range to push colors further apart */
  --text-dark-amount: var(--text-contrast);
  --text-light-amount: calc(100% - var(--text-contrast));
  color: color-mix(in oklab, var(--base-light-color) var(--text-light-amount), var(--base-dark-color) var(--text-dark-amount));
}

.attribution {
  position: fixed;
  bottom: 0.5rem;
  right: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.6;
  z-index: 100;
}

.attribution a {
  color: inherit;
  text-decoration: underline;
}

.attribution a:hover {
  opacity: 1;
}

</style>
