import { Account } from '../models/Account.js'
import { getAccountSchedule, stopSchedule } from '../services/cronService.js'
import { TwitterApi } from 'twitter-api-v2'
import { scheduleWeeklyPosts } from '../services/scheduleService.js'

export const getAccounts = async (req, res) => {
  try {
    console.log('Fetching all accounts...')
    const accounts = await Account.findAll({
      attributes: ['id', 'username', 'accessToken', 'accessTokenSecret', 'settings', 'createdAt', 'updatedAt']
    })
    console.log('Found accounts:', accounts.length)
    res.json(accounts)
  } catch (error) {
    console.error('Error fetching accounts:', error)
    res.status(500).json({ error: 'Failed to fetch accounts' })
  }
}

export const addAccount = async (req, res) => {
  try {
    const { username, accessToken, accessTokenSecret } = req.body
    console.log('Adding new account with username:', username)

    const account = await Account.create({
      username,
      accessToken,
      accessTokenSecret
    })

    console.log('Account created:', account.id, 'Username:', account.username)
    res.status(201).json(account)
  } catch (error) {
    console.error('Error adding account:', error)
    res.status(500).json({ error: 'Failed to add account' })
  }
}

export const deleteAccount = async (req, res) => {
  try {
    const { accountId } = req.params
    console.log('Attempting to delete account with ID:', accountId)

    const account = await Account.findByPk(accountId);
    if (!account) {
      console.log('Account not found:', accountId)
      return res.status(404).json({ error: 'Account not found' })
    }

    await account.destroy()
    console.log('Account deleted successfully with ID:', accountId)
    res.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Error deleting account:', error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
}

export const getAccountStats = async (req, res) => {
  const { accountId } = req.params
  const { days = 7 } = req.query

  if (!accountId) {
    console.error('❌ [Backend] Missing accountId in request')
    return res.status(400).json({ error: 'Account ID is required' })
  }

  try {
    console.log('Fetching stats for account ID:', accountId, 'for the last', days, 'days')
    const stats = await Account.getStats(accountId, parseInt(days))
    if (!stats) {
      console.error(`❌ [Backend] Account not found for ID: ${accountId}`)
      return res.status(404).json({ error: 'Account not found' })
    }
    console.log('Fetched stats for account ID:', accountId)
    res.json(stats)
  } catch (error) {
    console.error('❌ [Backend] Failed to fetch account stats:', error.message)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
}

// Function to make a post using Twitter API
export const makePost = async (account, prompt) => {
  try {
    console.log('Making post for account ID:', account.id)
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: account.accessToken,
      accessSecret: account.accessTokenSecret
    })

    const response = await client.v2.tweet(prompt)
    console.log('Post successfully made for account ID:', account.id, 'Tweet:', response.data)
    return response.data
  } catch (error) {
    console.error('Error making post for account ID:', account.id, error)
    throw error
  }
}

// Update account settings
export const updateSettings = async (req, res) => {
  try {
    const { accountId } = req.params
    const settings = req.body
    console.log('Updating settings for account ID:', accountId, 'with settings:', settings)

    const account = await Account.findByPk(accountId)
    if (!account) {
      console.error('Account not found:', accountId)
      return res.status(404).json({ error: 'Account not found' })
    }

    // Update settings
    await account.update({ settings })

    // If autoposting is enabled, schedule posts
    if (settings.autoposting && settings.schedule !== 'not_scheduled') {
      console.log('Scheduling weekly posts for account ID:', accountId)
      await scheduleWeeklyPosts(account)
    }

    console.log('Settings updated successfully for account ID:', accountId)
    res.json(account)
  } catch (error) {
    console.error('Error updating settings for account ID:', accountId, error)
    res.status(500).json({ error: 'Failed to update settings', details: error.message })
  }
}

// Get account settings
export const getAccountSettings = async (req, res) => {
  try {
    const { accountId } = req.params
    console.log('Fetching settings for account ID:', accountId)

    const account = await Account.findByPk(accountId)
    
    if (!account) {
      console.error('Account not found:', accountId)
      return res.status(404).json({ error: 'Account not found' })
    }

    console.log('Fetched settings for account ID:', accountId)
    res.json(account.settings)
  } catch (error) {
    console.error('Error getting settings for account ID:', req.params.accountId, error)
    res.status(500).json({ error: 'Failed to get settings' })
  }
}
