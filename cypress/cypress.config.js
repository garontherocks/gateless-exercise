const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    env: {
      API_KEY: 'test_key' // Bearer token que exige el mock
    },
    defaultCommandTimeout: 120000,
    requestTimeout: 60000,
    video: false,
  }
});
