<template>
  <main :style="cssVariables">
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
      v-model="currentMinutes"
      :is-override="isOverrideMode"
      @dragging="handleDragging"
      @reset="handleReset"
    />
    <footer class="attribution">
      Sun data from <a href="https://sunrise-sunset.org/" target="_blank" rel="noopener noreferrer">sunrise-sunset.org</a>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import { useSunCalculations, type SunInformation, formatTime, formatDuration, getTimeMinutes } from "./composables/useSunCalculations";
import { useColorCalculations } from "./composables/useColorCalculations";
import Sundial from "./components/Sundial.vue";
import InfoDisplay from "./components/InfoDisplay.vue";
import DebugInfo from "./components/DebugInfo.vue";

const lat = 47.3769;
const lng = 8.5417;

// Time state - can be controlled by override mode or real time
const currentMinutes = ref(0);
const isDragging = ref(false);
const isOverrideMode = ref(false);

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

// Use color calculations composable
const { bgHue, bgSaturation, bgLightness, bgLightnessDarker, textHue, textSaturation, textLightness } = useColorCalculations(
  sunInfo,
  currentMinutes,
  darkValue
);

// Computed current time display
const currentTime = computed(() => formatTime(currentMinutes.value));

// Computed text contrast value - kept for backward compatibility with DebugInfo
const textContrastComputed = computed(() => {
  // Text lightness is already computed by useColorCalculations
  // This is just for display in DebugInfo
  return textLightness.value;
});

// CSS variables object for dynamic styling
const cssVariables = computed(() => ({
  '--tint': `${bgHue.value}`,
  '--sat': `${bgSaturation.value}%`,
  '--light': `${bgLightness.value}%`,
  '--light-darker': `${bgLightnessDarker.value}%`,
  '--tint-comp': `${textHue.value}`,
  '--sat-text': `${textSaturation.value}%`,
  '--light-comp': `${textLightness.value}%`,
}));

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

// Handle dragging state from sundial
function handleDragging(dragging: boolean) {
  isDragging.value = dragging;
  if (dragging) {
    isOverrideMode.value = true;
  }
}

// Handle reset from sundial
function handleReset() {
  const now = new Date();
  currentMinutes.value = getTimeMinutes(now.getHours(), now.getMinutes(), now.getSeconds());
  isOverrideMode.value = false;
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

// Real-time ticker - updates time every second when not in override mode
let realTimeInterval: number | null = null;

watch([isOverrideMode, isDragging], ([override, dragging]) => {
  if (!override && !dragging) {
    // Start real-time sync only if not in override mode and not dragging
    if (realTimeInterval === null) {
      realTimeInterval = setInterval(() => {
        // Double-check we're still not in override mode or dragging
        if (!isOverrideMode.value && !isDragging.value) {
          const now = new Date();
          currentMinutes.value = getTimeMinutes(now.getHours(), now.getMinutes(), now.getSeconds());
        }
      }, 1000) as unknown as number;
    }
  } else {
    // Stop real-time sync
    if (realTimeInterval !== null) {
      clearInterval(realTimeInterval);
      realTimeInterval = null;
    }
  }
}, { immediate: true });

onMounted(() => {
  // Initialize with current time
  currentMinutes.value = getCurrentTimeMinutes();
  
  // Fetch sun information
  fetchSunInfo();

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

  /* HSL-based color system with tints based on time of day */
  /* Variables set dynamically from Vue computed properties */
  --tint: 240;              /* Hue: changes based on sun cycle */
  --sat: 10%;               /* Saturation: kept low (10-15%) */
  --light: 50%;             /* Lightness: inverse of darkness */
  --light-darker: 40%;      /* Darker variant for gradient */
  --tint-comp: 60;          /* Complementary hue for text */
  --sat-text: 15%;          /* Text saturation */
  --light-comp: 50%;        /* Complementary lightness for text */
  
  /* Background colors using HSL */
  --bg: hsl(var(--tint), var(--sat), var(--light));
  --bg-darker: hsl(var(--tint), var(--sat), var(--light-darker));

  /* Radial gradient background for depth */
  background: radial-gradient(circle at bottom, var(--bg-darker) 0%, var(--bg) 100%);
  
  /* Text color using complementary hue and inverted lightness */
  color: hsl(var(--tint-comp), var(--sat-text), var(--light-comp));
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
