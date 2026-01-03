// Moon phase and illumination calculations
// Based on astronomical formulas for moon phase calculation

/**
 * Calculate the Julian Day Number for a given date
 */
function julianDay(date: Date): number {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  
  let a, b;
  if (month <= 2) {
    year--;
    month += 12;
  }
  a = Math.floor(year / 100);
  b = 2 - a + Math.floor(a / 4);
  
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5 + hour / 24;
}

/**
 * Calculate days since the last new moon (reference: Jan 6, 2000 18:14 UTC)
 */
function daysSinceNewMoon(date: Date): number {
  const referenceNewMoon = new Date('2000-01-06T18:14:00Z');
  const referenceJD = julianDay(referenceNewMoon);
  const currentJD = julianDay(date);
  
  // Synodic month = 29.53058867 days
  const synodicMonth = 29.53058867;
  const daysSince = currentJD - referenceJD;
  
  // Get the phase within the current cycle
  return ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
}

/**
 * Calculate moon phase (0 = new moon, 0.5 = full moon, 1 = new moon again)
 */
export function getMoonPhase(date: Date = new Date()): number {
  const days = daysSinceNewMoon(date);
  const synodicMonth = 29.53058867;
  return days / synodicMonth;
}

/**
 * Calculate moon illumination percentage (0-100%)
 * 0% = new moon, 100% = full moon
 */
export function getMoonIllumination(date: Date = new Date()): number {
  const phase = getMoonPhase(date);
  
  // Illumination is based on the angle between sun and moon
  // At new moon (phase 0): 0% illuminated
  // At full moon (phase 0.5): 100% illuminated
  // At new moon again (phase 1): 0% illuminated
  
  if (phase < 0.5) {
    // Waxing (0 to 0.5): increasing illumination
    return phase * 2 * 100;
  } else {
    // Waning (0.5 to 1): decreasing illumination
    return (1 - phase) * 2 * 100;
  }
}

/**
 * Convert moon illumination percentage to approximate lux
 * Based on: full moon = ~0.27 lux, new moon = ~0.001 lux
 */
export function moonIlluminationToLux(illumination: number): number {
  // Full moon (100%) = 0.27 lux
  // New moon (0%) = 0.001 lux
  // Use logarithmic interpolation for more realistic curve
  const minLux = 0.001;
  const maxLux = 0.27;
  
  // Linear interpolation for simplicity (could use logarithmic if needed)
  return minLux + (maxLux - minLux) * (illumination / 100);
}

/**
 * Get current moon lux value for a given date
 */
export function getMoonLux(date: Date = new Date()): number {
  const illumination = getMoonIllumination(date);
  return moonIlluminationToLux(illumination);
}

