const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'amigo-default-secret',
  jwtExpiresIn: '24h',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  hugoSitePath: path.resolve(__dirname, '../../'),
  contentPath: path.resolve(__dirname, '../../content/posts'),
  staticPath: path.resolve(__dirname, '../../static'),
  publicPath: path.resolve(__dirname, '../../public'),
  adminPath: path.resolve(__dirname, '../../admin/dist'),
  indexPath: path.resolve(__dirname, '../../server/data/posts-index.json'),
};
