import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPEN_METEO_BASE = process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1';

export async function getCurrentWeather(lat, lon) {
  try {
    // Validate coordinates
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
    
    if (lat < -90 || lat > 90) {
      throw new Error(`Latitude out of range: ${lat}`);
    }
    
    if (lon < -180 || lon > 180) {
      throw new Error(`Longitude out of range: ${lon}`);
    }
    
    const url = `${OPEN_METEO_BASE}/forecast`;
    
    console.log(`[OPEN-METEO] ===== FETCHING WEATHER =====`);
    console.log(`[OPEN-METEO] Coordinates: lat=${lat}, lon=${lon}`);
    console.log(`[OPEN-METEO] API URL: ${url}`);
    
    const params = {
      latitude: lat,
      longitude: lon,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'precipitation',
        'pressure_msl'
      ].join(','),
      timezone: 'Asia/Bangkok' // GMT+7 cho Việt Nam
    };
    
    console.log(`[OPEN-METEO] Request params:`, params);
    
    const response = await axios.get(url, { params });

    const current = response.data.current;
    
    if (!current) {
      console.error(`[OPEN-METEO] No current weather data in response`);
      console.error(`[OPEN-METEO] Response data:`, JSON.stringify(response.data, null, 2));
      throw new Error('Không có dữ liệu thời tiết từ API');
    }
    
    const weatherCode = current.weather_code;
    const condition = getWeatherCondition(weatherCode);
    
    console.log(`[OPEN-METEO] Raw API Response:`);
    console.log(`[OPEN-METEO]   Temperature: ${current.temperature_2m}°C`);
    console.log(`[OPEN-METEO]   Weather Code: ${weatherCode}`);
    console.log(`[OPEN-METEO]   Condition: ${condition}`);
    console.log(`[OPEN-METEO]   Humidity: ${current.relative_humidity_2m}%`);
    console.log(`[OPEN-METEO]   Wind Speed: ${current.wind_speed_10m} km/h`);
    console.log(`[OPEN-METEO]   Pressure: ${current.pressure_msl} hPa`);
    
    // Process humidity: Open-Meteo returns 0-100%, ensure it's valid and rounded
    let humidity = current.relative_humidity_2m;
    if (humidity == null || humidity === undefined || isNaN(humidity)) {
      humidity = 65; // Default if missing
    } else {
      // Round to integer and clamp to 0-100 range
      humidity = Math.round(Number(humidity));
      humidity = Math.max(0, Math.min(100, humidity));
    }
    
    return {
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: humidity,
      weatherCode: weatherCode,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      precipitation: current.precipitation,
      pressure: current.pressure_msl,
      time: current.time,
      condition: condition
    };
  } catch (error) {
    console.error(`[OPEN-METEO] Error for lat: ${lat}, lon: ${lon}:`, error.message);
    if (error.response) {
      console.error(`[OPEN-METEO] Response status: ${error.response.status}`);
      console.error(`[OPEN-METEO] Response data:`, error.response.data);
    }
    throw new Error('Lỗi khi lấy dữ liệu thời tiết');
  }
}

