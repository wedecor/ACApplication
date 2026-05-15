/**
 * Jest global setup for the API. Loads test env vars and ensures the
 * database is reachable before any spec runs.
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.JWT_SECRET ??= 'test_jwt_secret_for_specs_only_32chars_min';
process.env.JWT_REFRESH_SECRET ??= 'test_jwt_refresh_secret_specs_only_32chars';
