import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { getBrowserInstance } from './loginWith2FA.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 🔄 Парсинг Account ID из редиректа
export async function extractAccountIdFromRedirect(page) {
  await page.goto('https://ads.x.com', { waitUntil: 'networkidle2' })
  const url = page.url()
  const match = url.match(/analytics\/([^/]+)\/campaigns/)
  return match?.[1] || null
}

// 🖼 Выбор случайного медиафайла
export async function pickRandomMedia(mediaFolder) {
  const absPath = path.join(__dirname, '..', 'uploads', mediaFolder)
  const files = await fs.readdir(absPath)
  const media = files.filter(file => /\.(jpg|png|jpeg|mp4)$/i.test(file))
  if (!media.length) throw new Error('Нет доступных медиафайлов в ' + mediaFolder)

  const chosen = media[Math.floor(Math.random() * media.length)]
  return path.join(absPath, chosen)
}

// 🚀 Публикация в Composer
export async function postToComposer({ accountId, text, mediaType = 'images' }) {
  const browser = getBrowserInstance()
  const page = await browser.newPage()

  // Переход в composer
  if (!accountId) {
    accountId = await extractAccountIdFromRedirect(page)
    if (!accountId) throw new Error('Не удалось получить accountId')
  }

  const composerUrl = `https://ads.x.com/composer/${accountId}/carousel`
  await page.goto(composerUrl, { waitUntil: 'networkidle2' })
  console.log('✅ Открыт composer:', composerUrl)

  // Ввод текста
  await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 })
  await page.click('div[contenteditable="true"]')
  await page.keyboard.type(text)

  // Загрузка изображения или видео
  const filePath = await pickRandomMedia(mediaType)
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.click('input[type="file"], div[role="button"]:has(input[type="file"])'),
  ])
  await fileChooser.accept([filePath])
  console.log('📎 Медиа загружено:', path.basename(filePath))

  // Ожидание загрузки медиа
  await page.waitForTimeout(3000)

  // Нажать кнопку "Post"
  const postButton = await page.$x("//span[contains(text(), 'Post') or contains(text(), 'Опубликовать')]")
  if (postButton.length) {
    await postButton[0].click()
    console.log('✅ Пост отправлен в X Ads Composer!')
  } else {
    throw new Error('Кнопка "Post" не найдена')
  }

  await page.close()
}