export async function getWeatherForecast(lat, lon, days = 7) {
  try {
    const url = `${OPEN_METEO_BASE}/forecast`;
    
    const response = await axios.get(url, {
      params: {
        latitude: lat,
        longitude: lon,
        daily: [
          'weather_code',
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_sum',
          'precipitation_probability_max',
          'wind_speed_10m_max',
          'relative_humidity_2m_max',
          'sunrise',
          'sunset'
        ].join(','),
        forecast_days: days,
        timezone: 'Asia/Bangkok'
      }
    });

    const daily = response.data.daily;
    
    const forecast = daily.time.map((date, index) => {
      const weatherCode = daily.weather_code[index];
      console.log(`[OPEN-METEO] Forecast day ${index}: weatherCode=${weatherCode}, condition=${getWeatherCondition(weatherCode)}`);
      
      // Process humidity: Open-Meteo returns 0-100%, ensure it's valid and rounded
      let humidity = daily.relative_humidity_2m_max?.[index];
      if (humidity == null || humidity === undefined || isNaN(humidity)) {
        humidity = 65; // Default if missing
      } else {
        // Round to integer and clamp to 0-100 range
        humidity = Math.round(Number(humidity));
        humidity = Math.max(0, Math.min(100, humidity));
      }
      
      return {
        date: date,
        weatherCode: weatherCode,
        tempMax: daily.temperature_2m_max[index],
        tempMin: daily.temperature_2m_min[index],
        precipitation: daily.precipitation_sum[index],
        precipitationProbability: daily.precipitation_probability_max[index],
        windSpeed: daily.wind_speed_10m_max[index],
        humidity: humidity,
        pressure: 1013, // Default pressure for daily forecast (Open-Meteo doesn't provide daily pressure)
        sunrise: daily.sunrise[index],
        sunset: daily.sunset[index],
        condition: getWeatherCondition(weatherCode)
      };
    });

    return forecast;
  } catch (error) {
    console.error('Open-Meteo Forecast Error:', error.message);
    throw new Error('Lỗi khi lấy dự báo thời tiết');
  }
}

