import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org';

export async function searchLocation(query) {
  try {
    if (!OPENWEATHER_API_KEY) {
      return { error: 'OPENWEATHER_API_KEY is not configured' };
    }

    const url = `${OPENWEATHER_BASE_URL}/geo/1.0/direct`;
    
    const response = await axios.get(url, {
      params: {
        q: query,
        limit: 5,
        appid: OPENWEATHER_API_KEY
      },
      timeout: 10000
    });

    if (!response.data || response.data.length === 0) {
      return { error: 'khong tim thay dia diem' };
    }

    const results = response.data.map(location => ({
      name: `${location.name}, ${location.country}`,
      nameVi: location.name,
      lat: location.lat,
      lon: location.lon,
      country: location.country,
      state: location.state || '',
      placeType: 'place'
    }));

    return results;
  } catch (error) {
    console.error('openweathermap geocoding error:', error.message);
    if (error.response) {
      console.error('response status:', error.response.status);
      console.error('response data:', error.response.data);
    }
    return { error: 'loi khi tim kiem dia diem', details: error.message };
  }
}

export async function reverseGeocode(lat, lon) {
  try {
    try {
      const nominatimUrl = 'https://nominatim.openstreetmap.org/reverse';
      const nominatimResponse = await axios.get(nominatimUrl, {
        params: {
          lat: lat,
          lon: lon,
          format: 'json',
          addressdetails: 1,
          'accept-language': 'vi'
        },
        headers: {
          'User-Agent': 'PleasantWeatherApp/1.0'
        },
        timeout: 10000
      });

      if (nominatimResponse.data && nominatimResponse.data.address) {
        const addr = nominatimResponse.data.address;
        
        const addressParts = [];
        
        if (addr.house_number) addressParts.push(addr.house_number);
        if (addr.road || addr.street || addr.pedestrian) {
          const street = addr.road || addr.street || addr.pedestrian;
          if (addr.house_number) {
            addressParts.push(street);
          } else {
            addressParts.push(street);
          }
        }
        if (addr.suburb || addr.neighbourhood) {
          addressParts.push(addr.suburb || addr.neighbourhood);
        }
        if (addr.quarter || addr.city_district) {
          addressParts.push(addr.quarter || addr.city_district);
        }
        if (addr.city || addr.town || addr.village) {
          addressParts.push(addr.city || addr.town || addr.village);
        }
        if (addr.state || addr.region) {
          addressParts.push(addr.state || addr.region);
        }
        
        const detailedAddress = addressParts.join(', ') || nominatimResponse.data.display_name;
        
        return {
          name: detailedAddress,
          nameVi: detailedAddress,
          lat: lat,
          lon: lon,
          country: addr.country || 'Vietnam',
          state: addr.state || addr.region || '',
          city: addr.city || addr.town || addr.village || '',
          district: addr.quarter || addr.city_district || addr.suburb || '',
          street: addr.road || addr.street || addr.pedestrian || '',
          houseNumber: addr.house_number || '',
          placeType: 'place',
          displayName: nominatimResponse.data.display_name
        };
      }
    } catch (nominatimError) {
      console.log('nominatim error, falling back to openweathermap:', nominatimError.message);
    }

    if (!OPENWEATHER_API_KEY) {
      return { error: 'OPENWEATHER_API_KEY is not configured' };
    }

    const url = `${OPENWEATHER_BASE_URL}/geo/1.0/reverse`;
    
    const response = await axios.get(url, {
      params: {
        lat: lat,
        lon: lon,
        limit: 1,
        appid: OPENWEATHER_API_KEY
      },
      timeout: 10000
    });

    if (!response.data || response.data.length === 0) {
      return { error: 'khong tim thay dia diem' };
    }

    const location = response.data[0];
    
    return {
      name: `${location.name}, ${location.country}`,
      nameVi: location.name,
      lat: lat,
      lon: lon,
      country: location.country,
      state: location.state || '',
      placeType: 'place'
    };
  } catch (error) {
    console.error('reverse geocoding error:', error.message);
    return { error: 'loi khi tim dia diem', details: error.message };
  }
}

