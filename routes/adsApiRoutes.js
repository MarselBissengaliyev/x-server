import express from 'express';
import { publishTweetAdsAPI } from '../controllers/postController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all ads API routes
router.use(isAuthenticated);

// X Ads API - Publish Tweet
// Endpoint: POST /12/accounts/:account_id/tweet
router.post('/12/accounts/:account_id/tweet', publishTweetAdsAPI);

export default router; 