import * as openMeteoService from '../services/openmeteo.service.js';
import * as openweathermapService from '../services/openweathermap.service.js';

export async function getCurrentWeather(req, res) {
  try {
    let { city, lat, lon } = req.query;
    
    console.log(`[WEATHER] Request for city: ${city}, lat: ${lat}, lon: ${lon}`);
    
    if (city && (!lat || !lon)) {
      console.log(`[WEATHER] geocoding city: ${city}`);
      const locations = await openweathermapService.searchLocation(city);
      
      console.log(`[WEATHER] geocoding result:`, JSON.stringify(locations, null, 2));
      
      if (!locations) {
        console.error(`[WEATHER] geocoding returned null/undefined for: ${city}`);
        return res.status(500).json({ error: 'loi khi geocoding', message: 'geocoding returned null' });
      }
      
      if (locations.error) {
        console.error(`[WEATHER] geocoding error for ${city}:`, locations.error);
        if (locations.error.includes('rate limit') || locations.error.includes('429')) {
          return res.status(429).json({ error: 'api rate limit exceeded', message: locations.error });
        }
        if (locations.error.includes('api key') || locations.error.includes('401')) {
          return res.status(401).json({ error: 'api key invalid', message: locations.error });
        }
        return res.status(404).json({ error: 'khong tim thay dia diem', message: locations.error });
      }
      
      if (!Array.isArray(locations) || locations.length === 0) {
        console.error(`[WEATHER] city not found: ${city}, result:`, locations);
        return res.status(404).json({ error: 'khong tim thay dia diem' });
      }
      
      lat = locations[0].lat;
      lon = locations[0].lon;
      city = locations[0].nameVi;
      console.log(`[WEATHER] geocoded to: ${city} (${lat}, ${lon})`);
    }
    
    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'can cung cap city hoac lat/lon' 
      });
    }
    
    console.log(`[WEATHER] Fetching weather for: ${lat}, ${lon}`);
    
    if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
      console.error(`[WEATHER] Invalid coordinates: lat=${lat}, lon=${lon}`);
      return res.status(400).json({ error: 'toa do khong hop le', lat, lon });
    }
    
    const weather = await openMeteoService.getCurrentWeather(
      parseFloat(lat), 
      parseFloat(lon)
    );
    
    if (!weather) {
      console.error(`[WEATHER] Weather data is null/undefined for ${lat}, ${lon}`);
      return res.status(500).json({ error: 'loi khi lay thoi tiet', message: 'weather data is null' });
    }
    
    console.log(`[WEATHER] Weather code received: ${weather.weatherCode}, condition: ${weather.condition}`);
    
    if (!city) {
      const location = await openweathermapService.reverseGeocode(
        parseFloat(lat), 
        parseFloat(lon)
      );
      if (location.error) {
        console.warn(`[WEATHER] reverse geocode failed for ${lat}, ${lon}`);
        city = 'Unknown Location';
      } else {
        city = location.nameVi || location.name;
      }
    }
    
    res.json({
      location: {
        city,
        lat: parseFloat(lat),
        lon: parseFloat(lon)
      },
      weather,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[WEATHER] Current weather error:', error);
    console.error('[WEATHER] Error message:', error.message);
    console.error('[WEATHER] Error stack:', error.stack);
    
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return res.status(429).json({ 
        error: 'api rate limit exceeded',
        message: error.message 
      });
    }
    
    if (error.message?.includes('api key') || error.message?.includes('401') || error.message?.includes('authentication')) {
      return res.status(401).json({ 
        error: 'api key invalid',
        message: error.message 
      });
    }
    
    if (error.message?.includes('timeout')) {
      return res.status(504).json({ 
        error: 'api timeout',
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'loi khi lay thoi tiet hien tai',
      message: error.message 
    });
  }
}

export async function getForecast(req, res) {
  try {
    let { city, lat, lon, days = 7 } = req.query;
    
    if (city && (!lat || !lon)) {
      const locations = await openweathermapService.searchLocation(city);
      
      if (locations?.error) {
        if (locations.error.includes('rate limit') || locations.error.includes('429')) {
          return res.status(429).json({ error: 'api rate limit exceeded', message: locations.error });
        }
        if (locations.error.includes('api key') || locations.error.includes('401')) {
          return res.status(401).json({ error: 'api key invalid', message: locations.error });
        }
        return res.status(404).json({ error: 'khong tim thay dia diem', message: locations.error });
      }
      
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.status(404).json({ error: 'khong tim thay dia diem' });
      }
      lat = locations[0].lat;
      lon = locations[0].lon;
      city = locations[0].nameVi;
    }
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'can cung cap city hoac lat/lon' });
    }
    
    const forecast = await openMeteoService.getWeatherForecast(
      parseFloat(lat),
      parseFloat(lon),
      parseInt(days)
    );
    
    res.json({
      location: {
        city,
        lat: parseFloat(lat),
        lon: parseFloat(lon)
      },
      forecast,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[WEATHER] Forecast error:', error);
    console.error('[WEATHER] Error message:', error.message);
    
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return res.status(429).json({ 
        error: 'api rate limit exceeded',
        message: error.message 
      });
    }
    
    if (error.message?.includes('api key') || error.message?.includes('401')) {
      return res.status(401).json({ 
        error: 'api key invalid',
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'loi khi lay du bao thoi tiet',
      message: error.message 
    });
  }
}

export async function getHourlyForecast(req, res) {
  try {
    let { city, lat, lon, hours = 24 } = req.query;
    
    if (city && (!lat || !lon)) {
      const locations = await openweathermapService.searchLocation(city);
      
      if (locations?.error) {
        if (locations.error.includes('rate limit') || locations.error.includes('429')) {
          return res.status(429).json({ error: 'api rate limit exceeded', message: locations.error });
        }
        if (locations.error.includes('api key') || locations.error.includes('401')) {
          return res.status(401).json({ error: 'api key invalid', message: locations.error });
        }
        return res.status(404).json({ error: 'khong tim thay dia diem', message: locations.error });
      }
      
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.status(404).json({ error: 'khong tim thay dia diem' });
      }
      lat = locations[0].lat;
      lon = locations[0].lon;
      city = locations[0].nameVi;
    }
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'can cung cap city hoac lat/lon' });
    }
    
    const hourlyForecast = await openMeteoService.getHourlyForecast(
      parseFloat(lat),
      parseFloat(lon),
      parseInt(hours)
    );
    
    res.json({
      location: { city, lat: parseFloat(lat), lon: parseFloat(lon) },
      hourly: hourlyForecast,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[WEATHER] Hourly forecast error:', error);
    console.error('[WEATHER] Error message:', error.message);
    
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return res.status(429).json({ 
        error: 'api rate limit exceeded',
        message: error.message 
      });
    }
    
    if (error.message?.includes('api key') || error.message?.includes('401')) {
      return res.status(401).json({ 
        error: 'api key invalid',
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'loi khi lay du bao theo gio',
      message: error.message 
    });
  }
}