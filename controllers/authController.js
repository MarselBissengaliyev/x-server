import { 
  startLoginFlow, 
  continueLoginWith2FA, 
  continueLoginWithEmailCode 
} from '../puppeteer/loginWith2FA.js';
import fs from 'fs/promises';

// Handle initial login to X
export const loginToX = async (req, res) => {
  try {
    const { login, password, proxy, userAgent } = req.body;
    
    if (!login || !password || !proxy || !userAgent) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Missing required login credentials'
      });
    }
    
    const result = await startLoginFlow({ login, password, proxy, userAgent });
    
    if (result.status === 'SUCCESS') {
      // Create account object with real auth token
      const account = {
        login,
        proxy,
        userAgent,
        token: result.authToken || 'token-not-found',
        settings: {
          textPrompt: "",
          imagePrompt: "",
          hashtagPrompt: "",
          targetUrl: "",
          promotedOnly: false,
          schedule: null,
          autoposting: false
        },
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        posts: {
          total: 0,
          today: 0
        }
      };
      
      res.json({
        status: result.status,
        message: result.message,
        account
      });
    } else {
      // For 2FA or other states, just pass through the result
      res.json(result);
    }
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      message: `Login failed: ${error.message}` 
    });
  }
};

// Handle 2FA code submission
export const submit2FACode = async (req, res) => {
  try {
    const { code, account } = req.body;
    
    if (!code) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Missing 2FA code'
      });
    }
    
    console.log('🔧 Receiving 2FA code:', code);
    const result = await continueLoginWith2FA(code);
    
    if (result.status === 'SUCCESS') {
      // If we have the account from the request, update it
      if (account) {
        account.token = result.authToken || 'token-not-found';
        
        res.json({
          status: 'SUCCESS',
          message: 'Login successful with 2FA',
          account
        });
        return;
      }
      
      // If no account provided, create a basic one with the token
      res.json({
        status: 'SUCCESS',
        message: 'Login successful with 2FA',
        token: result.authToken || 'token-not-found'
      });
    } else {
      // If 2FA failed, just return the result
      res.json(result);
    }
  } catch (error) {
    console.error('❌ 2FA submission error:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      message: `2FA submission failed: ${error.message}` 
    });
  }
};

// Handle email verification code submission
export const submitEmailCode = async (req, res) => {
  try {
    const { code, account } = req.body;
    
    if (!code) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Missing email verification code'
      });
    }
    
    const result = await continueLoginWithEmailCode(code);
    
    if (result.status === 'LOGGED_IN') {
      try {
        // Try to read the cookies file to get the auth token
        const cookiesData = await import('fs/promises').then(fs => 
          fs.readFile('./data/cookies.json', 'utf-8')
        );
        
        const cookies = JSON.parse(cookiesData);
        const authTokenCookie = cookies.find(cookie => cookie.name === 'auth_token');
        
        if (authTokenCookie && authTokenCookie.value) {
          // If we have the account from the request, update it
          if (account) {
            account.token = authTokenCookie.value;
            
            res.json({
              status: 'SUCCESS',
              message: 'Login successful with email verification',
              account
            });
            return;
          }
        }
      } catch (err) {
        console.error('❌ Failed to read auth token from cookies:', err);
      }
    }
    
    // If we can't get the token or update the account, just return the result
    res.json(result);
  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      message: `Email verification failed: ${error.message}` 
    });
  }
};