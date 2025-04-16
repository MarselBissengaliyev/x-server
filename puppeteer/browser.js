import puppeteer from 'puppeteer-core'

let browserInstance = null

export async function getBrowser({ proxy, userAgent }) {
  if (browserInstance) return browserInstance

  const [host, port] = proxy.split(':')
  browserInstance = await puppeteer.launch({
    headless: process.env.NODE_ENV === 'production',
    executablePath: process.env.CHROME_EXECUTABLE,
    userDataDir: './user_data/chrome',
    args: [
      `--proxy-server=${host}:${port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  })

  const page = await browserInstance.newPage()
  await page.setUserAgent(userAgent)

  return browserInstance
}
