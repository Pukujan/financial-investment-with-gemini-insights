process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.FIREBASE_APP_INSTANCE_ID = 'test-instance';
/** QA tests use open API routes without demo login */
process.env.DEMO_AUTH_USER = '';
process.env.DEMO_AUTH_PASSWORD = '';
