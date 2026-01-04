<template>
  <main :style="cssVariables" class="grid place-items-center">
    <!-- Front-drop overlay for smooth loading transition -->
    <div
      class="front-drop"
      :class="{ 'fade-out': isLoaded }"
      :style="{ pointerEvents: isLoaded ? 'none' : 'auto' }"
    ></div>
    <div class="flex flex-col items-center gap-4 md:gap-6 lg:gap-12">
      <h1 class="text-4xl md:text-6xl lg:text-8xl xl:text-9xl font-black">Follow the Sun</h1>
      <Sundial
        :events="sundialEvents"
        :progress-angle="sunProgressAngle"
        v-model="currentMinutes"
        :is-override="isOverrideMode"
        @dragging="handleDragging"
        @reset="handleReset"
      />
      <InfoDisplay
        :current-time="currentTime"
        :next-event="nextEventInfo.event"
        :time-until="formatDuration(nextEventInfo.minutesUntil)"
        :blend-percentage="darkValue"
      />
      <footer class="footer">
        <button class="debug-button" @click="isDebugOpen = true">
          Debug
        </button>
        <div class="attribution">
          Sun data from <a href="https://sunrise-sunset.org/" target="_blank" rel="noopener noreferrer">sunrise-sunset.org</a>
        </div>
      </footer>

      <DebugInfo
        :open="isDebugOpen"
        @close="isDebugOpen = false"
        :sun-info="sunInfo"
        :current-minutes="currentMinutes"
        :dark-value="darkValue"
        :text-contrast="textLightness"
        :current-lux="currentLux"
        :bg-hue="bgHue"
        :bg-saturation="bgSaturation"
        :bg-lightness="bgLightness"
        :bg-lightness-darker="bgLightnessDarker"
        :text-hue="textHue"
        :text-saturation="textSaturation"
        :text-lightness="textLightness"
      />
    </div>
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
const isDebugOpen = ref(false);
const isLoaded = ref(false);

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
  fetchSunInfo().finally(() => {
    // Wait a brief moment for initial render and color calculations, then start fade-out
    setTimeout(() => {
      isLoaded.value = true;
    }, 200);
  });

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

  /* HSL-based color system with tints based on time of day */
  /* Variables set dynamically from Vue computed properties */
  --tint: 0;              /* Hue: changes based on sun cycle */
  --sat: 0;               /* Saturation: kept low (10-15%) */
  --light: 0;             /* Lightness: inverse of darkness */
  --light-darker: 0;      /* Darker variant for gradient */
  --tint-comp: 0;          /* Complementary hue for text */
  --sat-text: 0;          /* Text saturation */
  --light-comp: 100%;        /* Complementary lightness for text */

  /* Background colors using HSL */
  --bg: hsl(var(--tint), var(--sat), var(--light));
  --bg-darker: hsl(var(--tint), var(--sat), var(--light-darker));

  /* Radial gradient background for depth */
  background: radial-gradient(circle at bottom, var(--bg-darker) 0%, var(--bg) 100%);

  /* Text color using complementary hue and inverted lightness */
  color: hsl(var(--tint-comp), var(--sat-text), var(--light-comp));
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  z-index: 100;
}

.debug-button {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.75rem;
  cursor: pointer;
  opacity: 0.8;
  color: hsl(var(--tint-comp), var(--sat-text), var(--light-comp));
  transition: opacity 0.2s ease;
}

.debug-button:hover {
  opacity: 1;
}

.attribution {
  opacity: 0.6;
}

.attribution a {
  color: inherit;
  text-decoration: underline;
}

.attribution a:hover {
  opacity: 1;
}

.front-drop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000000;
  z-index: 9999;
  opacity: 1;
  transition: opacity 1.5s ease-out;
  pointer-events: auto;
}

.front-drop.fade-out {
  opacity: 0;
  pointer-events: none;
}

</style>
