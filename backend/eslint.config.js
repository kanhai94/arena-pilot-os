export default [
  {
    files: ['src/**/*.js'],
    ignores: ['node_modules/**', 'logs/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^(_|next)$' }],
      'no-undef': 'error'
    }
  }
];
