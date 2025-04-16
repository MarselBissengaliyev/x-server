import { postToComposer } from '../puppeteer/composerPoster.js'
import { startLoginFlow } from '../puppeteer/loginWith2FA.js'
import { generateFromOpenAI } from '../services/openaiService.js'

export const createPostToComposer = async (req, res) => {
  const {
    login,
    password,
    proxy,
    userAgent,
    accountId,
    textPrompt,
    mediaType = 'images',
  } = req.body

  try {
    const loginResult = await startLoginFlow({ login, password, proxy, userAgent })

    if (loginResult.status === '2FA_REQUIRED') {
      return res.json({ status: '2FA_REQUIRED' })
    }

    const text = await generateFromOpenAI(textPrompt, 'text')

    await postToComposer({ accountId, text, mediaType })

    res.json({ status: 'POSTED' })
  } catch (err) {
    console.error('❌ Ошибка:', err)
    res.status(500).json({ error: 'Ошибка публикации' })
  }
}
