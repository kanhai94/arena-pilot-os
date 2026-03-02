import { env } from './env.js';
import { developmentConfig } from './environments/development.js';
import { stagingConfig } from './environments/staging.js';
import { productionConfig } from './environments/production.js';

const byEnv = {
  development: developmentConfig,
  staging: stagingConfig,
  production: productionConfig,
  test: developmentConfig
};

export const runtimeConfig = byEnv[env.NODE_ENV] || developmentConfig;
