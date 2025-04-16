import { DataTypes } from 'sequelize';

export const up = async (queryInterface) => {
  await queryInterface.createTable('Accounts', {
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
        schedule: 'not_scheduled',
        customTime: '09:00',
        postingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        prompts: '',
        lastPostTime: null
      }
    },
    schedule: {
      type: DataTypes.JSON,
      defaultValue: {
        posts: [],
        nextPostIndex: 0
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });
};

export const down = async (queryInterface) => {
  await queryInterface.dropTable('Accounts');
}; 