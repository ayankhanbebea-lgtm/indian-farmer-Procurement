export type WeatherConditionType =
  | "CLEAR"
  | "PARTLY_CLOUDY"
  | "CLOUDY"
  | "RAIN"
  | "THUNDERSTORM"
  | "FOG_HAZE";

export interface WeatherData {
  location: string;
  district: string;
  state: string;
  temperature: number; // in Celsius
  humidity: number; // percentage
  windSpeed: number; // km/h
  windDirection?: number; // degrees
  condition: WeatherConditionType;
  conditionLabel: string;
  isDay: boolean;
  weatherCode: number;
  cloudCover: number; // 0 - 100%
  precipitation: number; // mm
  rain: number; // mm
  updatedAt: string;
}

// In-memory cache for weather data (10 minutes TTL)
let cachedWeather: { data: WeatherData; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Default coordinates for Jaipur, Rajasthan, India
export const DEFAULT_COORDINATES = {
  latitude: 26.9124,
  longitude: 75.7873,
  location: "Jaipur, Rajasthan",
  district: "Jaipur",
  state: "Rajasthan",
};

/**
 * Maps standard WMO Weather interpretation codes (WW) to condition types and human-readable labels.
 * Reference: Open-Meteo & WMO Code Table 4677
 */
export function parseWmoWeatherCode(code: number, isDay: boolean): { condition: WeatherConditionType; label: string } {
  // 0: Clear sky
  if (code === 0) {
    return {
      condition: "CLEAR",
      label: isDay ? "Clear & Sunny" : "Clear Night",
    };
  }

  // 1, 2: Mainly clear, partly cloudy
  if (code === 1 || code === 2) {
    return {
      condition: "PARTLY_CLOUDY",
      label: isDay ? "Partly Cloudy" : "Partly Cloudy Night",
    };
  }

  // 3: Overcast
  if (code === 3) {
    return {
      condition: "CLOUDY",
      label: "Overcast Clouds",
    };
  }

  // 45, 48: Fog and depositing rime fog
  if (code === 45 || code === 48) {
    return {
      condition: "FOG_HAZE",
      label: "Haze & Fog",
    };
  }

  // 51, 53, 55: Drizzle
  if (code >= 51 && code <= 57) {
    return {
      condition: "RAIN",
      label: "Light Drizzle",
    };
  }

  // 61, 63, 65, 66, 67: Rain
  if (code >= 61 && code <= 67) {
    return {
      condition: "RAIN",
      label: code >= 65 ? "Heavy Rain" : "Rain Showers",
    };
  }

  // 71, 73, 75, 77: Snow / Ice grains
  if (code >= 71 && code <= 77) {
    return {
      condition: "RAIN",
      label: "Precipitation",
    };
  }

  // 80, 81, 82: Rain showers
  if (code >= 80 && code <= 82) {
    return {
      condition: "RAIN",
      label: code === 82 ? "Violent Rain Showers" : "Passing Showers",
    };
  }

  // 95, 96, 99: Thunderstorm
  if (code >= 95 && code <= 99) {
    return {
      condition: "THUNDERSTORM",
      label: "Thunderstorm",
    };
  }

  // Fallback
  return {
    condition: isDay ? "CLEAR" : "CLEAR",
    label: isDay ? "Clear & Sunny" : "Clear Night",
  };
}

/**
 * Fetches real current live weather from Open-Meteo for the specified coordinates.
 */
export async function getLiveWeather(
  latitude = DEFAULT_COORDINATES.latitude,
  longitude = DEFAULT_COORDINATES.longitude,
  location = DEFAULT_COORDINATES.location,
  district = DEFAULT_COORDINATES.district,
  state = DEFAULT_COORDINATES.state,
  forceFresh = false
): Promise<WeatherData | null> {
  const now = Date.now();

  // Return cached result if valid
  if (!forceFresh && cachedWeather && now - cachedWeather.timestamp < CACHE_TTL_MS) {
    return cachedWeather.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=Asia%2FKolkata`;

    const res = await fetch(url, {
      next: { revalidate: 600 },
      headers: {
        "User-Agent": "KRISHIDHENU-AgriApp/1.0",
      },
    });

    if (!res.ok) {
      console.error(`[WeatherService] Open-Meteo API error ${res.status}: ${res.statusText}`);
      return cachedWeather ? cachedWeather.data : null;
    }

    const json = await res.json();
    const current = json.current;

    if (!current) {
      console.error("[WeatherService] Unexpected API structure:", json);
      return cachedWeather ? cachedWeather.data : null;
    }

    const weatherCode = Number(current.weather_code ?? 0);
    const isDay = Boolean(current.is_day ?? 1);
    const precipitation = Number(current.precipitation ?? 0);
    const rain = Number(current.rain ?? 0);
    let { condition, label } = parseWmoWeatherCode(weatherCode, isDay);

    // If precipitation is active (> 0.2mm), ensure rain condition is reflected
    if ((precipitation > 0.2 || rain > 0.2) && condition !== "RAIN" && condition !== "THUNDERSTORM") {
      condition = "RAIN";
      label = isDay ? "Passing Rain" : "Night Rain";
    }

    const weatherData: WeatherData = {
      location,
      district,
      state,
      temperature: Math.round(Number(current.temperature_2m ?? 30)),
      humidity: Math.round(Number(current.relative_humidity_2m ?? 45)),
      windSpeed: Math.round(Number(current.wind_speed_10m ?? 8)),
      windDirection: Number(current.wind_direction_10m ?? 0),
      condition,
      conditionLabel: label,
      isDay,
      weatherCode,
      cloudCover: Number(current.cloud_cover ?? 0),
      precipitation,
      rain,
      updatedAt: current.time || new Date().toISOString(),
    };

    cachedWeather = { data: weatherData, timestamp: now };
    return weatherData;
  } catch (err: any) {
    console.error("[WeatherService] Failed to fetch live weather:", err?.message || err);
    return cachedWeather ? cachedWeather.data : null;
  }
}
