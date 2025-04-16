import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';


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


export { Account };

