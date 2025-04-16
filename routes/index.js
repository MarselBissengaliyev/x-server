import express from 'express'
import {
  createPostToComposer
} from '../controllers/composerController.js'
import {
  schedulePost,
  getScheduledPosts
} from '../controllers/schedulerController.js'
import {
  loginToX,
  submit2FACode
} from '../controllers/authController.js'
import {
  generateContent
} from '../controllers/generateController.js'
import {
  getAccounts,
  addAccount,
  getAccountStats,
  updateAccountSettings,
  deleteAccount
} from '../controllers/accountController.js'
import { stopSchedule } from '../services/cronService.js'
import authRoutes from './authRoutes.js'
import adsApiRoutes from './adsApiRoutes.js'

const router = express.Router()

// Auth routes
router.use('/auth', authRoutes)
router.post('/login-x', loginToX)
router.post('/submit-2fa', submit2FACode)

// Account routes
router.get('/accounts', getAccounts)
router.post('/accounts', addAccount)
router.delete('/accounts/:accountId', deleteAccount)
router.get('/accounts/:accountId/stats', getAccountStats)
router.put('/accounts/:accountId/settings', updateAccountSettings)

// X Ads API routes
router.use('/', adsApiRoutes)

// Posts routes
router.post('/post-to-composer', createPostToComposer)
router.post('/schedule-post', schedulePost)
router.get('/scheduled-posts', getScheduledPosts)
router.delete('/accounts/:accountId/schedule', (req, res) => {
  const success = stopSchedule(req.params.accountId)
  res.json({ success })
})

// Content generation route
router.post('/generate', generateContent)
router.post('/api/generate', generateContent); // Add the generateContent route

// Global error handler for unhandled errors
router.use((err, req, res, next) => {
  console.error('Unhandled error:', err); // Log unhandled errors
  res.status(500).json({ error: 'Internal Server Error' });
});

export default router
