import express from 'express';
import { initiateOAuth, handleOAuthCallback } from '../controllers/oauthController.js';
import { loginToX, submit2FACode } from '../controllers/authController.js';

const router = express.Router();

// OAuth routes
router.get('/oauth/initiate', initiateOAuth);
router.get('/oauth/callback', handleOAuthCallback);
router.post('/oauth/callback', handleOAuthCallback);

// Legacy routes (can be removed once migration is complete)
router.post('/login-x', loginToX);
router.post('/submit-2fa', submit2FACode);

// Session route
router.get('/session', (req, res) => {
  res.json({
    oauthToken: req.session.oauthToken,
    oauthTokenSecret: req.session.oauthTokenSecret
  });
});

export default router;
