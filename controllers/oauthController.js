import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { Account } from '../models/Account.js';

// For desktop applications, we need to use 'oob' as callback
const CALLBACK_URL = 'oob';
const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';
const AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize';

// Debug environment variables
console.log('Environment variables:');
console.log('TWITTER_API_KEY:', process.env.TWITTER_API_KEY ? '✅ Present' : '❌ Missing');
console.log('TWITTER_API_SECRET:', process.env.TWITTER_API_SECRET ? '✅ Present' : '❌ Missing');

// Initialize OAuth with API credentials
const oauth = new OAuth({
  consumer: {
    key: process.env.TWITTER_API_KEY,
    secret: process.env.TWITTER_API_SECRET
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto
      .createHmac('sha1', key)
      .update(base_string)
      .digest('base64');
  }
});

export const initiateOAuth = async (req, res) => {
  try {
    console.log('Initiating OAuth process...');
    console.log('API Key:', process.env.TWITTER_API_KEY);

    const requestData = {
      url: REQUEST_TOKEN_URL,
      method: 'POST',
      data: { oauth_callback: CALLBACK_URL }
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData));
    console.log('Auth header:', authHeader);

    const response = await fetch(requestData.url, {
      method: requestData.method,
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Twitter API error:', error);
      throw new Error(`Twitter API error: ${error}`);
    }

    const responseText = await response.text();
    console.log('Twitter response:', responseText);
    
    const urlParams = new URLSearchParams(responseText);
    const oauthToken = urlParams.get('oauth_token');
    const oauthTokenSecret = urlParams.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error('Invalid response from Twitter API');
    }

    // Store tokens in session
    req.session.oauthToken = oauthToken;
    req.session.oauthTokenSecret = oauthTokenSecret;
    await req.session.save();

    console.log('Session after storing tokens:', req.session);

    const authorizeUrl = `${AUTHORIZE_URL}?oauth_token=${oauthToken}`;
    console.log('Generated authorize URL:', authorizeUrl);
    
    res.json({ 
      success: true,
      authorizeUrl 
    });
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

export const handleOAuthCallback = async (req, res) => {
  try {
    console.log('Handling OAuth callback...');
    console.log('Session:', req.session);

    const { oauth_token, oauth_verifier } = req.method === 'GET' ? req.query : req.body;
    const oauthTokenSecret = req.session.oauthTokenSecret;

    console.log('Tokens from request:', { oauth_token, oauth_verifier });
    console.log('Token secret from session:', oauthTokenSecret);

    if (!oauth_token || !oauth_verifier || !oauthTokenSecret) {
      throw new Error('Missing required OAuth parameters');
    }

    const requestData = {
      url: 'https://api.twitter.com/oauth/access_token',
      method: 'POST',
      data: {
        oauth_token,
        oauth_verifier
      }
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData));

    const response = await fetch(requestData.url, {
      method: requestData.method,
      headers: {
        ...authHeader,
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Twitter API error:', error);
      throw new Error(`Twitter API error: ${error}`);
    }

    const responseText = await response.text();
    const result = new URLSearchParams(responseText);
    
    const accessToken = result.get('oauth_token');
    const accessTokenSecret = result.get('oauth_token_secret');
    const screenName = result.get('screen_name');
    const userId = result.get('user_id');

    // Save the account to the database
    const account = await Account.create({
      id: userId,
      username: screenName,
      accessToken,
      accessTokenSecret
    });

    res.json({ success: true, account });
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.status(500).json({ error: error.message });
  }
}; 