export async function getCurrentWeather(lat, lon) {
  try {
    if (!OPENWEATHER_API_KEY) {
      throw new Error('OPENWEATHER_API_KEY is not configured');
    }

    const url = `${OPENWEATHER_BASE_URL}/data/2.5/weather`;
    
    const response = await axios.get(url, {
      params: {
        lat: lat,
        lon: lon,
        appid: OPENWEATHER_API_KEY,
        units: 'metric',
        lang: 'vi'
      },
      timeout: 10000
    });

    if (!response.data) {
      throw new Error('Invalid response from OpenWeatherMap API');
    }

    const data = response.data;
    const weatherCode = data.weather?.[0]?.id || 800;
    
    const weatherConditionMap = {
      200: 'Thunderstorm', 201: 'Thunderstorm', 202: 'Thunderstorm', 210: 'Thunderstorm', 211: 'Thunderstorm', 212: 'Thunderstorm', 221: 'Thunderstorm', 230: 'Thunderstorm', 231: 'Thunderstorm', 232: 'Thunderstorm',
      300: 'Drizzle', 301: 'Drizzle', 302: 'Drizzle', 310: 'Drizzle', 311: 'Drizzle', 312: 'Drizzle', 313: 'Drizzle', 314: 'Drizzle', 321: 'Drizzle',
      500: 'Rain', 501: 'Rain', 502: 'Rain', 503: 'Rain', 504: 'Rain', 511: 'Rain', 520: 'Rain', 521: 'Rain', 522: 'Rain', 531: 'Rain',
      600: 'Snow', 601: 'Snow', 602: 'Snow', 611: 'Snow', 612: 'Snow', 613: 'Snow', 615: 'Snow', 616: 'Snow', 620: 'Snow', 621: 'Snow', 622: 'Snow',
      701: 'Mist', 711: 'Smoke', 721: 'Haze', 731: 'Dust', 741: 'Fog', 751: 'Sand', 761: 'Dust', 762: 'Ash', 771: 'Squall', 781: 'Tornado',
      800: 'Clear',
      801: 'Clouds', 802: 'Clouds', 803: 'Clouds', 804: 'Clouds'
    };

    const condition = weatherConditionMap[Math.floor(weatherCode / 100) * 100] || weatherConditionMap[weatherCode] || 'Clear';

    return {
      temperature: data.main?.temp || 0,
      apparentTemperature: data.main?.feels_like || data.main?.temp || 0,
      humidity: data.main?.humidity || 0,
      weatherCode: weatherCode,
      windSpeed: (data.wind?.speed || 0) * 3.6,
      windDirection: data.wind?.deg || 0,
      precipitation: data.rain?.['1h'] || data.rain?.['3h'] || 0,
      time: new Date().toISOString(),
      condition: condition
    };
  } catch (error) {
    console.error('[OPENWEATHER] Weather error:', error.message);
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      console.error('[OPENWEATHER] Response status:', status);
      console.error('[OPENWEATHER] Response data:', JSON.stringify(data, null, 2));
      
      if (status === 401) {
        throw new Error(`OpenWeatherMap API key invalid: ${data?.message || 'Invalid credentials'}`);
      }
      if (status === 429) {
        throw new Error(`OpenWeatherMap rate limit exceeded: ${data?.message || 'Too many requests'}`);
      }
      if (status >= 500) {
        throw new Error(`OpenWeatherMap server error (${status}): ${data?.message || error.message}`);
      }
      
      throw new Error(`OpenWeatherMap API error (${status}): ${data?.message || error.message}`);
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error(`OpenWeatherMap timeout: ${error.message}`);
    }
    
    throw new Error(`OpenWeatherMap error: ${error.message}`);
  }
}

