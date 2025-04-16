import { scheduleNewPost, getActiveTasks } from '../services/cronService.js'
import { createPostToComposer } from './composerController.js'

export const schedulePost = async (req, res) => {
  const { cronTime, account, textPrompt, mediaType } = req.body

  try {
    scheduleNewPost(cronTime, async () => {
      await createPostToComposer({
        body: {
          ...account,
          textPrompt,
          mediaType,
        }
      }, { json: () => {}, status: () => ({ json: () => {} }) })
    })

    res.json({ status: 'Scheduled' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Ошибка при планировании поста' })
  }
}

export const getScheduledPosts = async (req, res) => {
  const tasks = getActiveTasks()
  res.json({ tasks: tasks.length })
}
