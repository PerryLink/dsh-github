// Hermetic unit-suite environment.
//
// The token resolver falls back to the environment variable named by
// `tokenRef` (GITHUB_TOKEN by default), so a developer's or CI's GITHUB_TOKEN
// would leak into unit tests and break every "no token" assertion. Unit tests
// therefore start with GITHUB_TOKEN removed; the opt-in real-API smoke tests
// use the dedicated DSH_GITHUB_E2E_TOKEN instead.
delete process.env.GITHUB_TOKEN
