// Minimal env so modules that read env() can load in tests. No test touches a real database or Redis.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.WEB_ORIGIN ??= "http://localhost:3000";
process.env.INBOUND_WEBHOOK_SECRET ??= "test-inbound-secret";
process.env.STRIPE_PRICES ??= JSON.stringify({ "starter:month": "price_starter_month", "pro:week": "price_pro_week" });
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "fatal";