export async function getWeatherForecast(lat, lon, days = 7) {
  try {
    if (!OPENWEATHER_API_KEY) {
      throw new Error('OPENWEATHER_API_KEY is not configured');
    }

    const url = `${OPENWEATHER_BASE_URL}/data/2.5/forecast`;
    
    const response = await axios.get(url, {
      params: {
        lat: lat,
        lon: lon,
        appid: OPENWEATHER_API_KEY,
        units: 'metric',
        lang: 'vi'
      },
      timeout: 10000
    });

    if (!response.data || !response.data.list) {
      throw new Error('Invalid forecast response from OpenWeatherMap API');
    }

    const weatherConditionMap = {
      200: 'Thunderstorm', 201: 'Thunderstorm', 202: 'Thunderstorm', 210: 'Thunderstorm', 211: 'Thunderstorm', 212: 'Thunderstorm', 221: 'Thunderstorm', 230: 'Thunderstorm', 231: 'Thunderstorm', 232: 'Thunderstorm',
      300: 'Drizzle', 301: 'Drizzle', 302: 'Drizzle', 310: 'Drizzle', 311: 'Drizzle', 312: 'Drizzle', 313: 'Drizzle', 314: 'Drizzle', 321: 'Drizzle',
      500: 'Rain', 501: 'Rain', 502: 'Rain', 503: 'Rain', 504: 'Rain', 511: 'Rain', 520: 'Rain', 521: 'Rain', 522: 'Rain', 531: 'Rain',
      600: 'Snow', 601: 'Snow', 602: 'Snow', 611: 'Snow', 612: 'Snow', 613: 'Snow', 615: 'Snow', 616: 'Snow', 620: 'Snow', 621: 'Snow', 622: 'Snow',
      701: 'Mist', 711: 'Smoke', 721: 'Haze', 731: 'Dust', 741: 'Fog', 751: 'Sand', 761: 'Dust', 762: 'Ash', 771: 'Squall', 781: 'Tornado',
      800: 'Clear',
      801: 'Clouds', 802: 'Clouds', 803: 'Clouds', 804: 'Clouds'
    };

    const forecastList = response.data.list;
    const dailyForecast = [];
    const processedDates = new Set();
    
    for (let i = 0; i < forecastList.length && dailyForecast.length < Math.min(days, 5); i++) {
      const item = forecastList[i];
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      
      if (!processedDates.has(dateKey)) {
        processedDates.add(dateKey);
        const weatherCode = item.weather?.[0]?.id || 800;
        const condition = weatherConditionMap[Math.floor(weatherCode / 100) * 100] || weatherConditionMap[weatherCode] || 'Clear';
        
        const lastDay = dailyForecast.length > 0 ? dailyForecast[dailyForecast.length - 1] : null;
        dailyForecast.push({
          date: date.toISOString(),
          temperature: Math.round((item.main?.temp || 0) * 10) / 10,
          tempMax: Math.round((item.main?.temp_max || item.main?.temp || 0) * 10) / 10,
          tempMin: Math.round((item.main?.temp_min || item.main?.temp || 0) * 10) / 10,
          humidity: item.main?.humidity || 0,
          precipitation: item.rain?.['3h'] || 0,
          precipitationProbability: item.pop ? Math.round(item.pop * 100) : (lastDay ? lastDay.precipitationProbability : 0),
          windSpeed: Math.round(((item.wind?.speed || 0) * 3.6) * 10) / 10,
          weatherCode: weatherCode,
          condition: condition,
          sunrise: lastDay ? lastDay.sunrise : null,
          sunset: lastDay ? lastDay.sunset : null,
          pressure: item.main?.pressure ? Math.round(item.main.pressure) : (lastDay ? lastDay.pressure : 1013)
        });
      }
    }
    
    while (dailyForecast.length < Math.min(days, 16)) {
      const lastDay = dailyForecast[dailyForecast.length - 1];
      if (lastDay) {
        const nextDate = new Date(lastDay.date);
        nextDate.setDate(nextDate.getDate() + 1);
        dailyForecast.push({
          date: nextDate.toISOString(),
          temperature: lastDay.temperature,
          tempMax: lastDay.tempMax,
          tempMin: lastDay.tempMin,
          humidity: lastDay.humidity,
          precipitation: lastDay.precipitation,
          precipitationProbability: lastDay.precipitationProbability,
          windSpeed: lastDay.windSpeed,
          weatherCode: lastDay.weatherCode,
          condition: lastDay.condition,
          sunrise: lastDay.sunrise,
          sunset: lastDay.sunset,
          pressure: lastDay.pressure
        });
      } else {
        break;
      }
    }
    
    return dailyForecast;
  } catch (error) {
    console.error('[OPENWEATHER] Forecast error:', error.message);
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        throw new Error(`OpenWeatherMap API key invalid: ${data?.message || 'Invalid credentials'}`);
      }
      if (status === 429) {
        throw new Error(`OpenWeatherMap rate limit exceeded: ${data?.message || 'Too many requests'}`);
      }
      if (status >= 500) {
        throw new Error(`OpenWeatherMap server error (${status}): ${data?.message || error.message}`);
      }
      
      throw new Error(`OpenWeatherMap forecast error (${status}): ${data?.message || error.message}`);
    }
    
    throw new Error(`OpenWeatherMap forecast error: ${error.message}`);
  }
}

