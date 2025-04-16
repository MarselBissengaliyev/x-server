import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';

const ACCOUNTS_FILE = path.join(process.cwd(), 'data', 'accounts.json');

const Account = sequelize.define('Account', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  accessToken: {
    type: DataTypes.STRING,
    allowNull: false
  },
  accessTokenSecret: {
    type: DataTypes.STRING,
    allowNull: false
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      autoposting: false,
      schedule: 'not_scheduled', // not_scheduled, hourly, daily, weekly
      customTime: '09:00',
      postingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      prompts: '',
      lastPostTime: null
    }
  }
});

// Static methods
Account.initialize = async () => {
  try {
    await fs.mkdir(path.dirname(ACCOUNTS_FILE), { recursive: true });
    if (!(await fs.stat(ACCOUNTS_FILE).catch(() => false))) {
      await fs.writeFile(ACCOUNTS_FILE, JSON.stringify([]));
    }
  } catch (error) {
    console.error('Failed to initialize accounts storage:', error);
  }
};

Account.getAll = async () => {
  const data = await fs.readFile(ACCOUNTS_FILE, 'utf-8');
  return JSON.parse(data);
};

Account.add = async (account) => {
  const accounts = await Account.getAll();
  const newAccount = {
    ...account,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    lastPostTime: null,
    posts: { total: 0, today: 0 },
    token: 'mock-token',
    settings: {
      autoposting: false,
      schedule: 'daily',
      customTime: '12:00',
      postingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      textPrompt: '',
      imagePrompt: '',
      hashtagPrompt: '',
      targetUrl: '',
      promotedOnly: false
    }
  };
  accounts.push(newAccount);
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  return newAccount;
};

Account.deleteAccount = async (accountId) => {
  const accounts = await Account.getAll();
  const updatedAccounts = accounts.filter(account => account.id !== accountId);

  if (accounts.length === updatedAccounts.length) {
    return false; // Account not found
  }

  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(updatedAccounts, null, 2));
  return true; // Account successfully deleted
};

Account.deleteAccountByUsername = async (username) => {
  const accounts = await Account.getAll();
  const updatedAccounts = accounts.filter(account => account.login !== username);

  if (accounts.length === updatedAccounts.length) {
    return false; // Account not found
  }

  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(updatedAccounts, null, 2));
  return true; // Account successfully deleted
};

Account.updatePostCount = async (accountId) => {
  const accounts = await Account.getAll();
  const account = accounts.find(a => a.id === accountId);
  if (account) {
    account.posts.total++;
    account.posts.today++;
    account.lastPostTime = new Date().toISOString();
    await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  }
};

Account.updateStats = async (accountId) => {
  const accounts = await Account.getAll();
  const account = accounts.find(a => a.id === accountId);
  
  if (account) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!account.stats) account.stats = {};
    if (!account.stats[today]) {
      account.stats[today] = {
        posts: 0,
        engagement: 0,
        clicks: 0
      };
    }

    account.stats[today].posts++;
    account.posts.today = account.stats[today].posts;
    account.lastPostTime = new Date().toISOString();
    await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  }
};

Account.getStats = async (accountId, days = 7) => {
  const accounts = await Account.getAll();
  const account = accounts.find(a => a.id === accountId);
  
  if (!account) return null;

  const stats = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    stats.push({
      date: dateStr,
      posts: account.stats?.[dateStr]?.posts || 0,
      engagement: account.stats?.[dateStr]?.engagement || 0,
      clicks: account.stats?.[dateStr]?.clicks || 0
    });
  }

  return stats;
};

Account.updateSettings = async (accountId, newSettings) => {
  const accounts = await Account.getAll();
  const account = accounts.find(a => a.id === accountId);
  
  if (account) {
    // Initialize settings if they don't exist
    if (!account.settings) {
      account.settings = {
        autoposting: false,
        schedule: 'daily',
        customTime: '12:00',
        postingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        textPrompt: '',
        imagePrompt: '',
        hashtagPrompt: '',
        targetUrl: '',
        promotedOnly: false
      };
    }

    // Update settings
    account.settings = {
      ...account.settings,
      ...newSettings
    };

    // Ensure required fields are set
    if (!account.settings.postingDays) {
      account.settings.postingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    }
    if (!account.settings.customTime) {
      account.settings.customTime = '12:00';
    }

    await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
    return account;
  }
  
  return null;
};

export { Account };
