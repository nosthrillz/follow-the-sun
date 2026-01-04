import { computed, type Ref } from 'vue';
import { extractSunTimes, type SunInformation } from './useSunCalculations';

// Calculate hue based on the provided color table
// Hue values represent the sky color at different times of day
// Lightness is calculated separately from lux (physics-based)
function calculateHue(
  minutes: number,
  sunrise: number,
  sunset: number,
  solarNoon: number,
  civilTwilightBegin: number,
  civilTwilightEnd: number,
  nauticalTwilightBegin: number,
  nauticalTwilightEnd: number,
  astroTwilightBegin: number,
  astroTwilightEnd: number
): number {
  const dayLength = 24 * 60;
  
  // Helper to normalize hue differences (handles wraparound)
  function lerpHue(h1: number, h2: number, t: number): number {
    // Find shortest path between hues
    const diff = ((h2 - h1 + 540) % 360) - 180;
    return (h1 + diff * t + 360) % 360;
  }
  
  // Helper for linear interpolation
  function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }
  
  // Night (between astro twilight end and astro twilight begin, wrapping around midnight)
  const isNight = minutes > astroTwilightEnd || minutes < astroTwilightBegin;
  
  if (isNight) {
    const nightStart = astroTwilightEnd;
    let minutesIntoNight: number;
    let nightDuration: number;
    
    if (minutes > astroTwilightEnd) {
      // Evening/night: after astro twilight end
      const nightEnd = astroTwilightBegin + dayLength;
      nightDuration = nightEnd - nightStart;
      minutesIntoNight = minutes - nightStart;
    } else {
      // Early morning: before astro twilight begin
      nightDuration = (dayLength - nightStart) + astroTwilightBegin;
      minutesIntoNight = (dayLength - nightStart) + minutes;
    }
    
    const progress = minutesIntoNight / nightDuration;
    const midnightProgress = Math.abs(progress - 0.5) * 2; // 0 at midnight, 1 at edges
    
    // Night hue: deep blue (240°) at midnight, lighter blue (235°) at edges
    return lerpHue(240, 235, midnightProgress);
  }

  // Astronomical Twilight (begin)
  if (minutes >= astroTwilightBegin && minutes < nauticalTwilightBegin) {
    const progress = (minutes - astroTwilightBegin) / (nauticalTwilightBegin - astroTwilightBegin);
    // Astro to Nautical: 230° → 225°
    return lerpHue(230, 225, progress);
  }

  // Nautical Twilight (begin)
  if (minutes >= nauticalTwilightBegin && minutes < civilTwilightBegin) {
    const progress = (minutes - nauticalTwilightBegin) / (civilTwilightBegin - nauticalTwilightBegin);
    // Nautical to Blue Hour: 225° → 215°
    return lerpHue(225, 215, progress);
  }

  // Civil Twilight / Blue Hour (morning)
  if (minutes >= civilTwilightBegin && minutes < sunrise) {
    const progress = (minutes - civilTwilightBegin) / (sunrise - civilTwilightBegin);
    // Blue Hour (215°) → Golden Hour (35°) → Sunrise (15°)
    if (progress < 0.5) {
      const t = progress * 2;
      return lerpHue(215, 35, t);
    } else {
      const t = (progress - 0.5) * 2;
      return lerpHue(35, 15, t);
    }
  }

  // Sunrise to Morning Light
  if (minutes >= sunrise && minutes < solarNoon) {
    const progress = (minutes - sunrise) / (solarNoon - sunrise);
    // Sunrise (15°) → Morning Light (205°) → Solar Noon (210°)
    if (progress < 0.3) {
      const t = progress / 0.3;
      return lerpHue(15, 205, t);
    } else {
      const t = (progress - 0.3) / 0.7;
      return lerpHue(205, 210, t);
    }
  }

  // Solar Noon to Afternoon Light
  if (minutes >= solarNoon && minutes < sunset) {
    const progress = (minutes - solarNoon) / (sunset - solarNoon);
    // Solar Noon (210°) → Afternoon Light (205°) → Sunset (15°)
    if (progress < 0.3) {
      const t = progress / 0.3;
      return lerpHue(210, 205, t);
    } else {
      const t = (progress - 0.3) / 0.7;
      return lerpHue(205, 15, t);
    }
  }

  // Sunset to Civil Twilight End
  if (minutes >= sunset && minutes <= civilTwilightEnd) {
    const progress = (minutes - sunset) / (civilTwilightEnd - sunset);
    // Sunset (15°) → Golden Hour (30°) → Blue Hour (220°)
    if (progress < 0.4) {
      const t = progress / 0.4;
      return lerpHue(15, 30, t);
    } else {
      const t = (progress - 0.4) / 0.6;
      return lerpHue(30, 220, t);
    }
  }

  // Civil Twilight End to Nautical Twilight End
  if (minutes > civilTwilightEnd && minutes <= nauticalTwilightEnd) {
    const progress = (minutes - civilTwilightEnd) / (nauticalTwilightEnd - civilTwilightEnd);
    // Blue Hour (220°) → Nautical (230°)
    return lerpHue(220, 230, progress);
  }

  // Nautical Twilight End to Astronomical Twilight End
  if (minutes > nauticalTwilightEnd && minutes <= astroTwilightEnd) {
    const progress = (minutes - nauticalTwilightEnd) / (astroTwilightEnd - nauticalTwilightEnd);
    // Nautical (230°) → Astro (240°)
    return lerpHue(230, 240, progress);
  }

  // Default to deep night blue
  return 240;
}

