import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import axios from 'axios';

import weatherRoutes from './routes/weather.routes.js';
import mapRoutes from './routes/map.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: function (origin, callback) {
    // Cho phép requests không có origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('[CORS] Allowing request without origin (likely mobile app)');
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://localhost',
      process.env.FRONTEND_URL,
    ].filter(Boolean);
    
    // Cho phép tất cả Cloudflare Pages domains (production và preview)
    const isCloudflarePages = /\.pages\.dev$/.test(origin) || /^https?:\/\/[^/]+\.pages\.dev/.test(origin);
    // Cho phép tất cả Railway domains
    const isRailway = /\.railway\.app$/.test(origin);
    // Cho phép tất cả Render domains
    const isRender = /\.onrender\.com$/.test(origin);
    // Cho phép tất cả Vercel domains
    const isVercel = /\.vercel\.app$/.test(origin);
    
    if (allowedOrigins.includes(origin) || isCloudflarePages || isRailway || isRender || isVercel) {
      console.log(`[CORS] Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 300, // Tăng từ 100 lên 300 requests để tránh bị chặn khi demo
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`[RATE LIMIT] Too many requests from ${req.ip} - ${req.method} ${req.path}`);
    res.status(429).json({
      error: 'Quá nhiều requests. Vui lòng thử lại sau.',
      retryAfter: Math.ceil(15 * 60 / 1000) // seconds
    });
  }
});
app.use('/api/', limiter);

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const query = Object.keys(req.query).length > 0 ? `?${new URLSearchParams(req.query).toString()}` : '';
  console.log(`[${timestamp}] ${method} ${path}${query}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Weather Backend API with Open-Meteo + Mapbox',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend đang chạy!',
    stack: {
      weather: 'Open-Meteo (FREE)',
      map: 'Leaflet (Frontend)',
      geocoding: 'Mapbox'
    },
    apis: {
      currentWeather: '/api/weather/current?city=Hanoi',
      forecast: '/api/weather/forecast?city=Hanoi&days=7',
      hourly: '/api/weather/hourly?city=Hanoi&hours=24',
      search: '/api/map/search?q=Hanoi',
      reverse: '/api/map/reverse?lat=21.0285&lon=105.8542'
    },
    rateLimit: {
      max: 300,
      windowMs: '15 minutes',
      note: 'Check X-RateLimit-* headers in response'
    }
  });
});

app.get('/api/ratelimit', (req, res) => {
  const rateLimitInfo = req.rateLimit || {};
  res.json({
    limit: rateLimitInfo.limit || 100,
    remaining: rateLimitInfo.remaining || 'unknown',
    reset: rateLimitInfo.resetTime || 'unknown',
    current: rateLimitInfo.totalHits || 'unknown'
  });
});

app.get('/api/check', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    env: {
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY ? 'SET' : 'MISSING',
      FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET',
      PORT: process.env.PORT || '5000 (default)',
      NODE_ENV: process.env.NODE_ENV || 'NOT SET'
    },
    services: {}
  };

  const startTime = Date.now();
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: 21.0285,
        longitude: 105.8542,
        current: 'temperature_2m',
        timezone: 'Asia/Bangkok'
      },
      timeout: 5000
    });
    const responseTime = Date.now() - startTime;
    checks.services.openMeteo = {
      status: 'OK',
      responseTime: `${responseTime}ms`,
      hasData: !!response.data?.current,
      statusCode: response.status
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    checks.services.openMeteo = {
      status: 'ERROR',
      error: error.message,
      code: error.code,
      responseStatus: error.response?.status,
      responseTime: `${responseTime}ms`
    };
  }

  const geocodeStartTime = Date.now();
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      checks.services.openWeatherGeocoding = {
        status: 'SKIP',
        error: 'OPENWEATHER_API_KEY not set'
      };
    } else {
      const response = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
        params: {
          q: 'Hanoi',
          limit: 1,
          appid: apiKey
        },
        timeout: 5000
      });
      const responseTime = Date.now() - geocodeStartTime;
      checks.services.openWeatherGeocoding = {
        status: 'OK',
        found: response.data?.length > 0,
        responseStatus: response.status,
        responseTime: `${responseTime}ms`
      };
    }
  } catch (error) {
    const responseTime = Date.now() - geocodeStartTime;
    checks.services.openWeatherGeocoding = {
      status: 'ERROR',
      error: error.message,
      code: error.code,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      responseTime: `${responseTime}ms`
    };
  }

  const reverseStartTime = Date.now();
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      checks.services.openWeatherReverse = {
        status: 'SKIP',
        error: 'OPENWEATHER_API_KEY not set'
      };
    } else {
      const response = await axios.get('https://api.openweathermap.org/geo/1.0/reverse', {
        params: {
          lat: 21.0285,
          lon: 105.8542,
          limit: 1,
          appid: apiKey
        },
        timeout: 5000
      });
      const responseTime = Date.now() - reverseStartTime;
      checks.services.openWeatherReverse = {
        status: 'OK',
        found: response.data?.length > 0,
        responseStatus: response.status,
        responseTime: `${responseTime}ms`
      };
    }
  } catch (error) {
    const responseTime = Date.now() - reverseStartTime;
    checks.services.openWeatherReverse = {
      status: 'ERROR',
      error: error.message,
      code: error.code,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      responseTime: `${responseTime}ms`
    };
  }

  res.json(checks);
});

app.get('/api/debug', (req, res) => {
  res.json({
    env: {
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY ? `${process.env.OPENWEATHER_API_KEY.substring(0, 8)}...` : 'NOT SET',
      FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET',
      PORT: process.env.PORT || '5000 (default)',
      NODE_ENV: process.env.NODE_ENV || 'NOT SET',
      OPEN_METEO_BASE_URL: process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1 (default)'
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    },
    timestamp: new Date().toISOString()
  });
});

app.use('/api/weather', weatherRoutes);
app.use('/api/map', mapRoutes);

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route không tồn tại',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Lỗi server!',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Weather Backend API Server');
  console.log('='.repeat(60));
  console.log(`📍 Server:     http://localhost:${PORT}`);
  console.log(`🏥 Health:     http://localhost:${PORT}/health`);
  console.log(`🧪 Test:       http://localhost:${PORT}/api/test`);
  console.log(`🔍 Check APIs: http://localhost:${PORT}/api/check`);
  console.log(`🐛 Debug:      http://localhost:${PORT}/api/debug`);
  console.log(`🌤️  Weather:    Open-Meteo (FREE)`);
  console.log(`🗺️  Geocoding:  Mapbox`);
  console.log(`🌍 Env:        ${process.env.NODE_ENV}`);
  console.log('='.repeat(60));
});