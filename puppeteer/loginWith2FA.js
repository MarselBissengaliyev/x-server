import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';

puppeteer.use(StealthPlugin());

const SESSION_PATH = './user_data/session.json';
let savedPage = null;
let browserInstance = null;

// 🔧 Вспомогательная функция: сохраняем cookies
async function saveSession(page) {
  const cookies = await page.cookies()
  const localStorageData = await page.evaluate(() => {
    const data = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      data[key] = localStorage.getItem(key)
    }
    return data
  })

  await fs.mkdir(path.dirname(SESSION_PATH), { recursive: true })
  await fs.writeFile(SESSION_PATH, JSON.stringify({ cookies, localStorage: localStorageData }, null, 2))
  
  // Also save cookies separately for easier access
  await fs.writeFile('./data/cookies.json', JSON.stringify(cookies, null, 2))
}

// 🔁 Восстановление сессии
async function loadSession(page) {
  try {
    const data = JSON.parse(await fs.readFile(SESSION_PATH, 'utf-8'))
    await page.setCookie(...data.cookies)

    await page.evaluate((data) => {
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, value)
      }
    }, data.localStorage)

    console.log('✅ Сессия восстановлена из файла')
  } catch {
    console.log('ℹ️ Нет сохранённой сессии')
  }
}

// 🧠 Запуск логина
async function extractAuthToken(page) {
  try {
    const cookies = await page.cookies();
    const authTokenCookie = cookies.find(cookie => cookie.name === 'auth_token');
    if (authTokenCookie) {
      console.log('✅ Auth token extracted:', authTokenCookie.value);
      return authTokenCookie.value;
    }
    console.warn('⚠️ Auth token not found in cookies.');
    return null;
  } catch (err) {
    console.error('❌ Failed to extract auth token:', err.message);
    return null;
  }
}

