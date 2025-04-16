import { DataTypes } from 'sequelize';

export const up = async (queryInterface) => {
  await queryInterface.addColumn('Accounts', 'schedule', {
    type: DataTypes.JSON,
    defaultValue: {
      posts: [],
      nextPostIndex: 0
    }
  });
};

export const down = async (queryInterface) => {
  await queryInterface.removeColumn('Accounts', 'schedule');
}; 