import express from 'express'
import cors from 'cors'
import session from 'express-session'
import FileStore from 'session-file-store'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import accountRoutes from './routes/accountRoutes.js'
import authRoutes from './routes/authRoutes.js'
import sequelize from './config/database.js'
import { Account } from './models/Account.js'
import postsRouter from './routes/posts.js'
import { startScheduler } from './services/scheduleService.js'
import contentRoutes from './routes/contentRoutes.js'
import logger from './services/loggerService.js'

dotenv.config({
  path: "./.env"
})

const app = express()
const PORT = process.env.PORT || 3002

// Initialize storage
await Account.initialize()

// Session configuration
const fileStore = FileStore(session)
app.use(session({
  store: new fileStore({
    path: './sessions',
    ttl: 86400, // 24 hours
    reapInterval: 3600 // 1 hour
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// CORS configuration
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  exposedHeaders: ['set-cookie']
}))

// Add middleware to log session data
app.use((req, res, next) => {
  console.log('Session data:', req.session);
  next();
});

// Middleware для логирования всех запросов
app.use((req, res, next) => {
  logger.logAPI('REQUEST', `${req.method} ${req.originalUrl}`, req.body);
  
  // Сохраняем оригинальный метод res.json для перехвата ответов
  const originalJson = res.json;
  res.json = function(data) {
    logger.logAPI('RESPONSE', `${req.method} ${req.originalUrl}`, null, data);
    return originalJson.call(this, data);
  };
  
  next();
});

app.use(express.json())
app.use('/api/accounts', accountRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/posts', postsRouter)
app.use('/api', contentRoutes)

// Initialize database
const initializeDatabase = async () => {
  try {
    const dbPath = './database.sqlite';
    const dbExists = fs.existsSync(dbPath);
    
    if (!dbExists) {
      console.log('Database file not found, creating a new one with migrations...');
      
      // Run sync to create database file with tables based on models
      await sequelize.sync({ force: true });
      console.log('Database created and models synchronized');
      
      // If there are any additional migrations that need to be run
      try {
        const { up: createAccountsTable } = await import('./migrations/20240407_create_accounts_table.js');
        const { up: addScheduleColumn } = await import('./migrations/20240407_add_schedule_column.js');
        
        const queryInterface = sequelize.getQueryInterface();
        await createAccountsTable(queryInterface);
        console.log('Accounts table created successfully');
        await addScheduleColumn(queryInterface);
        console.log('Schedule column added successfully');
      } catch (migrationError) {
        console.warn('Migration application warning:', migrationError.message);
        console.log('Continuing with basic model sync...');
      }
    } else {
      // Normal sync if database exists
      await sequelize.sync();
      console.log('Database connected and models synchronized');
    }
    
    // Start the scheduler
    startScheduler();
    console.log('Scheduler started');
    
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Database connection error:', err);
  }
};

initializeDatabase();
