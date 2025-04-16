import cron from 'node-cron'
import { Account } from '../models/Account.js'
import { makePost } from '../controllers/accountController.js'

const schedules = new Map()

export const getAccountSchedule = (accountId) => {
  return schedules.get(accountId)
}

export const stopSchedule = (accountId) => {
  const schedule = schedules.get(accountId)
  if (schedule) {
    schedule.stop()
    schedules.delete(accountId)
  }
}

export const startSchedule = async (accountId) => {
  // Stop existing schedule if any
  stopSchedule(accountId)

  try {
    const account = await Account.findByPk(accountId)
    if (!account || !account.settings.autoposting) {
      return
    }

    const { schedule, customTime, postingDays } = account.settings
    let cronExpression

    switch (schedule) {
      case 'hourly':
        cronExpression = '0 * * * *'
        break
      case 'daily':
        const [hours, minutes] = customTime.split(':')
        cronExpression = `${minutes} ${hours} * * *`
        break
      case 'weekly':
        const [weeklyHours, weeklyMinutes] = customTime.split(':')
        const days = postingDays.map(day => day.toLowerCase().slice(0, 3)).join(',')
        cronExpression = `${weeklyMinutes} ${weeklyHours} * * ${days}`
        break
      default:
        console.error(`Invalid schedule type: ${schedule}`)
        return
    }

    const task = cron.schedule(cronExpression, async () => {
      try {
        // Get a random prompt from the account's prompts
        const prompts = account.settings.prompts.split('\n').filter(p => p.trim())
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)]

        // Make the post
        await makePost(account, randomPrompt)

        // Update lastPostTime
        await account.update({
          lastPostTime: new Date(),
          settings: {
            ...account.settings,
            lastPostTime: new Date()
          }
        })

        console.log(`✅ [Cron] Posted successfully for account ${account.username}`)
      } catch (error) {
        console.error(`❌ [Cron] Error posting for account ${account.username}:`, error)
      }
    })

    schedules.set(accountId, task)
    console.log(`✅ [Cron] Schedule started for account ${account.username}`)
  } catch (error) {
    console.error(`❌ [Cron] Error starting schedule for account ${accountId}:`, error)
  }
}

export const getActiveTasks = () => {
  return Array.from(schedules.entries()).map(([accountId, task]) => ({
    accountId,
    schedule: task.schedule,
    createdAt: task.createdAt,
    lastRun: task.lastRun
  }))
}