// Calculate saturation based on time of day
// Keep saturation in 10-15% range as specified
function calculateSaturation(
  minutes: number,
  sunrise: number,
  sunset: number,
  solarNoon: number,
  civilTwilightBegin: number,
  civilTwilightEnd: number
): number {
  // Keep saturation subtle overall (10-15% range)
  // Slightly higher during sunrise/sunset for warmth
  // Lower at noon (more white) and night (more neutral)
  
  const isDay = minutes >= sunrise && minutes < sunset;
  const isTwilight = (minutes >= civilTwilightBegin && minutes < sunrise) || 
                    (minutes >= sunset && minutes <= civilTwilightEnd);
  
  if (isDay) {
    // During day: lower saturation near noon, slightly higher near sunrise/sunset
    const distanceFromNoon = Math.abs(minutes - solarNoon);
    const maxDistance = Math.max(solarNoon - sunrise, sunset - solarNoon);
    const normalizedDistance = Math.min(1, distanceFromNoon / maxDistance);
    
    // At noon: 10% (nearly white), at edges: 15% (subtle color)
    return 10 + (normalizedDistance * 5);
  } else if (isTwilight) {
    // During twilight: moderate saturation (12-15%)
    const isMorningTwilight = minutes < sunrise;
    const twilightStart = isMorningTwilight ? civilTwilightBegin : sunset;
    const twilightEnd = isMorningTwilight ? sunrise : civilTwilightEnd;
    const progress = (minutes - twilightStart) / (twilightEnd - twilightStart);
    return 12 + (progress * 3); // 12% to 15%
  } else {
    // Night: low saturation (10-12%)
    return 10 + (Math.sin(minutes / 60 * Math.PI * 2) * 0.5 + 0.5) * 2; // Slight variation
  }
}

// Calculate complementary hue (opposite on color wheel)
function getComplementaryHue(hue: number): number {
  return (hue + 180) % 360;
}

export function useColorCalculations(
  sunInfo: Ref<SunInformation | null>,
  currentMinutes: Ref<number>,
  darkValue: Ref<number>
) {
  // Calculate background hue based on time periods (sky colors)
  const bgHue = computed(() => {
    if (!sunInfo.value) return 240;
    
    const minutes = currentMinutes.value;
    const times = extractSunTimes(sunInfo.value);

    return calculateHue(
      minutes,
      times.sunrise,
      times.sunset,
      times.solarNoon,
      times.civilTwilightBegin,
      times.civilTwilightEnd,
      times.nauticalTwilightBegin,
      times.nauticalTwilightEnd,
      times.astroTwilightBegin,
      times.astroTwilightEnd
    );
  });

  const bgSaturation = computed(() => {
    if (!sunInfo.value) return 10;
    
    const minutes = currentMinutes.value;
    const times = extractSunTimes(sunInfo.value);

    return calculateSaturation(minutes, times.sunrise, times.sunset, times.solarNoon, times.civilTwilightBegin, times.civilTwilightEnd);
  });

  // Calculate background lightness from darkness (lux-based, continuous)
  const bgLightness = computed(() => {
    // Lightness is inverse of darkness
    return 100 - darkValue.value;
  });

  // Calculate darker variant for gradient (slightly darker)
  const bgLightnessDarker = computed(() => {
    const lightness = bgLightness.value;
    // Ensure we don't go below 0% or above 100%
    return Math.max(0, Math.min(100, lightness - 10));
  });

  // Calculate text color with complementary hue
  const textHue = computed(() => {
    return getComplementaryHue(bgHue.value);
  });

  const textSaturation = computed(() => {
    // Text saturation: slightly higher than background for better contrast, but still subtle
    return Math.min(20, bgSaturation.value * 1.5);
  });

  const textLightness = computed(() => {
    // Text lightness: inverse of background lightness for contrast
    // If background is dark (low lightness), text should be light (high lightness)
    // If background is light (high lightness), text should be dark (low lightness)
    const bgLight = bgLightness.value;
    const inverseLightness = 100 - bgLight;
    
    // Ensure good contrast: push text towards extremes
    // Dark backgrounds → light text (85-95% lightness)
    // Light backgrounds → dark text (5-15% lightness)
    const contrastLightness = bgLight < 50 
      ? Math.max(85, Math.min(95, inverseLightness + 20)) // Light text on dark bg
      : Math.min(15, Math.max(5, inverseLightness - 20)); // Dark text on light bg
    
    return contrastLightness;
  });

  return {
    // HSL component values for CSS variables
    bgHue,
    bgSaturation,
    bgLightness,
    bgLightnessDarker,
    textHue,
    textSaturation,
    textLightness,
  };
}

