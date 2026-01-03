import { computed, type Ref } from 'vue';
import { timeToMinutes, type SunInformation } from './useSunCalculations';

// Convert HSL to hex color
function hslToHex(h: number, s: number, l: number): string {
  // Normalize values
  h = h % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Calculate hue based on sun cycle (Rayleigh scattering)
// Night: blue (240°), Sunrise: deep blue→lighter blue→yellow (240°→220°→60°, skipping green), Day: yellow-white (60°), Sunset: red→blue (0°→240°, via purple/magenta, skipping green)
function calculateHue(
  minutes: number,
  sunrise: number,
  sunset: number,
  solarNoon: number,
  civilTwilightBegin: number,
  civilTwilightEnd: number
): number {
  const dayLength = 24 * 60;
  
  // Normalize minutes to handle day transitions
  let normalizedMinutes = minutes;
  if (normalizedMinutes < civilTwilightBegin) {
    normalizedMinutes += dayLength;
  }

  // Night (before civil twilight or after civil twilight end)
  if (minutes < civilTwilightBegin || minutes > civilTwilightEnd) {
    // Stay blue throughout the night - no cyan/green tints
    // Simple variation: slightly deeper blue at deepest night
    const nightStart = civilTwilightEnd;
    const nightEnd = civilTwilightBegin + (24 * 60); // Next dawn (wrapping around midnight)
    const nightDuration = nightEnd - nightStart;
    
    let minutesIntoNight: number;
    if (minutes > civilTwilightEnd) {
      // After dusk, before midnight
      minutesIntoNight = minutes - nightStart;
    } else {
      // After midnight, before dawn
      minutesIntoNight = (24 * 60 - nightStart) + minutes;
    }
    
    const progress = minutesIntoNight / nightDuration; // 0 to 1 through the night
    
    // Transition through the night - stay in blue range (235°-245°)
    // Start: blue (240°) where sunset ended
    // Middle: deeper blue (245°) at deepest night
    // End: lighter blue (235°) as we approach dawn
    if (progress < 0.4) {
      // First 40% of night: blue (240°) → deeper blue (245°)
      const earlyProgress = progress / 0.4;
      return 240 + (earlyProgress * 5); // 240° → 245°
    } else if (progress < 0.6) {
      // Middle 20% of night: stay at deeper blue (245°)
      return 245;
    } else {
      // Last 40% of night: deeper blue (245°) → lighter blue (235°)
      const lateProgress = (progress - 0.6) / 0.4;
      return 245 - (lateProgress * 10); // 245° → 235°
    }
  }

  // Civil twilight before sunrise: deep blue → lighter blue → yellow (skip green/cyan)
  if (minutes >= civilTwilightBegin && minutes < sunrise) {
    const progress = (minutes - civilTwilightBegin) / (sunrise - civilTwilightBegin);
    
    // First 40%: deep blue (240°) → lighter blue (220°)
    // Next 60%: lighter blue (220°) → yellow (60°), skipping green/cyan range
    // To avoid green (120°-180°), we go forwards through purple/magenta/red: 220° → 240° → 300° → 0° → 60°
    if (progress < 0.4) {
      // First 40%: deep blue (240°) → lighter blue (220°)
      const earlyProgress = progress / 0.4;
      return 240 - (earlyProgress * 20); // 240° → 220°
    } else {
      // Last 60%: lighter blue (220°) → yellow (60°)
      // Go forwards through purple/magenta/red to avoid green: 220° → 240° → 300° → 0° → 60°
      const lateProgress = (progress - 0.4) / 0.6;
      // Distance going forwards: from 220° to 60° = (60 - 220 + 360) % 360 = 200°
      // Formula: start at 220°, add 200° * progress, wrap around
      return (220 + (200 * lateProgress)) % 360;
    }
  }

  // Sunrise to solar noon: red → yellow → white-yellow
  if (minutes >= sunrise && minutes < solarNoon) {
    const progress = (minutes - sunrise) / (solarNoon - sunrise);
    
    // First 30%: red (0°) → orange (30°)
    // Next 40%: orange (30°) → yellow (60°)
    // Last 30%: yellow (60°) → white-yellow (60°, but we'll handle saturation separately)
    if (progress < 0.3) {
      return 0 + (progress / 0.3) * 30;
    } else if (progress < 0.7) {
      return 30 + ((progress - 0.3) / 0.4) * 30;
    } else {
      return 60; // Stay at yellow, saturation will decrease
    }
  }

  // Solar noon to sunset: yellow-white → yellow → orange → red
  if (minutes >= solarNoon && minutes < sunset) {
    const progress = (minutes - solarNoon) / (sunset - solarNoon);
    
    // First 50%: stay at yellow (60°)
    // Last 50%: yellow (60°) → orange (30°) → red (0°)
    if (progress < 0.5) {
      return 60;
    } else {
      const lateProgress = (progress - 0.5) / 0.5;
      return 60 - (lateProgress * 60);
    }
  }

  // Sunset to civil twilight end: red → orange → blue
  if (minutes >= sunset && minutes <= civilTwilightEnd) {
    const progress = (minutes - sunset) / (civilTwilightEnd - sunset);
    
    // First 30%: red (0°) → orange (20°)
    // Next 30%: orange (20°) → red (0°) - deepening red
    // Last 40%: red (0°) → blue (240°) - wrap through purple/magenta
    if (progress < 0.3) {
      return 0 + (progress / 0.3) * 20;
    } else if (progress < 0.6) {
      const midProgress = (progress - 0.3) / 0.3;
      return 20 - (midProgress * 20); // Back to red
    } else {
      const lateProgress = (progress - 0.6) / 0.4;
      // From red (0°) to blue (240°) - go backwards through purple/magenta to avoid green
      // Go backwards: 0° → 300° → 240° (120° backwards total)
      return (360 - (lateProgress * 120)) % 360;
    }
  }

  return 240; // Default to blue (night)
}

// Calculate saturation based on time of day
// Low saturation overall (10-15% as specified)
function calculateSaturation(
  minutes: number,
  sunrise: number,
  sunset: number,
  solarNoon: number,
  civilTwilightBegin: number,
  civilTwilightEnd: number,
  darkValue: number
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
    
    // At noon: 8% (nearly white), at edges: 15% (subtle color)
    return 8 + (normalizedDistance * 7);
  } else if (isTwilight) {
    // During twilight: moderate saturation (12-15%)
    const isMorningTwilight = minutes < sunrise;
    const twilightStart = isMorningTwilight ? civilTwilightBegin : sunset;
    const twilightEnd = isMorningTwilight ? sunrise : civilTwilightEnd;
    const progress = (minutes - twilightStart) / (twilightEnd - twilightStart);
    return 12 + (progress * 3); // 12% to 15%
  } else {
    // Night: low saturation (10-12%)
    return 10 + (darkValue / 100 * 2); // Slight variation based on darkness
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
  // Calculate background HSL components
  const bgHue = computed(() => {
    if (!sunInfo.value) return 0;
    
    const minutes = currentMinutes.value;
    const sunrise = timeToMinutes(sunInfo.value.results.sunrise);
    const sunset = timeToMinutes(sunInfo.value.results.sunset);
    const solarNoon = timeToMinutes(sunInfo.value.results.solar_noon);
    const civilTwilightBegin = timeToMinutes(sunInfo.value.results.civil_twilight_begin);
    const civilTwilightEnd = timeToMinutes(sunInfo.value.results.civil_twilight_end);

    return calculateHue(minutes, sunrise, sunset, solarNoon, civilTwilightBegin, civilTwilightEnd);
  });

  const bgSaturation = computed(() => {
    if (!sunInfo.value) return 10;
    
    const minutes = currentMinutes.value;
    const sunrise = timeToMinutes(sunInfo.value.results.sunrise);
    const sunset = timeToMinutes(sunInfo.value.results.sunset);
    const solarNoon = timeToMinutes(sunInfo.value.results.solar_noon);
    const civilTwilightBegin = timeToMinutes(sunInfo.value.results.civil_twilight_begin);
    const civilTwilightEnd = timeToMinutes(sunInfo.value.results.civil_twilight_end);

    return calculateSaturation(minutes, sunrise, sunset, solarNoon, civilTwilightBegin, civilTwilightEnd, darkValue.value);
  });

  const bgLightness = computed(() => {
    // Lightness: inverse of darkValue (darkValue 0% = lightness 100%, darkValue 100% = lightness 0%)
    // But we never reach pure black/white, so clamp to 5%-95%
    const lightness = 100 - darkValue.value;
    return Math.max(5, Math.min(95, lightness));
  });

  // Calculate darker variant for gradient (slightly darker)
  const bgLightnessDarker = computed(() => {
    const lightness = bgLightness.value;
    return Math.max(5, Math.min(95, lightness - 10));
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

  // Computed colors as hex for compatibility (if needed)
  const backgroundColor = computed(() => {
    return hslToHex(bgHue.value, bgSaturation.value, bgLightness.value);
  });

  const backgroundColorDarker = computed(() => {
    return hslToHex(bgHue.value, bgSaturation.value, bgLightnessDarker.value);
  });

  const textColor = computed(() => {
    return hslToHex(textHue.value, textSaturation.value, textLightness.value);
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
    // Hex colors for backward compatibility
    backgroundColor,
    backgroundColorDarker,
    textColor,
  };
}

