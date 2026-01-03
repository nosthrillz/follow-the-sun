<template>
  <main :style="{ '--dark': `${dark.toFixed(2)}%`}">
    <h1 class="text-9xl font-black">Follow the Sun</h1>
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
        <span class="value">{{ timeUntilNextEvent }}</span>
      </div>
      <div class="info-item">
        <span class="label">UI Darkness:</span>
        <span class="value">{{ blendPercentage.toFixed(2) }}%</span>
      </div>
    </div>
    <div class="sundial-container">
      <svg class="sundial" viewBox="0 0 200 200">
        <!-- Outer circle -->
        <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>

        <!-- Event markers -->
        <g v-if="sundialEvents.length > 0">
          <line
            v-for="event in sundialEvents"
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
            v-for="event in sundialEvents.filter(e => e.isMajor)"
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
          v-if="sunProgressAngle !== null"
          :d="getProgressArc(sunProgressAngle)"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          opacity="0.8"
          stroke-linecap="round"
        />

        <!-- Current sun position indicator -->
        <circle
          v-if="sunProgressAngle !== null"
          :cx="100 + 90 * Math.cos(sunProgressAngle)"
          :cy="100 + 90 * Math.sin(sunProgressAngle)"
          r="4"
          fill="currentColor"
        />

        <!-- Center dot -->
        <circle cx="100" cy="100" r="3" fill="currentColor" opacity="0.5"/>
      </svg>
    </div>
  </main>
</template>

<script setup lang="ts">

import {onMounted, ref} from "vue";

const dark = ref(50);
const currentTime = ref('--:--');
const nextEvent = ref('--');
const timeUntilNextEvent = ref('--');
const blendPercentage = ref(0);
const sundialEvents = ref<Array<{name: string; label: string; angle: number; isMajor: boolean}>>([]);
const sunProgressAngle = ref<number | null>(null);
let cachedSunInfo: SunInformation | null = null;

const lat = 47.3769
const lng = 8.5417

interface SunInformation  {
  results: {
    sunrise: string // ISO 8601 or Unix timestamp when formatted=0
    sunset: string
    solar_noon: string
    day_length: number // seconds when formatted=0
    civil_twilight_begin: string
    civil_twilight_end: string
    nautical_twilight_begin: string
    nautical_twilight_end: string
    astronomical_twilight_begin: string
    astronomical_twilight_end: string
  },
  status: string
  tzid?: string // timezone identifier when formatted=0
}

