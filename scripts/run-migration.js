import { up as createAccountsTable } from '../migrations/20240407_create_accounts_table.js';
import { up as addScheduleColumn } from '../migrations/20240407_add_schedule_column.js';
import sequelize from '../config/database.js';

const runMigration = async () => {
  try {
    await createAccountsTable(sequelize.getQueryInterface());
    console.log('Accounts table created successfully');
    await addScheduleColumn(sequelize.getQueryInterface());
    console.log('Schedule column added successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
};

runMigration(); 