export async function getHourlyForecast(lat, lon, hours = 24) {
  try {
    if (!OPENWEATHER_API_KEY) {
      throw new Error('OPENWEATHER_API_KEY is not configured');
    }

    const url = `${OPENWEATHER_BASE_URL}/data/2.5/forecast`;
    
    const response = await axios.get(url, {
      params: {
        lat: lat,
        lon: lon,
        appid: OPENWEATHER_API_KEY,
        units: 'metric',
        lang: 'vi'
      },
      timeout: 10000
    });

    if (!response.data || !response.data.list) {
      throw new Error('Invalid hourly forecast response from OpenWeatherMap API');
    }

    const weatherConditionMap = {
      200: 'Thunderstorm', 201: 'Thunderstorm', 202: 'Thunderstorm', 210: 'Thunderstorm', 211: 'Thunderstorm', 212: 'Thunderstorm', 221: 'Thunderstorm', 230: 'Thunderstorm', 231: 'Thunderstorm', 232: 'Thunderstorm',
      300: 'Drizzle', 301: 'Drizzle', 302: 'Drizzle', 310: 'Drizzle', 311: 'Drizzle', 312: 'Drizzle', 313: 'Drizzle', 314: 'Drizzle', 321: 'Drizzle',
      500: 'Rain', 501: 'Rain', 502: 'Rain', 503: 'Rain', 504: 'Rain', 511: 'Rain', 520: 'Rain', 521: 'Rain', 522: 'Rain', 531: 'Rain',
      600: 'Snow', 601: 'Snow', 602: 'Snow', 611: 'Snow', 612: 'Snow', 613: 'Snow', 615: 'Snow', 616: 'Snow', 620: 'Snow', 621: 'Snow', 622: 'Snow',
      701: 'Mist', 711: 'Smoke', 721: 'Haze', 731: 'Dust', 741: 'Fog', 751: 'Sand', 761: 'Dust', 762: 'Ash', 771: 'Squall', 781: 'Tornado',
      800: 'Clear',
      801: 'Clouds', 802: 'Clouds', 803: 'Clouds', 804: 'Clouds'
    };

    const forecast = [];
    const forecastList = response.data.list.slice(0, Math.ceil(hours / 3));
    
    forecastList.forEach((item, index) => {
      const weatherCode = item.weather?.[0]?.id || 800;
      const condition = weatherConditionMap[Math.floor(weatherCode / 100) * 100] || weatherConditionMap[weatherCode] || 'Clear';
      const prevItem = index > 0 ? forecast[index - 1] : null;
      
      forecast.push({
        time: new Date(item.dt * 1000).toISOString(),
        temperature: Math.round((item.main?.temp || 0) * 10) / 10,
        humidity: item.main?.humidity || 0,
        precipitation: item.rain?.['3h'] || 0,
        precipitationProbability: item.pop ? Math.round(item.pop * 100) : (prevItem ? prevItem.precipitationProbability : 0),
        windSpeed: Math.round(((item.wind?.speed || 0) * 3.6) * 10) / 10,
        windDirection: item.wind?.deg || 0,
        weatherCode: weatherCode,
        condition: condition
      });
    });

    const hoursNeeded = hours;
    const forecastInterval = 3;
    const currentForecastCount = forecast.length;
    const totalHoursFromAPI = currentForecastCount * forecastInterval;

    if (totalHoursFromAPI < hoursNeeded) {
      const lastItem = forecast[forecast.length - 1];
      if (lastItem) {
        const additionalHours = Math.ceil((hoursNeeded - totalHoursFromAPI) / forecastInterval);
        for (let i = 0; i < additionalHours; i++) {
          const nextTime = new Date(lastItem.time);
          nextTime.setHours(nextTime.getHours() + forecastInterval * (i + 1));
          forecast.push({
            time: nextTime.toISOString(),
            temperature: lastItem.temperature,
            humidity: lastItem.humidity,
            precipitation: lastItem.precipitation,
            precipitationProbability: lastItem.precipitationProbability,
            windSpeed: lastItem.windSpeed,
            windDirection: lastItem.windDirection,
            weatherCode: lastItem.weatherCode,
            condition: lastItem.condition
          });
        }
      }
    }

    return forecast;
  } catch (error) {
    console.error('[OPENWEATHER] Hourly forecast error:', error.message);
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        throw new Error(`OpenWeatherMap API key invalid: ${data?.message || 'Invalid credentials'}`);
      }
      if (status === 429) {
        throw new Error(`OpenWeatherMap rate limit exceeded: ${data?.message || 'Too many requests'}`);
      }
      if (status >= 500) {
        throw new Error(`OpenWeatherMap server error (${status}): ${data?.message || error.message}`);
      }
      
      throw new Error(`OpenWeatherMap hourly forecast error (${status}): ${data?.message || error.message}`);
    }
    
    throw new Error(`OpenWeatherMap hourly forecast error: ${error.message}`);
  }
}