export async function startLoginFlow({ login, password, proxy, userAgent }) {
  const [proxyHost, proxyPort, proxyLogin, proxyPass] = proxy.split(':');

  browserInstance = await puppeteer.launch({
    headless: false, // Отключаем headless для отладки
    userDataDir: './user_data/chrome', // сохраняем всё
    args: [
      `--proxy-server=${proxyHost}:${proxyPort}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const page = await browserInstance.newPage();

  // Прокси авторизация
  if (proxyLogin && proxyPass) {
    await page.authenticate({ username: proxyLogin, password: proxyPass });
  }

  await page.setUserAgent(userAgent);

  try {
    console.log('🔧 Navigating to X homepage...');
    await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });

    console.log('🔧 Attempting to restore session...');
    await loadSession(page);

    // Validate session by checking if the user is logged in
    if (page.url().includes('/home')) {
      console.log('✅ Session restored and valid. Saving session...');
      await saveSession(page); // Save session after confirming login
      return { status: 'SUCCESS', message: 'Login successful' };
    }

    console.log('ℹ️ Session invalid or expired. Proceeding with login flow...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'networkidle2' });

    console.log('🔧 Entering login credentials...');
    await page.waitForSelector('input[name="text"]', { timeout: 10000 });
    await page.type('input[name="text"]', login);
    await page.keyboard.press('Enter');

    await new Promise((resolve) => setTimeout(resolve, 1500));

    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await page.type('input[name="password"]', password);
    await page.keyboard.press('Enter');

    console.log('🔧 Checking for 2FA requirement...');
    const is2FARequired = await page.$('input[name="challenge_response"]');
    if (is2FARequired) {
      savedPage = page; // Сохраняем страницу для продолжения
      console.log('🔧 2FA required.');
      return { status: '2FA_REQUIRED', message: 'Two-factor authentication required' };
    }

    console.log('🔧 Checking for email verification requirement...');
    const isEmailVerificationRequired = await page.$('input[name="email_verification_code"]');
    if (isEmailVerificationRequired) {
      savedPage = page; // Сохраняем страницу для продолжения
      console.log('🔧 Email verification required.');
      return { status: 'EMAIL_VERIFICATION_REQUIRED', message: 'Email verification required' };
    }

    console.log('✅ Login successful. Extracting auth token...');
    const authToken = await extractAuthToken(page);
    
    // Ensure we have the auth token
    if (!authToken) {
      console.warn('⚠️ No auth token found, attempting to get all cookies as fallback');
      const cookies = await page.cookies();
      await fs.mkdir('./data', { recursive: true });
      await fs.writeFile('./data/cookies.json', JSON.stringify(cookies, null, 2));
    }

    console.log('✅ Saving session...');
    await saveSession(page);

    console.log('🔧 Closing browser after successful login...');
    await browserInstance.close();

    return { 
      status: 'SUCCESS', 
      message: 'Login successful', 
      authToken: authToken || 'token-not-found' 
    };
  } catch (err) {
    console.error('❌ Login flow failed:', err.message);
    if (browserInstance) {
      console.log('🔧 Closing browser due to error...');
      await browserInstance.close();
    }
    throw err;
  }
}

// ➕ Ввод кода из UI → продолжаем логин
export async function continueLoginWith2FA(code) {
  if (!savedPage) return { status: 'ERROR', message: 'No saved page for 2FA' }

  try {
    console.log('🔧 Entering 2FA code:', code)
    await savedPage.type('input[name="challenge_response"]', code)
    await savedPage.keyboard.press('Enter')
    
    // Ждем перенаправления после успешной авторизации
    console.log('🔧 Waiting for navigation after 2FA...')
    await savedPage.waitForNavigation({ waitUntil: 'networkidle2' })
    
    console.log('✅ Navigation complete. Extracting auth token...')
    // Извлекаем токен auth_token
    const authToken = await extractAuthToken(savedPage)
    
    // Убедимся, что у нас есть токен
    if (!authToken) {
      console.warn('⚠️ No auth token found after 2FA, saving all cookies as fallback')
      const cookies = await savedPage.cookies()
      await fs.mkdir('./data', { recursive: true })
      await fs.writeFile('./data/cookies.json', JSON.stringify(cookies, null, 2))
    } else {
      console.log('✅ Auth token successfully extracted after 2FA:', authToken)
    }

    console.log('✅ Saving session after 2FA...')
    await saveSession(savedPage)
    
    console.log('🔧 Closing browser after successful 2FA...')
    await browserInstance.close()
    
    return { 
      status: 'SUCCESS', 
      message: 'Login successful with 2FA',
      authToken: authToken || 'token-not-found'
    }
  } catch (err) {
    console.error('❌ 2FA submission failed:', err)
    if (browserInstance) {
      console.log('🔧 Attempting to close browser after 2FA error...')
      await browserInstance.close()
    }
    return { status: 'FAILED', message: '2FA submission failed: ' + err.message }
  }
}

// ➕ Ввод кода из UI → продолжаем логин с подтверждением через email
export async function continueLoginWithEmailCode(code) {
  if (!savedPage) return { status: 'ERROR', message: 'No saved page for email verification' };

  try {
    await savedPage.type('input[name="email_verification_code"]', code);
    await savedPage.keyboard.press('Enter');
    await savedPage.waitForNavigation({ waitUntil: 'networkidle2' });

    await saveSession(savedPage);
    await browserInstance.close(); // Закрываем браузер после успешного завершения
    return { status: 'LOGGED_IN', message: 'Login successful with email verification' };
  } catch (err) {
    console.error('Email verification submission failed:', err);
    return { status: 'FAILED', message: 'Email verification submission failed' };
  }
}

// 📤 Внешний доступ к браузеру (например, для composer)
export function getBrowserInstance() {
  return browserInstance
}

// Graceful shutdown to close the browser instance
process.on('SIGTERM', async () => {
  console.log('🔧 Closing browser instance due to server shutdown...');
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit();
});

process.on('SIGINT', async () => {
  console.log('🔧 Closing browser instance due to server shutdown...');
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit();
});