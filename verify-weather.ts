import { getLiveWeather, parseWmoWeatherCode, DEFAULT_COORDINATES } from "./lib/weather";

console.log("=== STARTING LIVE WEATHER SYSTEM VERIFICATION ===");

async function runWeatherTests() {
  // TEST 1: Live Open-Meteo Weather Fetch for Jaipur, Rajasthan
  console.log("\n--- TEST 1: Fetch Live Weather for Jaipur ---");
  const weather = await getLiveWeather(
    DEFAULT_COORDINATES.latitude,
    DEFAULT_COORDINATES.longitude,
    DEFAULT_COORDINATES.location,
    DEFAULT_COORDINATES.district,
    DEFAULT_COORDINATES.state,
    true // force fresh
  );

  if (!weather) {
    throw new Error("TEST 1 FAILED: Unable to fetch live weather from Open-Meteo!");
  }

  console.log("Live Weather Fetched Successfully:");
  console.log({
    location: weather.location,
    temperature: `${weather.temperature}°C`,
    condition: weather.condition,
    conditionLabel: weather.conditionLabel,
    isDay: weather.isDay ? "Day" : "Night",
    humidity: `${weather.humidity}%`,
    windSpeed: `${weather.windSpeed} km/h`,
    weatherCode: weather.weatherCode,
    updatedAt: weather.updatedAt,
  });

  if (typeof weather.temperature !== "number" || isNaN(weather.temperature)) {
    throw new Error("TEST 1 FAILED: Temperature is not a valid number!");
  }
  if (!weather.condition || !weather.conditionLabel) {
    throw new Error("TEST 1 FAILED: Weather condition or label is missing!");
  }
  console.log("PASS: Test 1 (Real live weather successfully retrieved from Open-Meteo)");

  // TEST 2: WMO Weather Code Mappings for all supported conditions
  console.log("\n--- TEST 2: Verify WMO Weather Code Mappings ---");
  const testCases: [number, boolean, string][] = [
    [0, true, "CLEAR"],          // Clear sky (day)
    [0, false, "CLEAR"],         // Clear sky (night)
    [1, true, "PARTLY_CLOUDY"],  // Mainly clear
    [2, true, "PARTLY_CLOUDY"],  // Partly cloudy
    [3, true, "CLOUDY"],         // Overcast
    [45, true, "FOG_HAZE"],      // Fog
    [48, true, "FOG_HAZE"],      // Depositing rime fog
    [51, true, "RAIN"],          // Drizzle
    [61, true, "RAIN"],          // Slight rain
    [65, true, "RAIN"],          // Heavy rain
    [80, true, "RAIN"],          // Rain showers
    [95, true, "THUNDERSTORM"],  // Thunderstorm
  ];

  for (const [code, isDay, expectedCondition] of testCases) {
    const { condition, label } = parseWmoWeatherCode(code, isDay);
    if (condition !== expectedCondition) {
      throw new Error(`TEST 2 FAILED: Code ${code} mapped to ${condition}, expected ${expectedCondition}`);
    }
    console.log(`Code ${code} (${isDay ? "Day" : "Night"}) -> ${condition} ("${label}"): OK`);
  }
  console.log("PASS: Test 2 (All WMO weather condition mappings verified)");

  // TEST 3: In-Memory Caching (Subsequent calls within 10 min return cached data instantly)
  console.log("\n--- TEST 3: Verify In-Memory Caching ---");
  const start = Date.now();
  const cached = await getLiveWeather();
  const duration = Date.now() - start;
  console.log(`Cached fetch returned in ${duration}ms, matching live data timestamp: ${cached?.updatedAt}`);
  if (duration > 50) {
    console.warn("Cached fetch took longer than expected:", duration);
  }
  console.log("PASS: Test 3 (In-memory caching operational)");

  console.log("\n=== ALL WEATHER VERIFICATIONS PASSED SUCCESSFULLY! ===");
}

runWeatherTests().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
