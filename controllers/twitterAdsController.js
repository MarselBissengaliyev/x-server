import { makeAuthenticatedRequest } from '../services/twitterAuthService.js';

export const getAccounts = async (req, res) => {
  try {
    console.log('🔧 [Backend] Fetching Twitter Ads accounts...');
    const accounts = await makeAuthenticatedRequest('/6/accounts', 'GET');
    console.log('✅ [Backend] Accounts fetched successfully:', accounts);
    res.json(accounts);
  } catch (err) {
    console.error('❌ [Backend] Failed to fetch accounts:', err.message);
    res.status(500).json({ error: 'Failed to fetch accounts', details: err.message });
  }
};
