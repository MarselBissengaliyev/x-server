import express from 'express';
import { generatePost, publishPost } from '../controllers/postController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all post routes
router.use(isAuthenticated);

// Generate post content
router.post('/generate', generatePost);

// Publish post
router.post('/publish', publishPost);

export default router; 