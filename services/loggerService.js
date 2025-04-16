import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');
const API_LOG_FILE = path.join(LOG_DIR, 'api.log');
const OPENAI_LOG_FILE = path.join(LOG_DIR, 'openai.log');
const TWITTER_LOG_FILE = path.join(LOG_DIR, 'twitter.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

// Убедиться, что директория для логов существует
async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create log directory:', error);
  }
}

ensureLogDir();

// Форматирование даты для логов
function getTimestamp() {
  return new Date().toISOString();
}

// Логирование в файл и консоль
async function logToFileAndConsole(message, logFile) {
  const timestamp = getTimestamp();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  // Логируем в консоль
  console.log(logEntry.trim());
  
  // Логируем в файл
  try {
    await fs.appendFile(logFile, logEntry);
  } catch (error) {
    console.error(`Failed to write to log file ${logFile}:`, error);
  }
}

// Логирование запросов и ответов OpenAI
export async function logOpenAI(type, data) {
  let message = `[OpenAI] [${type}]`;
  
  if (typeof data === 'object') {
    message += ' ' + JSON.stringify(data, null, 2);
  } else {
    message += ' ' + data;
  }
  
  await logToFileAndConsole(message, OPENAI_LOG_FILE);
}

// Логирование запросов и ответов Twitter
export async function logTwitter(type, data) {
  let message = `[Twitter] [${type}]`;
  
  if (typeof data === 'object') {
    try {
      // Обрабатываем большие объекты для логов
      const simplifiedData = { ...data };
      
      // Сокращаем токены для безопасности
      if (simplifiedData.accessToken) {
        simplifiedData.accessToken = simplifiedData.accessToken.substring(0, 10) + '...';
      }
      if (simplifiedData.accessTokenSecret) {
        simplifiedData.accessTokenSecret = simplifiedData.accessTokenSecret.substring(0, 5) + '...';
      }
      
      // Обрезаем длинные тексты
      if (simplifiedData.text && simplifiedData.text.length > 100) {
        simplifiedData.text = simplifiedData.text.substring(0, 100) + '...';
      }
      
      message += ' ' + JSON.stringify(simplifiedData, null, 2);
    } catch (e) {
      message += ' [Object too large to stringify]';
    }
  } else {
    message += ' ' + data;
  }
  
  await logToFileAndConsole(message, TWITTER_LOG_FILE);
}

// Логирование API запросов
export async function logAPI(method, endpoint, body = null, response = null) {
  let message = `[API] ${method} ${endpoint}`;
  
  if (body) {
    try {
      const safeBody = { ...body };
      // Скрываем конфиденциальные данные
      if (safeBody.password) safeBody.password = '********';
      if (safeBody.accessToken) safeBody.accessToken = safeBody.accessToken.substring(0, 10) + '...';
      if (safeBody.accessTokenSecret) safeBody.accessTokenSecret = safeBody.accessTokenSecret.substring(0, 5) + '...';
      
      message += `\nRequest Body: ${JSON.stringify(safeBody, null, 2)}`;
    } catch (e) {
      message += '\nRequest Body: [Failed to stringify]';
    }
  }
  
  if (response) {
    try {
      message += `\nResponse: ${JSON.stringify(response, null, 2)}`;
    } catch (e) {
      message += '\nResponse: [Failed to stringify]';
    }
  }
  
  await logToFileAndConsole(message, API_LOG_FILE);
}

// Логирование ошибок
export async function logError(source, error) {
  let message = `[ERROR] [${source}] `;
  
  if (error instanceof Error) {
    message += `${error.name}: ${error.message}\n${error.stack || ''}`;
  } else if (typeof error === 'object') {
    try {
      message += JSON.stringify(error, null, 2);
    } catch (e) {
      message += '[Object too large to stringify]';
    }
  } else {
    message += error;
  }
  
  await logToFileAndConsole(message, ERROR_LOG_FILE);
}

// Общее логирование действий пользователя
export async function logAction(userId, action, details = null) {
  let message = `[USER:${userId || 'anonymous'}] ${action}`;
  
  if (details) {
    try {
      message += ` ${JSON.stringify(details, null, 2)}`;
    } catch (e) {
      message += ' [Details too large to stringify]';
    }
  }
  
  await logToFileAndConsole(message, API_LOG_FILE);
}

export default {
  logOpenAI,
  logTwitter,
  logAPI,
  logError,
  logAction
}; 