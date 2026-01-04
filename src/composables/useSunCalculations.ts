import { ref, computed, type Ref } from 'vue';
import { getMoonLux } from './useMoonCalculations';

export interface SunInformation {
  results: {
    sunrise: string
    sunset: string
    solar_noon: string
    day_length: number
    civil_twilight_begin: string
    civil_twilight_end: string
    nautical_twilight_begin: string
    nautical_twilight_end: string
    astronomical_twilight_begin: string
    astronomical_twilight_end: string
  },
  status: string
  tzid?: string
}

export interface SundialEvent {
  name: string;
  label: string;
  angle: number;
  isMajor: boolean;
}

// Convert ISO 8601 timestamp to minutes since midnight (local time)
export function timeToMinutes(timeStr: string): number {
  const date = new Date(timeStr);
  const localHours = date.getHours();
  const localMinutes = date.getMinutes();
  const localSeconds = date.getSeconds();
  return localHours * 60 + localMinutes + localSeconds / 60;
}

// Get time in minutes from hours, minutes, seconds
export function getTimeMinutes(hours: number, minutes: number, seconds: number): number {
  return hours * 60 + minutes + seconds / 60;
}

// Format minutes to HH:MM:SS
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.floor((minutes % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Format duration in minutes to human-readable string
export function formatDuration(minutes: number): string {
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

// Linear interpolation helper
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Smooth step function for easing
function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

// Light intensity (lux) reference points
const LUX_VALUES = {
  NIGHT_BASE: 0.001,            // Base night darkness (no moon)
  ASTRONOMICAL_TWILIGHT: 0.1,   // Very dim, but not quite night
  NAUTICAL_TWILIGHT: 1,          // Dim twilight
  CIVIL_TWILIGHT_MIN: 10,        // End of civil twilight
  SUNRISE_SUNSET: 100,
  CIVIL_TWILIGHT_MAX: 1000,
  OVERCAST_DAY: 25000,
  NOON_DIRECT_SUN: 100000,
  NOON_EQUATOR_MAX: 500000,
};

// Convert lux to darkness percentage (0-100%)
// Uses logarithmic scale since lux varies by orders of magnitude
function luxToDarkness(lux: number): number {
  // Clamp lux to reasonable range
  const minLux = LUX_VALUES.NIGHT_BASE;
  const maxLux = LUX_VALUES.NOON_DIRECT_SUN;
  
  // Use logarithmic scale: log10(lux) mapped to 0-100% darkness
  // Lower lux = higher darkness
  const logMin = Math.log10(minLux); // ~-3
  const logMax = Math.log10(maxLux); // ~5
  const logLux = Math.log10(Math.max(minLux, Math.min(maxLux, lux)));
  
  // Map log scale to darkness: logMin -> 100%, logMax -> 0%
  const linearDarkness = 100 - ((logLux - logMin) / (logMax - logMin)) * 100;
  
  // Apply a gentler curve for smoother transitions
  // Use ease-in-out cubic for more natural feel
  const normalized = linearDarkness / 100; // 0-1
  const t = normalized;
  const curved = t < 0.5 
    ? 4 * t * t * t  // Ease-in cubic for first half
    : 1 - Math.pow(-2 * t + 2, 3) / 2; // Ease-out cubic for second half
  const darkness = curved * 100;
  
  return Math.max(0, Math.min(100, darkness));
}

// Calculate approximate lux based on time and sun position
function calculateLux(
  minutes: number,
  sunrise: number,
  sunset: number,
  solarNoon: number,
  civilTwilightBegin: number,
  civilTwilightEnd: number,
  nauticalTwilightBegin: number,
  nauticalTwilightEnd: number,
  astroTwilightBegin: number,
  astroTwilightEnd: number,
  referenceDate?: Date
): number {
  // Define transition periods (in minutes) for smooth blending
  const TWILIGHT_TRANSITION = 30; // 30 minutes for smooth transition
  
  // Calculate transition boundaries
  const preDawnTransition = astroTwilightBegin - TWILIGHT_TRANSITION;
  const postDuskTransition = astroTwilightEnd + TWILIGHT_TRANSITION;
  
  // Get moon lux for reference
  const date = referenceDate || new Date();
  const dateWithTime = new Date(date);
  dateWithTime.setHours(Math.floor(minutes / 60));
  dateWithTime.setMinutes(minutes % 60);
  dateWithTime.setSeconds(0);
  const moonLux = getMoonLux(dateWithTime);
  
  // Calculate night progression for gradual lightening toward dawn
  const nightStart = astroTwilightEnd;
  const nightEnd = astroTwilightBegin + (24 * 60); // Next dawn (wrapping around midnight)
  
  // Deep night (between post-dusk and pre-dawn transitions)
  if (minutes < preDawnTransition || minutes > postDuskTransition) {
    // Just return moon lux - the darkest point of the night
    // The transitions on either side handle the gradual changes to/from astronomical twilight
    return moonLux;
  }
  
  // Pre-astronomical twilight transition: smooth blend from deep night to astro twilight
  if (minutes >= preDawnTransition && minutes < astroTwilightBegin) {
    const duration = astroTwilightBegin - preDawnTransition;
    const progress = (minutes - preDawnTransition) / duration;
    // Smooth ease-in-out curve: base night + moon → 0.1 lux
    const easedProgress = smoothStep(progress);
    const nightLux = LUX_VALUES.NIGHT_BASE + moonLux;
    return lerp(nightLux, LUX_VALUES.ASTRONOMICAL_TWILIGHT, easedProgress);
  }
  
  // Astronomical twilight begin to nautical twilight begin
  if (minutes >= astroTwilightBegin && minutes < nauticalTwilightBegin) {
    const duration = nauticalTwilightBegin - astroTwilightBegin;
    const progress = (minutes - astroTwilightBegin) / duration;
    // Gradual increase: 0.1 lux → 1 lux
    const easedProgress = smoothStep(progress);
    return lerp(LUX_VALUES.ASTRONOMICAL_TWILIGHT, LUX_VALUES.NAUTICAL_TWILIGHT, easedProgress);
  }
  
  // Nautical twilight begin to civil twilight begin
  if (minutes >= nauticalTwilightBegin && minutes < civilTwilightBegin) {
    const duration = civilTwilightBegin - nauticalTwilightBegin;
    const progress = (minutes - nauticalTwilightBegin) / duration;
    // Gradual increase: 1 lux → 10 lux
    const easedProgress = smoothStep(progress);
    return lerp(LUX_VALUES.NAUTICAL_TWILIGHT, LUX_VALUES.CIVIL_TWILIGHT_MIN, easedProgress);
  }
  
  // Civil twilight to sunrise (gentle transition)
  if (minutes >= civilTwilightBegin && minutes < sunrise) {
    const progress = (minutes - civilTwilightBegin) / (sunrise - civilTwilightBegin);
    // Gentle curve - stays darker longer, then accelerates
    const easedProgress = progress * progress;
    return lerp(LUX_VALUES.CIVIL_TWILIGHT_MIN, LUX_VALUES.SUNRISE_SUNSET, easedProgress);
  }
  
  // Sunrise to solar noon - dramatic increase, then gradual to peak
  if (minutes >= sunrise && minutes < solarNoon) {
    const duration = solarNoon - sunrise;
    const progress = (minutes - sunrise) / duration;
    
    // First 20%: dramatic sunrise (100 -> 1000 lux)
    // Remaining 80%: gradual increase to peak (1000 -> 100000 lux)
    if (progress < 0.2) {
      const earlyProgress = progress / 0.2;
      // Smooth exponential curve for sunrise moment
      const steepProgress = smoothStep(earlyProgress);
      return lerp(LUX_VALUES.SUNRISE_SUNSET, LUX_VALUES.CIVIL_TWILIGHT_MAX, steepProgress);
    } else {
      const lateProgress = (progress - 0.2) / 0.8;
      // Gentle ease-out curve - gradual increase, flatter near peak
      const curveProgress = 1 - Math.pow(1 - lateProgress, 2); // Ease-out quadratic
      return lerp(LUX_VALUES.CIVIL_TWILIGHT_MAX, LUX_VALUES.NOON_DIRECT_SUN, curveProgress);
    }
  }
  
  // Solar noon to sunset - flat peak, then gradual decrease
  if (minutes >= solarNoon && minutes < sunset) {
    const duration = sunset - solarNoon;
    const progress = (minutes - solarNoon) / duration;
    
    // First 50%: stay at peak (very flat midday)
    // Last 50%: gradual decrease approaching sunset
    if (progress < 0.5) {
      // Stay at peak with minimal variation - use smooth curve
      const earlyProgress = progress / 0.5;
      const smooth = 1 - (smoothStep(earlyProgress) * 0.05); // Smooth 5% reduction
      return LUX_VALUES.NOON_DIRECT_SUN * smooth;
    } else {
      const lateProgress = (progress - 0.5) / 0.5;
      // Smooth ease-in curve - starts gradual, accelerates near sunset
      const curveProgress = smoothStep(lateProgress);
      return lerp(LUX_VALUES.NOON_DIRECT_SUN * 0.95, LUX_VALUES.SUNRISE_SUNSET, curveProgress);
    }
  }
  
  // Sunset to civil twilight end - smooth decrease
  if (minutes >= sunset && minutes <= civilTwilightEnd) {
    const duration = civilTwilightEnd - sunset;
    const progress = (minutes - sunset) / duration;
    
    // Smooth decrease from sunset (100 lux) to civil twilight end (10 lux)
    // Use ease-in curve: starts gradual, accelerates toward end
    const easedProgress = progress * progress;
    return lerp(LUX_VALUES.SUNRISE_SUNSET, LUX_VALUES.CIVIL_TWILIGHT_MIN, easedProgress);
  }
  
  // Civil twilight end to nautical twilight end
  if (minutes > civilTwilightEnd && minutes <= nauticalTwilightEnd) {
    const duration = nauticalTwilightEnd - civilTwilightEnd;
    const progress = (minutes - civilTwilightEnd) / duration;
    // Gradual decrease: 10 lux → 1 lux
    const easedProgress = smoothStep(progress);
    return lerp(LUX_VALUES.CIVIL_TWILIGHT_MIN, LUX_VALUES.NAUTICAL_TWILIGHT, easedProgress);
  }
  
  // Nautical twilight end to astronomical twilight end
  if (minutes > nauticalTwilightEnd && minutes <= astroTwilightEnd) {
    const duration = astroTwilightEnd - nauticalTwilightEnd;
    const progress = (minutes - nauticalTwilightEnd) / duration;
    // Gradual decrease: 1 lux → 0.1 lux
    const easedProgress = smoothStep(progress);
    return lerp(LUX_VALUES.NAUTICAL_TWILIGHT, LUX_VALUES.ASTRONOMICAL_TWILIGHT, easedProgress);
  }
  
  // Post-astronomical twilight transition: smooth blend from astro twilight to deep night
  if (minutes > astroTwilightEnd && minutes <= postDuskTransition) {
    const duration = postDuskTransition - astroTwilightEnd;
    const progress = (minutes - astroTwilightEnd) / duration;
    // Smooth ease-in-out curve: 0.1 lux → base night + moon
    const easedProgress = smoothStep(progress);
    const nightLux = LUX_VALUES.NIGHT_BASE + moonLux;
    return lerp(LUX_VALUES.ASTRONOMICAL_TWILIGHT, nightLux, easedProgress);
  }
  
  // Deep night (fallback - darkest point)
  // Base night darkness + moon contribution
  // No moon: 0.001 lux (100% darkness)
  // Full moon: 0.001 + 0.27 = 0.271 lux (~90% darkness)
  return LUX_VALUES.NIGHT_BASE + moonLux;
}

// Convert minutes since midnight to angle in radians
export function minutesToAngle(minutes: number): number {
  const progress = minutes / (24 * 60);
  return (progress * 2 * Math.PI) - (Math.PI / 2);
}

// Convert angle in radians to minutes since midnight (inverse of minutesToAngle)
export function angleToMinutes(angle: number): number {
  // Normalize angle to [0, 2π)
  let normalizedAngle = angle % (2 * Math.PI);
  if (normalizedAngle < 0) {
    normalizedAngle += 2 * Math.PI;
  }
  
  // Convert from angle (starting at -π/2 for midnight) to progress [0, 1)
  // Angle starts at -π/2 (midnight), so we add π/2 to shift it
  const shiftedAngle = normalizedAngle + (Math.PI / 2);
  const progress = shiftedAngle / (2 * Math.PI);
  
  // Convert progress to minutes, wrapping to [0, 24*60)
  const minutes = (progress % 1) * (24 * 60);
  return minutes;
}

export function useSunCalculations(sunInfo: Ref<SunInformation | null>, currentMinutes: Ref<number>) {
  const calculateDarkValue = (): number => {
    if (!sunInfo.value) return 50;
    const minutes = currentMinutes.value;

    const civilTwilightBegin = timeToMinutes(sunInfo.value.results.civil_twilight_begin);
    const civilTwilightEnd = timeToMinutes(sunInfo.value.results.civil_twilight_end);
    const nauticalTwilightBegin = timeToMinutes(sunInfo.value.results.nautical_twilight_begin);
    const nauticalTwilightEnd = timeToMinutes(sunInfo.value.results.nautical_twilight_end);
    const astroTwilightBegin = timeToMinutes(sunInfo.value.results.astronomical_twilight_begin);
    const astroTwilightEnd = timeToMinutes(sunInfo.value.results.astronomical_twilight_end);
    const sunrise = timeToMinutes(sunInfo.value.results.sunrise);
    const sunset = timeToMinutes(sunInfo.value.results.sunset);
    const solarNoon = timeToMinutes(sunInfo.value.results.solar_noon);

    // Use today's date for moon calculations (even in demo mode, moon phase is based on actual date)
    const today = new Date();

    // Calculate approximate lux based on time of day
    const lux = calculateLux(
      minutes,
      sunrise,
      sunset,
      solarNoon,
      civilTwilightBegin,
      civilTwilightEnd,
      nauticalTwilightBegin,
      nauticalTwilightEnd,
      astroTwilightBegin,
      astroTwilightEnd,
      today
    );

    // Convert lux to darkness percentage using logarithmic scale
    return luxToDarkness(lux);
  };

  const calculateSundialEvents = (): SundialEvent[] => {
    if (!sunInfo.value) return [];

    const events = [
      { name: 'Astronomical Twilight Begin', label: 'Astro', minutes: timeToMinutes(sunInfo.value.results.astronomical_twilight_begin), isMajor: false },
      { name: 'Nautical Twilight Begin', label: 'Nautical', minutes: timeToMinutes(sunInfo.value.results.nautical_twilight_begin), isMajor: false },
      { name: 'Civil Twilight Begin', label: 'Civil', minutes: timeToMinutes(sunInfo.value.results.civil_twilight_begin), isMajor: false },
      { name: 'Sunrise', label: 'Sunrise', minutes: timeToMinutes(sunInfo.value.results.sunrise), isMajor: true },
      { name: 'Solar Noon', label: 'Noon', minutes: timeToMinutes(sunInfo.value.results.solar_noon), isMajor: true },
      { name: 'Sunset', label: 'Sunset', minutes: timeToMinutes(sunInfo.value.results.sunset), isMajor: true },
      { name: 'Civil Twilight End', label: 'Civil', minutes: timeToMinutes(sunInfo.value.results.civil_twilight_end), isMajor: false },
      { name: 'Nautical Twilight End', label: 'Nautical', minutes: timeToMinutes(sunInfo.value.results.nautical_twilight_end), isMajor: false },
      { name: 'Astronomical Twilight End', label: 'Astro', minutes: timeToMinutes(sunInfo.value.results.astronomical_twilight_end), isMajor: false },
    ];

    return events.map(event => ({
      name: event.name,
      label: event.label,
      angle: minutesToAngle(event.minutes),
      isMajor: event.isMajor
    }));
  };

  const findNextEvent = (): { event: string; minutesUntil: number } => {
    if (!sunInfo.value) return { event: '--', minutesUntil: 0 };
    const minutes = currentMinutes.value;

    interface Event {
      name: string;
      minutes: number;
    }

    const events: Event[] = [
      { name: 'Astronomical Twilight Begin', minutes: timeToMinutes(sunInfo.value.results.astronomical_twilight_begin) },
      { name: 'Nautical Twilight Begin', minutes: timeToMinutes(sunInfo.value.results.nautical_twilight_begin) },
      { name: 'Civil Twilight Begin', minutes: timeToMinutes(sunInfo.value.results.civil_twilight_begin) },
      { name: 'Sunrise', minutes: timeToMinutes(sunInfo.value.results.sunrise) },
      { name: 'Solar Noon', minutes: timeToMinutes(sunInfo.value.results.solar_noon) },
      { name: 'Sunset', minutes: timeToMinutes(sunInfo.value.results.sunset) },
      { name: 'Civil Twilight End', minutes: timeToMinutes(sunInfo.value.results.civil_twilight_end) },
      { name: 'Nautical Twilight End', minutes: timeToMinutes(sunInfo.value.results.nautical_twilight_end) },
      { name: 'Astronomical Twilight End', minutes: timeToMinutes(sunInfo.value.results.astronomical_twilight_end) },
      { name: 'Midnight', minutes: 24 * 60 },
    ];

    let nextEvent: Event | null = null;
    let minMinutesUntil = Infinity;

    for (const event of events) {
      let minutesUntil = event.minutes - minutes;

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
  };

  const darkValue = computed(() => {
    const value = calculateDarkValue();
    return Math.round(value * 100) / 100;
  });

  const currentLux = computed(() => {
    if (!sunInfo.value) return 0;
    const minutes = currentMinutes.value;
    const civilTwilightBegin = timeToMinutes(sunInfo.value.results.civil_twilight_begin);
    const civilTwilightEnd = timeToMinutes(sunInfo.value.results.civil_twilight_end);
    const nauticalTwilightBegin = timeToMinutes(sunInfo.value.results.nautical_twilight_begin);
    const nauticalTwilightEnd = timeToMinutes(sunInfo.value.results.nautical_twilight_end);
    const astroTwilightBegin = timeToMinutes(sunInfo.value.results.astronomical_twilight_begin);
    const astroTwilightEnd = timeToMinutes(sunInfo.value.results.astronomical_twilight_end);
    const sunrise = timeToMinutes(sunInfo.value.results.sunrise);
    const sunset = timeToMinutes(sunInfo.value.results.sunset);
    const solarNoon = timeToMinutes(sunInfo.value.results.solar_noon);
    const today = new Date();
    return calculateLux(minutes, sunrise, sunset, solarNoon, civilTwilightBegin, civilTwilightEnd, nauticalTwilightBegin, nauticalTwilightEnd, astroTwilightBegin, astroTwilightEnd, today);
  });

  const sundialEvents = computed(() => calculateSundialEvents());
  const sunProgressAngle = computed(() => minutesToAngle(currentMinutes.value));
  const nextEventInfo = computed(() => findNextEvent());

  return {
    darkValue,
    currentLux,
    sundialEvents,
    sunProgressAngle,
    nextEventInfo,
  };
}

