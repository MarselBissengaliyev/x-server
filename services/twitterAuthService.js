import OAuth from 'oauth-1.0a';
import CryptoJS from 'crypto-js';
import axios from 'axios';

const API_KEY = "m8mspIVEMkyhEn4RatWmlZW0h";
const API_SECRET = "2WB0SDCCjhhH5QFBwdtIVmOWsAGrwgkZoMMZCBoi6HGm7pjA0A";
const ACCESS_TOKEN = "3075555330-2Q1abFplrgH2EffFeHH3QkhBucM7LPzal8imJiK";
const ACCESS_TOKEN_SECRET = "LY2RNV7qcJ7pptZtCmGqxeFMUAHsdivitgB00CQrIzk06";

const BASE_URL = 'https://ads-api.x.com';

const oauth = OAuth({
  consumer: {
    key: API_KEY,
    secret: API_SECRET,
  },
  signature_method: 'HMAC-SHA1',
  hash_function(baseString, key) {
    return CryptoJS.HmacSHA1(baseString, key).toString(CryptoJS.enc.Base64);
  },
});

export async function makeAuthenticatedRequest(endpoint, method = 'GET', data = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const requestData = {
    url,
    method,
    data,
  };

  const headers = oauth.toHeader(
    oauth.authorize(requestData, {
      key: ACCESS_TOKEN,
      secret: ACCESS_TOKEN_SECRET,
    })
  );

  try {
    const response = await axios({
      url,
      method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      data: method === 'POST' || method === 'PUT' ? data : undefined,
    });

    return response.data;
  } catch (err) {
    console.error('❌ [Twitter API] Request failed:', err.response?.data || err.message);
    throw new Error(err.response?.data?.errors || 'Twitter API request failed');
  }
}