async function getSunInformation() {
  const response = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`);
  return await response.json() as SunInformation;
}

// Convert ISO 8601 timestamp to minutes since midnight (local time)
function timeToMinutes(timeStr: string): number {
  const date = new Date(timeStr);
  const localHours = date.getHours();
  const localMinutes = date.getMinutes();
  const localSeconds = date.getSeconds();
  return localHours * 60 + localMinutes + localSeconds / 60;
}

// Get current local time in minutes since midnight - for calculations and display
function getCurrentTimeMinutes(): number {
  const now = new Date();
  const localHours = now.getHours();
  const localMinutes = now.getMinutes();
  const localSeconds = now.getSeconds();
  return localHours * 60 + localMinutes + localSeconds / 60;
}

// Format minutes to HH:MM:SS
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.floor((minutes % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Format duration in minutes to human-readable string
function formatDuration(minutes: number): string {
  if (minutes < 0) return '--';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.floor((minutes % 1) * 60);

  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

interface Event {
  name: string;
  minutes: number;
}

function findNextEvent(sunInfo: SunInformation, currentMinutes: number): { event: string; minutesUntil: number } {
  const events: Event[] = [
    { name: 'Astronomical Twilight Begin', minutes: timeToMinutes(sunInfo.results.astronomical_twilight_begin) },
    { name: 'Nautical Twilight Begin', minutes: timeToMinutes(sunInfo.results.nautical_twilight_begin) },
    { name: 'Civil Twilight Begin', minutes: timeToMinutes(sunInfo.results.civil_twilight_begin) },
    { name: 'Sunrise', minutes: timeToMinutes(sunInfo.results.sunrise) },
    { name: 'Solar Noon', minutes: timeToMinutes(sunInfo.results.solar_noon) },
    { name: 'Sunset', minutes: timeToMinutes(sunInfo.results.sunset) },
    { name: 'Civil Twilight End', minutes: timeToMinutes(sunInfo.results.civil_twilight_end) },
    { name: 'Nautical Twilight End', minutes: timeToMinutes(sunInfo.results.nautical_twilight_end) },
    { name: 'Astronomical Twilight End', minutes: timeToMinutes(sunInfo.results.astronomical_twilight_end) },
    { name: 'Midnight', minutes: 24 * 60 },
  ];

  // Find the next event (could be today or tomorrow)
  let nextEvent: Event | null = null;
  let minMinutesUntil = Infinity;

  for (const event of events) {
    let minutesUntil = event.minutes - currentMinutes;

    // If event already passed today, check tomorrow
    if (minutesUntil <= 0) {
      minutesUntil += 24 * 60;
    }

    if (minutesUntil < minMinutesUntil) {
      minMinutesUntil = minutesUntil;
      nextEvent = event;
    }
  }

  return {
    event: nextEvent?.name ?? '--',
    minutesUntil: minMinutesUntil !== Infinity ? minMinutesUntil : 0
  };
}

// Linear interpolation helper
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Smooth step function for easing
function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

// Convert minutes since midnight to angle in radians
// 0 minutes (midnight) = -90° (top), going clockwise
function minutesToAngle(minutes: number): number {
  // Convert to 24-hour progress (0 to 1)
  const progress = minutes / (24 * 60);
  // Convert to angle: -90° + (progress * 360°)
  // -90° starts at top, then clockwise
  return (progress * 2 * Math.PI) - (Math.PI / 2);
}

// Get SVG path for progress arc from midnight to current position
function getProgressArc(currentAngle: number): string {
  const radius = 90;
  const centerX = 100;
  const centerY = 100;

  // Start at midnight (top, -90°)
  const startAngle = -Math.PI / 2;

  // Calculate start and end points
  const startX = centerX + radius * Math.cos(startAngle);
  const startY = centerY + radius * Math.sin(startAngle);
  const endX = centerX + radius * Math.cos(currentAngle);
  const endY = centerY + radius * Math.sin(currentAngle);

  // Determine if we need large arc (if angle > 180°)
  const angleDiff = currentAngle - startAngle;
  const largeArc = Math.abs(angleDiff) > Math.PI ? 1 : 0;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
}

// Calculate sundial events with angles
function calculateSundialEvents(sunInfo: SunInformation): Array<{name: string; label: string; angle: number; isMajor: boolean}> {
  const events = [
    { name: 'Astronomical Twilight Begin', label: 'Astro', minutes: timeToMinutes(sunInfo.results.astronomical_twilight_begin), isMajor: false },
    { name: 'Nautical Twilight Begin', label: 'Nautical', minutes: timeToMinutes(sunInfo.results.nautical_twilight_begin), isMajor: false },
    { name: 'Civil Twilight Begin', label: 'Civil', minutes: timeToMinutes(sunInfo.results.civil_twilight_begin), isMajor: false },
    { name: 'Sunrise', label: 'Sunrise', minutes: timeToMinutes(sunInfo.results.sunrise), isMajor: true },
    { name: 'Solar Noon', label: 'Noon', minutes: timeToMinutes(sunInfo.results.solar_noon), isMajor: true },
    { name: 'Sunset', label: 'Sunset', minutes: timeToMinutes(sunInfo.results.sunset), isMajor: true },
    { name: 'Civil Twilight End', label: 'Civil', minutes: timeToMinutes(sunInfo.results.civil_twilight_end), isMajor: false },
    { name: 'Nautical Twilight End', label: 'Nautical', minutes: timeToMinutes(sunInfo.results.nautical_twilight_end), isMajor: false },
    { name: 'Astronomical Twilight End', label: 'Astro', minutes: timeToMinutes(sunInfo.results.astronomical_twilight_end), isMajor: false },
  ];

  return events.map(event => ({
    name: event.name,
    label: event.label,
    angle: minutesToAngle(event.minutes),
    isMajor: event.isMajor
  }));
}

function calculateDarkValue(sunInfo: SunInformation): number {
  const currentMinutes = getCurrentTimeMinutes();

  // Get all event times
  const astroTwilightBegin = timeToMinutes(sunInfo.results.astronomical_twilight_begin);
  const astroTwilightEnd = timeToMinutes(sunInfo.results.astronomical_twilight_end);
  const nauticalTwilightBegin = timeToMinutes(sunInfo.results.nautical_twilight_begin);
  const nauticalTwilightEnd = timeToMinutes(sunInfo.results.nautical_twilight_end);
  const civilTwilightBegin = timeToMinutes(sunInfo.results.civil_twilight_begin);
  const civilTwilightEnd = timeToMinutes(sunInfo.results.civil_twilight_end);
  const sunrise = timeToMinutes(sunInfo.results.sunrise);
  const sunset = timeToMinutes(sunInfo.results.sunset);
  const solarNoon = timeToMinutes(sunInfo.results.solar_noon);

  // Handle day rollover (if current time is before sunrise, we might be in previous day's night)
  let prevAstroTwilightEnd = astroTwilightEnd;
  let nextAstroTwilightBegin = astroTwilightBegin;

  // If we're before astronomical twilight begin, we might be in the previous day's night
  if (currentMinutes < astroTwilightBegin) {
    prevAstroTwilightEnd = astroTwilightEnd - 24 * 60;
    if (currentMinutes > prevAstroTwilightEnd) {
      // We're in the deep night period before astronomical twilight
      const nightDuration = astroTwilightBegin - prevAstroTwilightEnd;
      const timeSinceEnd = currentMinutes - prevAstroTwilightEnd;
      const progress = timeSinceEnd / nightDuration;
      // Smooth transition from 100% to 95% as we approach astronomical twilight
      return lerp(100, 95, smoothStep(progress));
    }
  }

  // If we're after astronomical twilight end, we're in the next day's night
  if (currentMinutes > astroTwilightEnd) {
    nextAstroTwilightBegin = astroTwilightBegin + 24 * 60;
    if (currentMinutes < nextAstroTwilightBegin) {
      // We're in the deep night period after astronomical twilight
      const nightDuration = nextAstroTwilightBegin - astroTwilightEnd;
      const timeSinceEnd = currentMinutes - astroTwilightEnd;
      const progress = timeSinceEnd / nightDuration;
      // Smooth transition from 95% to 100% as we move away from astronomical twilight
      return lerp(95, 100, smoothStep(progress));
    }
  }

  // Astronomical twilight begin to nautical twilight begin: 95% -> 85%
  if (currentMinutes >= astroTwilightBegin && currentMinutes < nauticalTwilightBegin) {
    const duration = nauticalTwilightBegin - astroTwilightBegin;
    const progress = (currentMinutes - astroTwilightBegin) / duration;
    return lerp(95, 85, smoothStep(progress));
  }

  // Nautical twilight begin to civil twilight begin: 85% -> 70%
  if (currentMinutes >= nauticalTwilightBegin && currentMinutes < civilTwilightBegin) {
    const duration = civilTwilightBegin - nauticalTwilightBegin;
    const progress = (currentMinutes - nauticalTwilightBegin) / duration;
    return lerp(85, 70, smoothStep(progress));
  }

  // Civil twilight begin to sunrise: 70% -> 40%
  if (currentMinutes >= civilTwilightBegin && currentMinutes < sunrise) {
    const duration = sunrise - civilTwilightBegin;
    const progress = (currentMinutes - civilTwilightBegin) / duration;
    return lerp(70, 40, smoothStep(progress));
  }

  // Sunrise to solar noon: 40% -> 0%
  if (currentMinutes >= sunrise && currentMinutes < solarNoon) {
    const duration = solarNoon - sunrise;
    const progress = (currentMinutes - sunrise) / duration;
    return lerp(40, 0, smoothStep(progress));
  }

  // Solar noon to sunset: 0% -> 40%
  if (currentMinutes >= solarNoon && currentMinutes < sunset) {
    const duration = sunset - solarNoon;
    const progress = (currentMinutes - solarNoon) / duration;
    return lerp(0, 40, smoothStep(progress));
  }

  // Sunset to civil twilight end: 40% -> 70%
  if (currentMinutes >= sunset && currentMinutes < civilTwilightEnd) {
    const duration = civilTwilightEnd - sunset;
    const progress = (currentMinutes - sunset) / duration;
    return lerp(40, 70, smoothStep(progress));
  }

  // Civil twilight end to nautical twilight end: 70% -> 85%
  if (currentMinutes >= civilTwilightEnd && currentMinutes < nauticalTwilightEnd) {
    const duration = nauticalTwilightEnd - civilTwilightEnd;
    const progress = (currentMinutes - civilTwilightEnd) / duration;
    return lerp(70, 85, smoothStep(progress));
  }

  // Nautical twilight end to astronomical twilight end: 85% -> 95%
  if (currentMinutes >= nauticalTwilightEnd && currentMinutes < astroTwilightEnd) {
    const duration = astroTwilightEnd - nauticalTwilightEnd;
    const progress = (currentMinutes - nauticalTwilightEnd) / duration;
    return lerp(85, 95, smoothStep(progress));
  }

  // Fallback (shouldn't reach here, but just in case)
  return 100;
}

async function followTheSun() {
  try {
    const sunInfo = await getSunInformation();
    if (sunInfo.status === 'OK') {
      cachedSunInfo = sunInfo;
      updateDisplay(sunInfo);
    }
  } catch (error) {
    console.error('Error fetching sun information:', error);
  }
}

function updateDisplay(sunInfo: SunInformation) {
  const currentMinutes = getCurrentTimeMinutes();

  // Update dark value (using local time for calculations)
  const darkValue = calculateDarkValue(sunInfo);
  dark.value = Math.round(darkValue * 100) / 100; // Round to 2 decimal places for precision
  blendPercentage.value = Math.round(darkValue * 100) / 100; // Show 2 decimal places

  // Update current time (local time)
  currentTime.value = formatTime(currentMinutes);

  // Find and update next event (using local time)
  const { event, minutesUntil } = findNextEvent(sunInfo, currentMinutes);
  nextEvent.value = event;
  timeUntilNextEvent.value = formatDuration(minutesUntil);

  // Update sundial
  sundialEvents.value = calculateSundialEvents(sunInfo);
  sunProgressAngle.value = minutesToAngle(currentMinutes);
}

onMounted(() => {
  // Initial calculation
  followTheSun();

  // Update every second for smooth time display
  setInterval(() => {
    // Recalculate display if we have sun info cached
    if (cachedSunInfo) {
      updateDisplay(cachedSunInfo);
    }
  }, 1000);

  // Update sun information every minute (since it changes daily)
  setInterval(() => {
    followTheSun();
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
  --darker: min(var(--dark) + 20%, 100%);
  --light: calc(100% - var(--dark) + 10%);
  --bg: color-mix(in oklab, var(--base-light-color) var(--light), var(--base-dark-color) var(--dark));
  --bg-darker: color-mix(in oklab, var(--base-light-color) var(--light), var(--base-dark-color) var(--darker));

  background: radial-gradient(circle at bottom, var(--bg-darker) 0%, var(--bg) 100%);
  color: color-mix(in oklab, var(--base-dark-color) var(--light), var(--base-light-color) var(--dark));
}

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
