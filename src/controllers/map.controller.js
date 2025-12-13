import * as openweathermapService from '../services/openweathermap.service.js';
import * as openMeteoService from '../services/openmeteo.service.js';

// Cache cho temperature data (theo grid cell ~11km)
const temperatureCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 phút cache

function getCacheKey(lat, lon) {
  // Round to 0.1 degree (~11km) để cache hiệu quả
  return `${Math.round(lat * 10) / 10}_${Math.round(lon * 10) / 10}`;
}

// Cleanup cache cũ mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of temperatureCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      temperatureCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function searchLocation(req, res) {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Cần cung cấp query string (q)' });
    }
    
    const results = await openweathermapService.searchLocation(q);
    
    if (results.error) {
      return res.status(404).json(results);
    }
    
    res.json({
      query: q,
      results,
      count: results.length
    });
    
  } catch (error) {
    console.error('Search Location Error:', error);
    res.status(500).json({ error: 'Lỗi khi tìm kiếm địa điểm' });
  }
}

export async function reverseGeocode(req, res) {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Cần cung cấp lat và lon' });
    }
    
    const location = await openweathermapService.reverseGeocode(
      parseFloat(lat),
      parseFloat(lon)
    );
    
    if (location.error) {
      return res.status(404).json(location);
    }
    
    res.json(location);
    
  } catch (error) {
    console.error('Reverse Geocode Error:', error);
    res.status(500).json({ error: 'Lỗi khi tìm địa điểm' });
  }
}export async function getTemperatureGrid(req, res) {
  try {
    const { bounds, gridSize = 15 } = req.query;
    
    if (!bounds) {
      return res.status(400).json({ error: 'Cần cung cấp bounds (format: minLat,minLon,maxLat,maxLon)' });
    }
    
    const boundsArray = bounds.split(',').map(parseFloat);
    if (boundsArray.length !== 4 || boundsArray.some(isNaN)) {
      return res.status(400).json({ error: 'Bounds không hợp lệ' });
    }
    
    const [minLat, minLon, maxLat, maxLon] = boundsArray;
    
    // Validate bounds
    if (minLat >= maxLat || minLon >= maxLon) {
      return res.status(400).json({ error: 'Bounds không hợp lệ (min phải nhỏ hơn max)' });
    }
    
    // Limit grid size để tránh quá nhiều API calls và timeout
    const size = Math.min(parseInt(gridSize) || 10, 12); // Giảm default từ 12 xuống 10, max từ 15 xuống 12
    
    console.log(`[GRID] Fetching temperature grid for bounds: [${minLat}, ${minLon}, ${maxLat}, ${maxLon}], gridSize: ${size}`);
    
    // Tạo grid points
    const points = [];
    const latStep = (maxLat - minLat) / size;
    const lonStep = (maxLon - minLon) / size;
    
    // Lấy temperature cho mỗi grid point (batch với rate limiting để tránh timeout)
    const allPoints = [];
    for (let i = 0; i <= size; i++) {
      for (let j = 0; j <= size; j++) {
        const lat = minLat + i * latStep;
        const lon = minLon + j * lonStep;
        allPoints.push({ lat, lon });
      }
    }
    
    console.log(`[GRID] Fetching ${allPoints.length} temperature points in batches...`);
    
    // Batch processing với cache: xử lý từng nhóm 30 requests
    const BATCH_SIZE = 30; // Tăng từ 20 lên 30
    const results = [];
    let cacheHits = 0;
    let cacheMisses = 0;
    
    for (let i = 0; i < allPoints.length; i += BATCH_SIZE) {
      const batch = allPoints.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(point => {
        const cacheKey = getCacheKey(point.lat, point.lon);
        const cached = temperatureCache.get(cacheKey);
        
        // Check cache trước
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          cacheHits++;
          return Promise.resolve({
            lat: point.lat,
            lon: point.lon,
            val: cached.temperature
          });
        }
        
        // Cache miss - fetch từ API
        cacheMisses++;
        return openMeteoService.getCurrentWeather(point.lat, point.lon)
          .then(weather => {
            // Cache result
            temperatureCache.set(cacheKey, {
              temperature: weather.temperature,
              timestamp: Date.now()
            });
            return {
              lat: point.lat,
              lon: point.lon,
              val: weather.temperature
            };
          })
          .catch((err) => {
            console.warn(`[GRID] Error fetching temp for (${point.lat}, ${point.lon}):`, err.message);
            return null;
          });
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Log progress
      if ((i + BATCH_SIZE) % (BATCH_SIZE * 2) === 0 || i + BATCH_SIZE >= allPoints.length) {
        console.log(`[GRID] Progress: ${Math.min(i + BATCH_SIZE, allPoints.length)}/${allPoints.length} points (Cache: ${cacheHits} hits, ${cacheMisses} misses)`);
      }
    }
    
    console.log(`[GRID] Cache stats: ${cacheHits} hits, ${cacheMisses} misses (${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1)}% hit rate)`);
    const validPoints = results.filter(p => p !== null && p.val !== null && p.val !== undefined);
    
    console.log(`[GRID] Successfully fetched ${validPoints.length}/${allPoints.length} points`);
    
    res.json({
      points: validPoints,
      count: validPoints.length,
      bounds: { minLat, minLon, maxLat, maxLon },
      gridSize: size
    });
    
  } catch (error) {
    console.error('[GRID] Error:', error.message);
    console.error('[GRID] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Lỗi khi lấy dữ liệu grid',
      message: error.message 
    });
  }
}

