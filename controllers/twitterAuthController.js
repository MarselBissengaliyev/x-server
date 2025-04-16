import OAuth from 'oauth-1.0a';
import CryptoJS from 'crypto-js';
import axios from 'axios';

const CALLBACK_URL = 'http://localhost:3001/api/twitter/callback';
const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';
const AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize';

export const initiateTwitterAuth = async (req, res) => {
  const { apiKey, apiSecret } = req.body;

  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'API key and secret are required' });
  }

  const oauth = OAuth({
    consumer: {
      key: apiKey,
      secret: apiSecret,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return CryptoJS.HmacSHA1(baseString, key).toString(CryptoJS.enc.Base64);
    },
  });

  try {
    const requestData = {
      url: REQUEST_TOKEN_URL,
      method: 'POST',
      data: { oauth_callback: CALLBACK_URL },
    };

    const headers = oauth.toHeader(oauth.authorize(requestData));

    const response = await axios.post(REQUEST_TOKEN_URL, null, { headers });
    const params = new URLSearchParams(response.data);

    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    // Store the request token and secret temporarily
    req.session.oauthTokenSecret = oauthTokenSecret;

    // Redirect the user to Twitter's authorization page
    res.json({ url: `${AUTHORIZE_URL}?oauth_token=${oauthToken}` });
  } catch (err) {
    console.error('❌ [Backend] Failed to initiate Twitter OAuth:', err.message);
    res.status(500).json({ error: 'Failed to initiate Twitter OAuth' });
  }
};

export const handleTwitterCallback = async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const { apiKey, apiSecret } = req.session;

  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'API key and secret are missing from session' });
  }

  const oauth = OAuth({
    consumer: {
      key: apiKey,
      secret: apiSecret,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return CryptoJS.HmacSHA1(baseString, key).toString(CryptoJS.enc.Base64);
    },
  });

  try {
    const oauthTokenSecret = req.session.oauthTokenSecret;
    if (!oauthTokenSecret) {
      throw new Error('Invalid or expired request token');
    }

    const requestData = {
      url: ACCESS_TOKEN_URL,
      method: 'POST',
      data: { oauth_verifier },
    };

    const headers = oauth.toHeader(
      oauth.authorize(requestData, { key: oauth_token, secret: oauthTokenSecret })
    );

    const response = await axios.post(ACCESS_TOKEN_URL, null, { headers });
    const params = new URLSearchParams(response.data);

    const accessToken = params.get('oauth_token');
    const accessTokenSecret = params.get('oauth_token_secret');
    const userId = params.get('user_id');
    const screenName = params.get('screen_name');

    // Respond to the frontend with the obtained tokens
    res.json({
      message: 'Twitter OAuth successful',
      userId,
      screenName,
      accessToken,
      accessTokenSecret,
    });
  } catch (err) {
    console.error('❌ [Backend] Failed to handle Twitter callback:', err.message);
    res.status(500).json({ error: 'Failed to handle Twitter callback' });
  }
};
