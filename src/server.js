import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

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
  console.log(`🌤️  Weather:    Open-Meteo (FREE)`);
  console.log(`🗺️  Geocoding:  Mapbox`);
  console.log(`🌍 Env:        ${process.env.NODE_ENV}`);
  console.log('='.repeat(60));
});