export async function getHourlyForecast(lat, lon, hours = 24) {
  try {
    // Validate coordinates
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
    
    if (lat < -90 || lat > 90) {
      throw new Error(`Latitude out of range: ${lat}`);
    }
    
    if (lon < -180 || lon > 180) {
      throw new Error(`Longitude out of range: ${lon}`);
    }
    
    const url = `${OPEN_METEO_BASE}/forecast`;
    
    // Calculate forecast_days based on hours (24 hours = 1 day, 48 hours = 2 days, etc.)
    const forecastDays = Math.ceil(hours / 24);
    
    console.log(`[OPEN-METEO] ===== FETCHING HOURLY FORECAST =====`);
    console.log(`[OPEN-METEO] Coordinates: lat=${lat}, lon=${lon}`);
    console.log(`[OPEN-METEO] Requested hours: ${hours}`);
    console.log(`[OPEN-METEO] Forecast days needed: ${forecastDays}`);
    console.log(`[OPEN-METEO] API URL: ${url}`);
    
    const params = {
      latitude: lat,
      longitude: lon,
      hourly: [
        'temperature_2m',
        'weather_code',
        'precipitation_probability',
        'wind_speed_10m',
        'relative_humidity_2m'
      ].join(','),
      forecast_days: forecastDays,
      timezone: 'Asia/Bangkok'
    };
    
    console.log(`[OPEN-METEO] Request params:`, params);
    
    const response = await axios.get(url, { params });

    const hourly = response.data.hourly;
    
    if (!hourly || !hourly.time) {
      console.error(`[OPEN-METEO] Invalid hourly forecast data in response`);
      console.error(`[OPEN-METEO] Response data:`, JSON.stringify(response.data, null, 2));
      throw new Error('Invalid hourly forecast data from API');
    }
    
    console.log(`[OPEN-METEO] Raw API Response:`);
    console.log(`[OPEN-METEO]   Total hours available: ${hourly.time?.length || 0}`);
    console.log(`[OPEN-METEO]   First hour: ${hourly.time?.[0] || 'N/A'}`);
    console.log(`[OPEN-METEO]   Last hour: ${hourly.time?.[hours - 1] || hourly.time?.[hourly.time.length - 1] || 'N/A'}`);
    console.log(`[OPEN-METEO]   First temperature: ${hourly.temperature_2m?.[0] || 'N/A'}°C`);
    console.log(`[OPEN-METEO]   First weather code: ${hourly.weather_code?.[0] || 'N/A'}`);
    
    // Open-Meteo trả về time trong format ISO string theo timezone Asia/Bangkok
    // So sánh trực tiếp string time từ API với current hour string
    const now = new Date();
    const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const currentHourStr = `${bangkokNow.getFullYear()}-${String(bangkokNow.getMonth() + 1).padStart(2, '0')}-${String(bangkokNow.getDate()).padStart(2, '0')}T${String(bangkokNow.getHours()).padStart(2, '0')}:00`;
    
    let startIndex = 0;
    for (let i = 0; i < hourly.time.length; i++) {
      const hourTimeStr = hourly.time[i];
      // So sánh string trực tiếp (format: YYYY-MM-DDTHH:00)
      if (hourTimeStr >= currentHourStr) {
        startIndex = i;
        break;
      }
    }
    
    console.log(`[OPEN-METEO] Current hour (Bangkok): ${currentHourStr}`);
    console.log(`[OPEN-METEO] Starting from index: ${startIndex} (time: ${hourly.time[startIndex] || 'N/A'})`);
    console.log(`[OPEN-METEO] Total hours available: ${hourly.time.length}`);
    console.log(`[OPEN-METEO] Hours to return: ${Math.min(startIndex + hours, hourly.time.length) - startIndex}`);
    
    const endIndex = Math.min(startIndex + hours, hourly.time.length);
    const forecast = hourly.time.slice(startIndex, endIndex).map((time, index) => {
      const actualIndex = startIndex + index;
      // Process humidity for hourly forecast
      let humidity = hourly.relative_humidity_2m?.[actualIndex];
      if (humidity == null || humidity === undefined || isNaN(humidity)) {
        humidity = 65; // Default humidity for hourly forecast
      } else {
        if (humidity > 0 && humidity <= 1) {
          humidity = humidity * 100;
        }
        humidity = Math.round(humidity);
        humidity = Math.max(0, Math.min(100, humidity));
      }
      
      return {
        time: time,
        temperature: hourly.temperature_2m[actualIndex],
        weatherCode: hourly.weather_code[actualIndex],
        precipitationProbability: hourly.precipitation_probability[actualIndex],
        windSpeed: hourly.wind_speed_10m[actualIndex],
        humidity: humidity,
        condition: getWeatherCondition(hourly.weather_code[actualIndex])
      };
    });

    console.log(`[OPEN-METEO] Processed forecast:`);
    console.log(`[OPEN-METEO]   Total hours returned: ${forecast.length}`);
    if (forecast.length > 0) {
      console.log(`[OPEN-METEO]   First hour data:`, {
        time: forecast[0].time,
        temp: forecast[0].temperature,
        condition: forecast[0].condition,
        humidity: forecast[0].humidity
      });
      if (forecast.length > 1) {
        console.log(`[OPEN-METEO]   Last hour data:`, {
          time: forecast[forecast.length - 1].time,
          temp: forecast[forecast.length - 1].temperature,
          condition: forecast[forecast.length - 1].condition,
          humidity: forecast[forecast.length - 1].humidity
        });
      }
    }
    console.log(`[OPEN-METEO] ===== HOURLY FORECAST COMPLETE =====`);

    return forecast;
  } catch (error) {
    console.error('[OPEN-METEO] Hourly Forecast Error:', error.message);
    if (error.response) {
      console.error('[OPEN-METEO] Response status:', error.response.status);
      console.error('[OPEN-METEO] Response data:', error.response.data);
    }
    throw new Error('Lỗi khi lấy dự báo theo giờ');
  }
}

function getWeatherCondition(code) {
  const conditions = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };
  
  return conditions[code] || 'Unknown';
}

export function getWeatherIcon(code) {
  if (code === 0) return 0;
  
  if (code === 1) return 1;
  
  if (code === 2) return 1;
  
  if (code === 3) return 1;
  
  if ([45, 48].includes(code)) return 1;
  
  if ([51, 53, 55, 61, 80].includes(code)) return 3;
  
  if ([63, 65, 81, 82].includes(code)) return 3;
  
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 5;
  
  if ([95, 96, 99].includes(code)) return 4;
  
  return 1;
}