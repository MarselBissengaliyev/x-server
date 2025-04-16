import express from 'express';
import { Account } from '../models/Account.js';
import { getAccounts, addAccount, deleteAccount, updateSettings, getAccountSettings } from '../controllers/accountController.js';

const router = express.Router();

// Define routes
router.post('/', addAccount); // Add a new account
router.delete('/:accountId',  async (req, res) => {
  try {
    console.log("hi")
    const { accountId } = req.params;

    console.log('Trying to delete account with ID:', accountId);

    const account = await Account.findByPk(accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await account.destroy();
    console.log('Account deleted:', accountId);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}); // Delete an account by ID
router.put('/:accountId/settings', updateSettings);
router.get('/:accountId/settings', getAccountSettings);

// Make a post
router.post('/:accountId/post', async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = await Account.findOne({ where: { id: accountId } });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get a random prompt from the account's prompts
    const prompts = account.settings.prompts.split('\n').filter(p => p.trim());
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    // Make the post using the account's credentials
    const post = await makePost(account, randomPrompt);

    // Update lastPostTime
    await account.update({
      lastPostTime: new Date(),
      settings: {
        ...account.settings,
        lastPostTime: new Date()
      }
    });

    res.json({ success: true, post, lastPostTime: new Date() });
  } catch (error) {
    console.error('Error making post:', error);
    res.status(500).json({ error: 'Failed to make post' });
  }
});

// Get all accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await Account.findAll();
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get account by ID
router.get('/:id', async (req, res) => {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Update account
router.put('/:id', async (req, res) => {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    await account.update(req.body);
    res.json(account);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Delete account
// router.delete('/:id', async (req, res) => {
//   try {
//     const account = await Account.findByPk(req.params.id);
//     if (!account) {
//       return res.status(404).json({ error: 'Account not found' });
//     }
//     await account.destroy();
//     res.status(204).send();
//   } catch (error) {
//     console.error('Error deleting account:', error);
//     res.status(500).json({ error: 'Failed to delete account' });
//   }
// });

export default router;
