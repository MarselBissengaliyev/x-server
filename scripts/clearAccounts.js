import Account from '../models/Account.js';
import sequelize from '../config/database.js';

async function clearAccounts() {
  try {
    await sequelize.sync();
    await Account.destroy({ where: {}, truncate: true });
    console.log('All accounts have been deleted');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing accounts:', error);
    process.exit(1);
  }
}

clearAccounts(); 