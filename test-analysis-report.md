# Test Analysis Report

**Generated:** 2026-01-01T17:50:11.014Z
**Total Test Files:** 249
**Total Tests:** 2806
**Stub Tests:** 473 (16.9%)
**Real Tests:** 2333

## Recommendations

- Found 473 stub tests. Review and implement proper test logic.
- 163 critical paths need test coverage.
- 46 test files have multiple stub tests.

## Critical Paths

- **src/app/api/ws/route.ts** (high) - API endpoints
- **src/app/api/workflow/status/route.ts** (high) - API endpoints
- **src/app/api/webhooks/subscription-changed/route.ts** (high) - API endpoints
- **src/app/api/webhooks/mediaconvert/route.ts** (high) - API endpoints
- **src/app/api/users/profile/route.ts** (high) - API endpoints
- **src/app/api/user/notifications/preferences/route.ts** (high) - API endpoints
- **src/app/api/user/notifications/preferences/__tests__/route.test.ts** (high) - API endpoints
- **src/app/api/user/gdpr/export/route.ts** (high) - API endpoints
- **src/app/api/user/gdpr/delete/route.ts** (high) - API endpoints
- **src/app/api/upload/route.ts** (high) - API endpoints
- **src/app/api/upload/presigned-url/route.ts** (high) - API endpoints
- **src/app/api/upload/local/route.ts** (high) - API endpoints
- **src/app/api/upload/confirm/route.ts** (high) - API endpoints
- **src/app/api/test-streams/route.ts** (high) - API endpoints
- **src/app/api/test-session/route.ts** (high) - API endpoints
- **src/app/api/test-s3/route.ts** (high) - API endpoints
- **src/app/api/test-db/route.ts** (high) - API endpoints
- **src/app/api/test-auth/route.ts** (high) - API endpoints
- **src/app/api/streaming/route.ts** (high) - API endpoints
- **src/app/api/streaming/rtmp/route.ts** (high) - API endpoints
- **src/app/api/streaming/create/route.ts** (high) - API endpoints
- **src/app/api/streaming/[streamId]/route.ts** (high) - API endpoints
- **src/app/api/streaming/[streamId]/vod/route.ts** (high) - API endpoints
- **src/app/api/streaming/[streamId]/stop/route.ts** (high) - API endpoints
- **src/app/api/streaming/[streamId]/start/route.ts** (high) - API endpoints
- **src/app/api/streaming/[streamId]/metrics/route.ts** (high) - API endpoints
- **src/app/api/streaming/[streamId]/access/route.ts** (high) - API endpoints
- **src/app/api/simple-upload/route.ts** (high) - API endpoints
- **src/app/api/security/csp-report/route.ts** (high) - API endpoints
- **src/app/api/search/route.ts** (high) - API endpoints
- **src/app/api/recommendations/route.ts** (high) - API endpoints
- **src/app/api/recommendations/artists/route.ts** (high) - API endpoints
- **src/app/api/payments/webhooks/route.ts** (high) - API endpoints
- **src/app/api/payments/retry/route.ts** (high) - API endpoints
- **src/app/api/payments/portal/route.ts** (high) - API endpoints
- **src/app/api/payments/create-checkout/route.ts** (high) - API endpoints
- **src/app/api/payments/__tests__/webhooks.test.ts** (high) - API endpoints
- **src/app/api/payments/__tests__/retry.test.ts** (high) - API endpoints
- **src/app/api/payments/__tests__/create-checkout.test.ts** (high) - API endpoints
- **src/app/api/observability/route.ts** (high) - API endpoints
- **src/app/api/notifications/route.ts** (high) - API endpoints
- **src/app/api/notifications/mark-all-read/route.ts** (high) - API endpoints
- **src/app/api/notifications/[id]/route.ts** (high) - API endpoints
- **src/app/api/notifications/[id]/read/route.ts** (high) - API endpoints
- **src/app/api/moderation/reports/route.ts** (high) - API endpoints
- **src/app/api/migration/progress/route.ts** (high) - API endpoints
- **src/app/api/migration/dashboard/route.ts** (high) - API endpoints
- **src/app/api/metrics/route.ts** (high) - API endpoints
- **src/app/api/messages/route.ts** (high) - API endpoints
- **src/app/api/messages/conversations/route.ts** (high) - API endpoints
- **src/app/api/livestream/route.ts** (high) - API endpoints
- **src/app/api/livestream/[streamId]/route.ts** (high) - API endpoints
- **src/app/api/livestream/[streamId]/chat/route.ts** (high) - API endpoints
- **src/app/api/health/route.ts** (high) - API endpoints
- **src/app/api/health/cron/route.ts** (high) - API endpoints
- **src/app/api/files/content/[filename]/route.ts** (high) - API endpoints
- **src/app/api/fan/subscriptions/route.ts** (high) - API endpoints
- **src/app/api/fan/subscriptions/__tests__/route.test.ts** (high) - API endpoints
- **src/app/api/fan/subscriptions/[id]/route.ts** (high) - API endpoints
- **src/app/api/fan/subscriptions/[id]/change-tier/route.ts** (high) - API endpoints
- **src/app/api/fan/submissions/route.ts** (high) - API endpoints
- **src/app/api/fan/stats/route.ts** (high) - API endpoints
- **src/app/api/fan/profile/route.ts** (high) - API endpoints
- **src/app/api/fan/feed/route.ts** (high) - API endpoints
- **src/app/api/fan/content/recent/route.ts** (high) - API endpoints
- **src/app/api/fan/content/[artistId]/route.ts** (high) - API endpoints
- **src/app/api/fan/comments/route.ts** (high) - API endpoints
- **src/app/api/fan/comments/__tests__/route.test.ts** (high) - API endpoints
- **src/app/api/fan/comments/[id]/route.ts** (high) - API endpoints
- **src/app/api/fan/campaigns/route.ts** (high) - API endpoints
- **src/app/api/fan/artists/route.ts** (high) - API endpoints
- **src/app/api/fan/artists/__tests__/route.test.ts** (high) - API endpoints
- **src/app/api/fan/artists/[id]/route.ts** (high) - API endpoints
- **src/app/api/debug-signin/route.ts** (high) - API endpoints
- **src/app/api/debug-session/route.ts** (high) - API endpoints
- **src/app/api/debug-auth/route.ts** (high) - API endpoints
- **src/app/api/data-export/route.ts** (high) - API endpoints
- **src/app/api/content-example/route.ts** (high) - API endpoints
- **src/app/api/content/route.ts** (high) - API endpoints
- **src/app/api/content/upload/route.ts** (high) - API endpoints
- **src/app/api/content/optimize/route.ts** (high) - API endpoints
- **src/app/api/content/discover/route.ts** (high) - API endpoints
- **src/app/api/content/create/route.ts** (high) - API endpoints
- **src/app/api/content/[id]/route.ts** (high) - API endpoints
- **src/app/api/content/[id]/stream/route.ts** (high) - API endpoints
- **src/app/api/content/[id]/like/route.ts** (high) - API endpoints
- **src/app/api/content/[id]/download/route.ts** (high) - API endpoints
- **src/app/api/content/[id]/access/route.ts** (high) - API endpoints
- **src/app/api/content/[id]/access/__tests__/route.test.ts** (high) - API endpoints
- **src/app/api/challenges/[challengeId]/submissions/route.ts** (high) - API endpoints
- **src/app/api/challenges/[challengeId]/participate/route.ts** (high) - API endpoints
- **src/app/api/challenges/[challengeId]/leaderboard/route.ts** (high) - API endpoints
- **src/app/api/campaigns/[id]/route.ts** (high) - API endpoints
- **src/app/api/campaigns/[id]/submissions/route.ts** (high) - API endpoints
- **src/app/api/campaigns/[id]/join/route.ts** (high) - API endpoints
- **src/app/api/campaigns/[id]/analytics/route.ts** (high) - API endpoints
- **src/app/api/campaigns/[campaignId]_backup/route.ts** (high) - API endpoints
- **src/app/api/campaigns/[campaignId]_backup/rewards/route.ts** (high) - API endpoints
- **src/app/api/campaigns/[campaignId]_backup/challenges/route.ts** (high) - API endpoints
- **src/app/api/billing/invoices/route.ts** (high) - API endpoints
- **src/app/api/billing/invoices/sync/route.ts** (high) - API endpoints
- **src/app/api/billing/invoices/[id]/route.ts** (high) - API endpoints
- **src/app/api/billing/cycle/route.ts** (high) - API endpoints
- **src/app/api/billing/__tests__/invoices.test.ts** (high) - API endpoints
- **src/app/api/billing/__tests__/invoice-sync.test.ts** (high) - API endpoints
- **src/app/api/billing/__tests__/cycle.test.ts** (high) - API endpoints
- **src/app/api/auth/test-credentials/route.ts** (high) - API endpoints
- **src/app/api/auth/signup/route.ts** (high) - API endpoints
- **src/app/api/auth/reset-password/route.ts** (high) - API endpoints
- **src/app/api/auth/register/route.ts** (high) - API endpoints
- **src/app/api/auth/refresh/route.ts** (high) - API endpoints
- **src/app/api/auth/profile/route.ts** (high) - API endpoints
- **src/app/api/auth/login/route.ts** (high) - API endpoints
- **src/app/api/auth/forgot-password/route.ts** (high) - API endpoints
- **src/app/api/auth/change-password/route.ts** (high) - API endpoints
- **src/app/api/auth/[...nextauth]/route.ts** (high) - API endpoints
- **src/app/api/artist/tiers/route.ts** (high) - API endpoints
- **src/app/api/artist/tiers/__tests__/route.test.ts** (high) - API endpoints
- **src/app/api/artist/tiers/[id]/route.ts** (high) - API endpoints
- **src/app/api/artist/stripe/status/route.ts** (high) - API endpoints
- **src/app/api/artist/stripe/onboard/route.ts** (high) - API endpoints
- **src/app/api/artist/stripe/__tests__/onboard.test.ts** (high) - API endpoints
- **src/app/api/artist/profile/route.ts** (high) - API endpoints
- **src/app/api/artist/content/route.ts** (high) - API endpoints
- **src/app/api/artist/content/upload/route.ts** (high) - API endpoints
- **src/app/api/artist/content/upload/__tests__/route.test.ts** (high) - API endpoints
- **src/app/api/artist/content/[id]/route.ts** (high) - API endpoints
- **src/app/api/artist/analytics/route.ts** (high) - API endpoints
- **src/app/api/artist/activity/route.ts** (high) - API endpoints
- **src/app/api/analytics/route.ts** (high) - API endpoints
- **src/app/api/analytics/content/route.ts** (high) - API endpoints
- **src/app/api/ai/route.ts** (high) - API endpoints
- **src/app/api/ai/revenue-stripe/route.ts** (high) - API endpoints
- **src/app/api/ai/revenue/route.ts** (high) - API endpoints
- **src/app/api/ai/analytics/route.ts** (high) - API endpoints
- **src/app/api/ai/admin/route.ts** (high) - API endpoints
- **src/app/api/admin/users/route.ts** (high) - API endpoints
- **src/app/api/admin/performance-monitor/route.ts** (high) - API endpoints
- **src/app/api/admin/performance/health/route.ts** (high) - API endpoints
- **src/app/api/admin/performance/alerts/route.ts** (high) - API endpoints
- **src/app/api/admin/metrics/route.ts** (high) - API endpoints
- **src/app/api/admin/database/performance/route.ts** (high) - API endpoints
- **src/app/api/admin/dashboard/stats/route.ts** (high) - API endpoints
- **src/app/api/admin/content/moderation/route.ts** (high) - API endpoints
- **src/app/api/admin/change-role/route.ts** (high) - API endpoints
- **src/app/api/admin/cache-monitor/route.ts** (high) - API endpoints
- **src/app/api/admin/analytics/route.ts** (high) - API endpoints
- **src/app/api/account-deletion/route.ts** (high) - API endpoints
- **src/lib/auth.ts** (high) - Authentication logic
- **src/lib/auth-utils.ts** (high) - Authentication logic
- **src/lib/auth-security.ts** (high) - Authentication logic
- **src/lib/auth-production.ts** (high) - Authentication logic
- **src/lib/payment-service.ts** (high) - Payment processing
- **src/lib/payment-retry.ts** (high) - Payment processing
- **src/lib/payment-reliability.ts** (high) - Payment processing
- **src/lib/payment-monitoring.ts** (high) - Payment processing
- **src/lib/database.ts** (high) - Database operations
- **src/lib/database-query-optimizer.ts** (high) - Database operations
- **src/lib/database-production.ts** (high) - Database operations
- **src/lib/database-migration-service.ts** (high) - Database operations
- **src/lib/security.ts** (high) - Security functions
- **src/lib/security-headers.ts** (high) - Security functions
- **src/lib/security-client.ts** (high) - Security functions
- **src/components/auth/role-guard.tsx** (medium) - Auth components
- **src/hooks/useSocket.ts** (medium) - Custom hooks
- **src/hooks/useMobileOptimized.ts** (medium) - Custom hooks
- **src/hooks/useLocalStorage.ts** (medium) - Custom hooks
- **src/hooks/useDebounce.ts** (medium) - Custom hooks
- **src/hooks/useAnalytics.ts** (medium) - Custom hooks
- **src/hooks/use-websocket.ts** (medium) - Custom hooks
- **src/hooks/use-search.ts** (medium) - Custom hooks
- **src/hooks/use-safe-session.ts** (medium) - Custom hooks
- **src/hooks/use-safe-api.ts** (medium) - Custom hooks
- **src/hooks/use-role-auth.ts** (medium) - Custom hooks
- **src/hooks/use-pwa.ts** (medium) - Custom hooks
- **src/hooks/use-push-notifications.ts** (medium) - Custom hooks
- **src/hooks/use-navigation.ts** (medium) - Custom hooks
- **src/hooks/use-file-upload.ts** (medium) - Custom hooks
- **src/hooks/use-debounce.ts** (medium) - Custom hooks
- **src/hooks/use-api.ts** (medium) - Custom hooks

## Files with Stub Tests

### App.test.tsx

- **Line 9:** renders correctly - Test has no assertions

### ajv.test.js

- **Line 12:** ajv - Test has no assertions

### equal.test.js

- **Line 15:** URI Equals - Test has no assertions
- **Line 24:** IRI Equals - Test has no assertions
- **Line 30:** HTTP Equals - Test has no assertions
- **Line 45:** HTTPS Equals - Test has no assertions
- **Line 54:** URN Equals - Test has no assertions
- **Line 76:** UUID Equals - Test has no assertions
- **Line 85:** Mailto Equals - Test has no assertions
- **Line 92:** WS Equal - Test has no assertions
- **Line 101:** WSS Equal - Test has no assertions

### parse.test.js

- **Line 6:** URI parse - Test has no assertions

### resolve.test.js

- **Line 6:** URI Resolving - Test has no assertions
- **Line 71:** URN Resolving - Test has no assertions

### rfc-3986.test.js

- **Line 6:** RFC 3986 - Test has no assertions

### serialize.test.js

- **Line 6:** URI Serialize - Test has no assertions
- **Line 68:** WS serialize - Test has no assertions
- **Line 85:** WSS serialize - Test has no assertions
- **Line 103:** URN serialize - Test has no assertions
- **Line 135:** URN NID Override - Test has no assertions

### uri-js-compatibility.test.js

- **Line 14:** uri-js compatibility Parse - Skipped or focused test: return t.skip('Skipping //10.10.000.10 as it is not a valid URI per URI spec: https://datatracker.ietf.org/doc/html/rfc5954#section-4.1')
- **Line 17:** uri-js compatibility Parse - Skipped or focused test: return t.skip('Skipping mailto schema test as it is not supported by fastifyURI')
- **Line 9:** uri-js compatibility Parse - Test has no assertions
- **Line 24:** uri-js compatibility serialize - Test has no assertions

### uri-js.test.js

- **Line 734:** Unknown test - TODO comment: t.equal(components.subject, '=?utf-8?Q?caf=C3=A9?=', 'subject') // TODO: Verify this
- **Line 738:** Unknown test - TODO comment: t.equal(components.subject, '=?iso-8859-1?Q?caf=E9?=', 'subject') // TODO: Verify this
- **Line 42:** Acquire URI - Test has no assertions
- **Line 47:** URI Parsing - Test has no assertions
- **Line 284:** URI Serialization - Test has no assertions
- **Line 344:** URI Resolving - Test has no assertions
- **Line 404:** URI Normalizing - Test has no assertions
- **Line 431:** URI Equals - Test has no assertions
- **Line 441:** Escape Component - Test has no assertions
- **Line 458:** Unescape Component - Test has no assertions
- **Line 473:** IRI Parsing - Test has no assertions
- **Line 486:** IRI Serialization - Test has no assertions
- **Line 500:** IRI Normalizing - Test has no assertions
- **Line 505:** IRI Equals - Test has no assertions
- **Line 511:** Convert IRI to URI - Test has no assertions
- **Line 520:** Convert URI to IRI - Test has no assertions
- **Line 532:** HTTP Equals - Test has no assertions
- **Line 545:** HTTPS Equals - Test has no assertions
- **Line 553:** URN Parsing - Test has no assertions
- **Line 569:** URN Serialization - Test has no assertions
- **Line 580:** URN Equals - Test has no assertions
- **Line 590:** URN Resolving - Test has no assertions
- **Line 599:** UUID Parsing - Test has no assertions
- **Line 619:** UUID Serialization - Test has no assertions
- **Line 637:** UUID Equals - Test has no assertions
- **Line 642:** URN NID Override - Test has no assertions
- **Line 662:** Mailto Parse - Test has no assertions
- **Line 755:** Mailto Serialize - Test has no assertions
- **Line 780:** Mailto Equals - Test has no assertions
- **Line 789:** WS Parse - Test has no assertions
- **Line 823:** WS Serialize - Test has no assertions
- **Line 840:** WS Equal - Test has no assertions
- **Line 845:** WS Normalize - Test has no assertions
- **Line 852:** WSS Parse - Test has no assertions
- **Line 886:** WSS Serialize - Test has no assertions
- **Line 903:** WSS Equal - Test has no assertions
- **Line 908:** WSS Normalize - Test has no assertions

### util.test.js

- **Line 9:** stringArrayToHexStripped - Test has no assertions
- **Line 27:** removeDotSegments - Test has no assertions

### index.spec.js

- **Line 13:** should traverse all keywords containing schemas recursively - Test has no assertions
- **Line 22:** should traverse all keywords containing schemas recursively - Test has no assertions
- **Line 30:** should work when an options object is provided - Test has no assertions
- **Line 49:** should traverse objects with allKeys: true option - Test has no assertions
- **Line 61:** should NOT traverse objects with allKeys: false option - Test has no assertions
- **Line 72:** should NOT traverse objects without allKeys option - Test has no assertions
- **Line 83:** should NOT travers objects in standard keywords which value is not a schema - Test has no assertions
- **Line 126:** should traverse schema in pre-order - Test has no assertions
- **Line 136:** should traverse schema in post-order - Test has no assertions
- **Line 146:** should traverse schema in pre- and post-order at the same time - Test has no assertions

### all-errors.test.ts

- **Line 16:** default flattened errors type inference - Test has no assertions
- **Line 26:** custom flattened errors type inference - Test has no assertions
- **Line 40:** form errors type inference - Test has no assertions
- **Line 49:** .flatten() type assertion - Test has no assertions
- **Line 64:** .formErrors type assertion - Test has no assertions

### anyunknown.test.ts

- **Line 7:** check any inference - Test has no assertions
- **Line 15:** check unknown inference - Test has no assertions

### array.test.ts

- **Line 19:** passing validations - Test has no assertions

### base.test.ts

- **Line 7:** type guard - Test has no assertions

### bigint.test.ts

- **Line 16:** passing validations - Test has no assertions

### branded.test.ts

- **Line 7:** branded types - Test has no assertions

### catch.test.ts

- **Line 67:** optional on catch - Test has no assertions
- **Line 92:** removeCatch - Test has no assertions
- **Line 121:** factory - Test has no assertions

### complex.test.ts

- **Line 42:** parse - Test has no assertions

### date.test.ts

- **Line 13:** passing validations - Test has no assertions

### deepmasking.test.ts

- **Line 6:** test - Test has no assertions
- **Line 36:** f1 - Test has no assertions
- **Line 72:** f9 - Test has no assertions
- **Line 183:** invalid mask #8 - Test has no assertions

### default.test.ts

- **Line 40:** optional on default - Test has no assertions
- **Line 62:** removeDefault - Test has no assertions

### discriminated-unions.test.ts

- **Line 220:** enum and nativeEnum - Test has no assertions

### enum.test.ts

- **Line 14:** infer enum - Test has no assertions
- **Line 42:** extract/exclude - Test has no assertions
- **Line 77:** readonly in ZodEnumDef - Test has no assertions

### error.test.ts

- **Line 8:** error creation - Test has no assertions

### firstparty.test.ts

- **Line 7:** first party switch - Test has no assertions

### firstpartyschematypes.test.ts

- **Line 7:** Identify missing [ZodFirstPartySchemaTypes] - Test has no assertions

### function.test.ts

- **Line 11:** function parsing - Test has no assertions
- **Line 26:** function inference 1 - Test has no assertions
- **Line 61:** args method - Test has no assertions
- **Line 86:** function inference 2 - Test has no assertions
- **Line 98:** valid function run - Test has no assertions
- **Line 226:** params and returnType getters - Test has no assertions
- **Line 233:** inference with transforms - Test has no assertions
- **Line 246:** fallback to OuterTypeOfFunction - Test has no assertions

### generics.test.ts

- **Line 7:** generics - Test has no assertions
- **Line 23:** assignability - Test has no assertions

### literal.test.ts

- **Line 13:** passing validations - Test has no assertions

### map.test.ts

- **Line 11:** type inference - Test has no assertions

### masking.test.ts

- **Line 4:** masking test - Test has no assertions

### mocker.test.ts

- **Line 6:** mocker - Test has no assertions

### nan.test.ts

- **Line 8:** passing validations - Test has no assertions

### nativeEnum.test.ts

- **Line 7:** nativeEnum test with consts - Test has no assertions
- **Line 21:** nativeEnum test with real enum - Test has no assertions
- **Line 36:** nativeEnum test with const with numeric keys - Test has no assertions

### nullable.test.ts

- **Line 20:** Should have error messages appropriate for the underlying type - Test has no assertions

### number.test.ts

- **Line 25:** passing validations - Test has no assertions

### object.test.ts

- **Line 14:** object type inference - Test has no assertions
- **Line 42:** correct parsing - Test has no assertions
- **Line 69:** nonstrict by default - Test has no assertions
- **Line 110:** catchall inference - Test has no assertions
- **Line 122:** catchall overrides strict - Test has no assertions
- **Line 139:** catchall overrides strict - Test has no assertions
- **Line 204:** test inferred merged type - Test has no assertions
- **Line 210:** inferred merged object type with optional properties - Test has no assertions
- **Line 220:** inferred unioned object type with optional properties - Test has no assertions
- **Line 245:** inferred partial object type with optional properties - Test has no assertions
- **Line 251:** inferred picked object type with optional properties - Test has no assertions
- **Line 257:** inferred type for unknown/any keys - Test has no assertions
- **Line 276:** setKey - Test has no assertions
- **Line 348:** constructor key - Test has no assertions
- **Line 413:** passthrough index signature - Test has no assertions
- **Line 422:** xor - Test has no assertions

### optional.test.ts

- **Line 20:** Should have error messages appropriate for the underlying type - Test has no assertions

### parser.test.ts

- **Line 15:** parse nonstrict object with unknown keys - Test has no assertions
- **Line 39:** parsing unknown - Test has no assertions

### partials.test.ts

- **Line 17:** shallow inference - Test has no assertions
- **Line 29:** shallow partial parse - Test has no assertions
- **Line 38:** deep partial inference - Test has no assertions
- **Line 63:** deep partial runtime tests - Test has no assertions
- **Line 105:** deep partial inference - Test has no assertions
- **Line 143:** required inference - Test has no assertions

### pickomit.test.ts

- **Line 13:** pick type inference - Test has no assertions
- **Line 19:** pick parse - success - Test has no assertions
- **Line 48:** omit type inference - Test has no assertions
- **Line 54:** omit parse - success - Test has no assertions
- **Line 79:** nonstrict inference - Test has no assertions
- **Line 85:** nonstrict parsing - pass - Test has no assertions
- **Line 97:** pick/omit/required/partial - do not allow unknown keys - Test has no assertions

### primitive.test.ts

- **Line 145:** parse stringSchema string - Test has no assertions
- **Line 174:** parse numberSchema number - Test has no assertions
- **Line 208:** parse bigintSchema bigint - Test has no assertions
- **Line 237:** parse booleanSchema boolean - Test has no assertions
- **Line 268:** parse dateSchema date - Test has no assertions
- **Line 311:** parse symbolSchema symbol - Test has no assertions
- **Line 342:** parse undefinedSchema undefined - Test has no assertions
- **Line 371:** parse nullSchema null - Test has no assertions
- **Line 375:** primitive inference - Test has no assertions
- **Line 436:** optional convenience method - Test has no assertions

### promise.test.ts

- **Line 14:** promise inference - Test has no assertions
- **Line 28:** promise parsing success 2 - Test has no assertions

### readonly.test.ts

- **Line 37:** flat inference - Test has no assertions
- **Line 64:** deep inference - Test has no assertions

### record.test.ts

- **Line 147:** Unknown test - Placeholder assertion: expect(obj1.a).toBeUndefined();
- **Line 152:** Unknown test - Placeholder assertion: expect(obj2.data.a).toBeUndefined();
- **Line 156:** Unknown test - Placeholder assertion: expect(obj3.a).toBeUndefined();
- **Line 161:** Unknown test - Placeholder assertion: expect(obj4.data.a).toBeUndefined();
- **Line 16:** type inference - Test has no assertions
- **Line 24:** methods - Test has no assertions
- **Line 29:** string record parse - pass - Test has no assertions
- **Line 120:** key and value getters - Test has no assertions

### recursive.test.ts

- **Line 31:** recursion with z.late.object - Test has no assertions
- **Line 39:** recursion with z.lazy - Test has no assertions
- **Line 49:** schema getter - Test has no assertions
- **Line 69:** recursion involving union type - Test has no assertions
- **Line 117:** valid check - Test has no assertions
- **Line 122:** valid check lazy - Test has no assertions
- **Line 127:** masking check - Test has no assertions
- **Line 152:** schema getter - Test has no assertions
- **Line 156:** self recursion with cyclical data - Test has no assertions
- **Line 175:** self recursion with base type - Test has no assertions

### refine.test.ts

- **Line 46:** refinement type guard - Test has no assertions
- **Line 60:** refinement Promise - Test has no assertions
- **Line 205:** chained mixed refining types - Test has no assertions
- **Line 236:** get inner type - Test has no assertions

### set.test.ts

- **Line 17:** type inference - Test has no assertions

### standard-schema.test.ts

- **Line 45:** invalid parse - Placeholder assertion: expect(result.issues).toBeDefined();
- **Line 74:** invalid parse async - Placeholder assertion: expect(result.issues).toBeDefined();
- **Line 9:** assignability - Test has no assertions
- **Line 17:** type inference - Test has no assertions

### string.test.ts

- **Line 16:** passing validations - Test has no assertions

### transformer.test.ts

- **Line 172:** object typing - Test has no assertions

### tuple.test.ts

- **Line 12:** tuple inference - Test has no assertions

### unions.test.ts

- **Line 44:** options getter - Test has no assertions
- **Line 52:** readonly union - Test has no assertions

### validations.test.ts

- **Line 114:** instantiation - Test has no assertions

### anyunknown.test.ts

- **Line 5:** check any inference - Test has no assertions
- **Line 13:** check unknown inference - Test has no assertions

### array.test.ts

- **Line 4:** type inference - Test has no assertions
- **Line 183:** passing unique validation - Test has no assertions

### assignability.test.ts

- **Line 5:** assignability - Test has no assertions
- **Line 159:** checks - Test has no assertions
- **Line 166:** assignability to $ZodType - Test has no assertions
- **Line 184:** assignability with narrowing - Test has no assertions
- **Line 196:** generic assignability in objects - Test has no assertions

### bigint.test.ts

- **Line 15:** passing validations - Test has no assertions

### brand.test.ts

- **Line 4:** branded types - Test has no assertions
- **Line 53:** $branded - Test has no assertions
- **Line 59:** branded record - Test has no assertions

### catch.test.ts

- **Line 67:** optional on catch - Test has no assertions
- **Line 92:** removeCatch - Test has no assertions

### coalesce.test.ts

- **Line 4:** coalesce - Empty or trivial assertion: expect(true).toBe(true);

### coerce.test.ts

- **Line 154:** override input type - Test has no assertions

### custom.test.ts

- **Line 18:** instanceof - Test has no assertions

### date.test.ts

- **Line 12:** passing validations - Test has no assertions

### datetime.test.ts

- **Line 284:** redos checker - Test has no assertions

### default.test.ts

- **Line 68:** removeDefault - Test has no assertions

### discriminated-unions.test.ts

- **Line 367:** enum and nativeEnum - Test has no assertions

### enum.test.ts

- **Line 12:** enum from const object - Test has no assertions
- **Line 47:** enum from native enum with numeric keys - Test has no assertions
- **Line 112:** type signatures - Test has no assertions
- **Line 182:** readonly in ZodEnumDef - Test has no assertions

### error.test.ts

- **Line 5:** error creation - Test has no assertions

### firstparty.test.ts

- **Line 5:** first party switch - Test has no assertions
- **Line 90:** $ZodSchemaTypes - Test has no assertions

### function.test.ts

- **Line 30:** function inference 1 - Test has no assertions
- **Line 68:** args method - Test has no assertions
- **Line 85:** custom args - Test has no assertions
- **Line 107:** function inference 2 - Test has no assertions
- **Line 119:** valid function run - Test has no assertions
- **Line 161:** array inputs - Test has no assertions

### generics.test.ts

- **Line 10:** generics - Test has no assertions
- **Line 20:** generics with optional - Test has no assertions
- **Line 36:** assignability - Test has no assertions
- **Line 60:** generic on output type - Test has no assertions

### index.test.ts

- **Line 627:** z.custom check - Test has no assertions
- **Line 709:** z.$brand() - Test has no assertions
- **Line 765:** type assertions - Test has no assertions
- **Line 791:** def typing - Test has no assertions

### json.test.ts

- **Line 5:** overload types - Test has no assertions

### lazy.test.ts

- **Line 51:** schema getter - Test has no assertions
- **Line 86:** recursion with z.lazy - Test has no assertions
- **Line 112:** recursive union wit z.lazy - Test has no assertions
- **Line 176:** mutual recursion with cyclical data - Test has no assertions
- **Line 183:** complicated self-recursion - Test has no assertions
- **Line 209:** lazy initialization - Test has no assertions

### literal.test.ts

- **Line 12:** passing validations - Test has no assertions
- **Line 89:** readonly - Test has no assertions

### map.test.ts

- **Line 7:** type inference - Test has no assertions

### nan.test.ts

- **Line 7:** passing validations - Test has no assertions

### number.test.ts

- **Line 244:** error customization - Test has no assertions

### object.test.ts

- **Line 368:** catchall - Placeholder assertion: expect(a._zod.def.catchall).toBeUndefined();
- **Line 12:** object type inference - Test has no assertions
- **Line 40:** correct parsing - Test has no assertions
- **Line 63:** nonstrict by default - Test has no assertions
- **Line 120:** catchall inference - Test has no assertions
- **Line 132:** catchall overrides strict - Test has no assertions
- **Line 149:** catchall overrides strict - Test has no assertions
- **Line 213:** test inferred merged type - Test has no assertions
- **Line 220:** inferred type with Record shape - Test has no assertions
- **Line 230:** inferred merged object type with optional properties - Test has no assertions
- **Line 239:** inferred unioned object type with optional properties - Test has no assertions
- **Line 264:** inferred partial object type with optional properties - Test has no assertions
- **Line 270:** inferred picked object type with optional properties - Test has no assertions
- **Line 276:** inferred type for unknown/any keys - Test has no assertions
- **Line 355:** constructor key - Test has no assertions
- **Line 423:** passthrough index signature - Test has no assertions
- **Line 432:** xor - Test has no assertions
- **Line 445:** assignability - Test has no assertions
- **Line 489:** empty objects - Test has no assertions
- **Line 538:** zodtype assignability - Test has no assertions
- **Line 552:** index signature in shape - Test has no assertions

### optional.test.ts

- **Line 91:** pipe optionality inside objects - Test has no assertions

### partial.test.ts

- **Line 13:** shallow inference - Test has no assertions
- **Line 25:** shallow partial parse - Test has no assertions
- **Line 57:** required inference - Test has no assertions

### pickomit.test.ts

- **Line 10:** pick type inference - Test has no assertions
- **Line 16:** pick parse - success - Test has no assertions
- **Line 54:** omit type inference - Test has no assertions
- **Line 61:** omit parse - success - Test has no assertions
- **Line 93:** nonstrict inference - Test has no assertions
- **Line 99:** nonstrict parsing - pass - Test has no assertions

### prefault.test.ts

- **Line 16:** prefault inside object - Test has no assertions

### primitive.test.ts

- **Line 145:** primitive inference - Test has no assertions

### promise.test.ts

- **Line 11:** promise inference - Test has no assertions

### readonly.test.ts

- **Line 9:** flat inference - Test has no assertions
- **Line 53:** deep inference - Test has no assertions
- **Line 174:** readonly inference - Test has no assertions
- **Line 198:** readonly parse with tuples - Test has no assertions

### record.test.ts

- **Line 235:** Unknown test - Placeholder assertion: expect(obj1.a).toBeUndefined();
- **Line 240:** Unknown test - Placeholder assertion: expect(obj2.data.a).toBeUndefined();
- **Line 244:** Unknown test - Placeholder assertion: expect(obj3.a).toBeUndefined();
- **Line 249:** Unknown test - Placeholder assertion: expect(obj4.data.a).toBeUndefined();
- **Line 4:** type inference - Test has no assertions
- **Line 208:** key and value getters - Test has no assertions
- **Line 334:** partial record - Test has no assertions

### recursive-types.test.ts

- **Line 4:** recursion with z.lazy - Test has no assertions
- **Line 40:** recursion involving union type - Test has no assertions
- **Line 151:** deferred self-recursion - Test has no assertions
- **Line 184:** deferred mutual recursion - Test has no assertions
- **Line 223:** mutual recursion with meta - Test has no assertions
- **Line 263:** recursion compatibility - Test has no assertions

### refine.test.ts

- **Line 349:** refinement type guard - Test has no assertions
- **Line 391:** chained mixed refining types - Test has no assertions

### registries.test.ts

- **Line 45:** z.registry with schema constraints - Test has no assertions
- **Line 89:** output type in registry meta - Test has no assertions
- **Line 98:** output type in registry meta - objects and arrays - Test has no assertions
- **Line 108:** input type in registry meta - Test has no assertions
- **Line 117:** input type in registry meta - objects and arrays - Test has no assertions
- **Line 161:** loose examples - Test has no assertions

### set.test.ts

- **Line 13:** type inference - Test has no assertions

### string.test.ts

- **Line 260:** big base64 and base64url - Test has no assertions

### template-literal.test.ts

- **Line 98:** template literal type inference - Test has no assertions
- **Line 587:** template literal parsing - success - complex cases - Test has no assertions

### transform.test.ts

- **Line 163:** object typing - Test has no assertions

### union.test.ts

- **Line 62:** options getter - Test has no assertions
- **Line 70:** readonly union - Test has no assertions
- **Line 77:** union inferred types - Test has no assertions

### index.test.ts

- **Line 5:** test - Empty or trivial assertion: expect(true).toBe(true);

### assignability.test.ts

- **Line 5:** assignability - Test has no assertions
- **Line 119:** assignability with type narrowing - Test has no assertions

### brand.test.ts

- **Line 4:** branded types - Test has no assertions

### index.test.ts

- **Line 705:** z.$brand() - Test has no assertions
- **Line 806:** type assertions - Test has no assertions
- **Line 820:** z.pipe type enforcement - Test has no assertions
- **Line 830:** def typing - Test has no assertions

### object.test.ts

- **Line 91:** z.keyof - Placeholder assertion: expect(userKeysSchema).toBeDefined();
- **Line 109:** Unknown test - Placeholder assertion: expect(extendedSchema).toBeDefined();
- **Line 117:** z.pick - Placeholder assertion: expect(pickedSchema).toBeDefined();
- **Line 39:** z.object().check() - Test has no assertions

### recursive-types.test.ts

- **Line 4:** recursion with z.lazy - Test has no assertions
- **Line 41:** recursion involving union type - Test has no assertions
- **Line 162:** deferred self-recursion - Test has no assertions
- **Line 194:** recursion compatibility - Test has no assertions

### access-control-security.test.ts

- **Line 252:** Unknown test - Placeholder assertion: expect(result.subscription).toBeDefined();

### access-control-simplified.test.ts

- **Line 129:** Unknown test - Placeholder assertion: expect(result.subscription).toBeDefined();

### auth-integration.test.ts

- **Line 205:** Unknown test - Placeholder assertion: expect(data.user.password).toBeUndefined(); // Password should be excluded
- **Line 259:** Unknown test - Placeholder assertion: expect(data.user.artist).toBeDefined();

### route.test.ts

- **Line 214:** Unknown test - Placeholder assertion: expect(data.error).toBeDefined(); // Should contain validation errors

### video-player.test.tsx

- **Line 236:** Unknown test - Skipped or focused test: it.skip('handles autoplay', async () => {

### auth-utils.test.ts

- **Line 40:** should hash password correctly - Placeholder assertion: expect(hashedPassword).toBeDefined();

### billing.test.ts

- **Line 416:** Unknown test - Placeholder assertion: expect(result.paidAt).toBeUndefined();

### content-optimization-integration.test.ts

- **Line 296:** Unknown test - Placeholder assertion: expect(result.outputs).toBeDefined();
- **Line 301:** Unknown test - Placeholder assertion: expect(result.outputs).toBeDefined();
- **Line 333:** should validate optimization strategies work correctly - Placeholder assertion: expect(result.strategy).toBeDefined();
- **Line 363:** Unknown test - Placeholder assertion: expect(result.outputs).toBeDefined();
- **Line 393:** Unknown test - Placeholder assertion: expect(result.outputs).toBeDefined();

### full-workflow-integration.test.ts

- **Line 254:** Unknown test - Placeholder assertion: expect(strategiesResult.data.strategies).toBeDefined();
- **Line 456:** should handle content creator upload workflow - Test has no assertions
- **Line 475:** . - Test has no assertions

### integration.test.ts

- **Line 621:** Unknown test - Placeholder assertion: expect(errorData.error).toBeDefined();
- **Line 345:** . - Test has no assertions

### ai-integration.test.js

- **Line 357:** should integrate with existing analytics data - Placeholder assertion: expect(response.body.insights).toBeDefined();
- **Line 358:** should integrate with existing analytics data - Placeholder assertion: expect(response.body.predictions).toBeDefined();
- **Line 373:** Unknown test - Placeholder assertion: expect(moderationLog).toBeTruthy();

### adaptive-bitrate-streaming.test.js

- **Line 257:** Unknown test - Placeholder assertion: expect(channelDetails.EncoderSettings.VideoDescriptions).toBeDefined();
- **Line 277:** Unknown test - Placeholder assertion: expect(hlsOutputGroup).toBeDefined();
- **Line 316:** Unknown test - Placeholder assertion: expect(bandwidthMatch).toBeTruthy();
- **Line 317:** Unknown test - Placeholder assertion: expect(resolutionMatch).toBeTruthy();
- **Line 577:** \n - Placeholder assertion: expect(durationMatch).toBeTruthy();
- **Line 201:** / - Test has no assertions
- **Line 570:** \n - Test has no assertions

### auto-scaling-responsiveness.test.js

- **Line 240:** Unknown test - Placeholder assertion: expect(cpuPolicy).toBeDefined();
- **Line 241:** Unknown test - Placeholder assertion: expect(memoryPolicy).toBeDefined();
- **Line 296:** Unknown test - Placeholder assertion: expect(cpuAlarm).toBeDefined();
- **Line 297:** Unknown test - Placeholder assertion: expect(memoryAlarm).toBeDefined();

### cdn-caching-behavior.test.js

- **Line 331:** Unknown test - Placeholder assertion: expect(response.data).toBeDefined();
- **Line 364:** Unknown test - Placeholder assertion: expect(response.headers['etag']).toBeDefined();
- **Line 371:** Unknown test - Placeholder assertion: expect(response.headers['x-amz-cf-pop']).toBeDefined();
- **Line 372:** Unknown test - Placeholder assertion: expect(response.headers['x-amz-cf-id']).toBeDefined();
- **Line 425:** Unknown test - Placeholder assertion: expect(invalidationResult.Invalidation).toBeDefined();

### container-high-availability.test.js

- **Line 393:** Unknown test - Placeholder assertion: expect(service.deployments).toBeDefined();

### cost-anomaly-detection.test.js

- **Line 256:** Unknown test - Placeholder assertion: expect(serviceData).toBeDefined();
- **Line 268:** Unknown test - Placeholder assertion: expect(foundAnomaly).toBeUndefined();
- **Line 315:** T - Test has no assertions
- **Line 322:** T - Test has no assertions

### data-integrity-validation.test.js

- **Line 544:** : - Test has no assertions

### database-schema-consistency.test.js

- **Line 352:** Unknown test - Placeholder assertion: expect(foreignKeys[0].on_delete).toBeDefined();
- **Line 353:** Unknown test - Placeholder assertion: expect(foreignKeys[0].on_update).toBeDefined();

### deployment-approval-workflow.test.js

- **Line 461:** Unknown test - Placeholder assertion: expect(approval.id).toBeDefined();
- **Line 527:** Unknown test - Placeholder assertion: expect(processedApproval.approvedAt).toBeDefined();
- **Line 531:** Unknown test - Placeholder assertion: expect(processedApproval.rejectedAt).toBeDefined();
- **Line 627:** Unknown test - Placeholder assertion: expect(status.checklistCompletion).toBeDefined();

### dns-migration.test.js

- **Line 265:** Unknown test - Placeholder assertion: expect(migrationResult).toBeDefined();
- **Line 266:** Unknown test - Placeholder assertion: expect(migrationResult.hostedZoneId).toBeDefined();
- **Line 268:** Unknown test - Placeholder assertion: expect(migrationResult.nameServers).toBeDefined();
- **Line 286:** Unknown test - Placeholder assertion: expect(storedHostedZone).toBeDefined();
- **Line 374:** Unknown test - Placeholder assertion: expect(storedZone).toBeDefined();
- **Line 425:** Unknown test - Placeholder assertion: expect(propagationResult.reason).toBeDefined();
- **Line 456:** Unknown test - Placeholder assertion: expect(migrationService.getHostedZone(invalidDomain)).toBeUndefined();
- **Line 457:** Unknown test - Placeholder assertion: expect(migrationService.getNameServers(invalidDomain)).toBeUndefined();
- **Line 121:** . - Test has no assertions

### file-type-support.test.js

- **Line 233:** Unknown test - Placeholder assertion: expect(headResult.Metadata).toBeDefined();
- **Line 253:** Unknown test - Placeholder assertion: expect(getResult.Body).toBeDefined();
- **Line 254:** Unknown test - Placeholder assertion: expect(getResult.ContentType).toBeDefined();
- **Line 256:** Unknown test - Placeholder assertion: expect(getResult.ETag).toBeDefined();
- **Line 259:** Unknown test - Placeholder assertion: expect(getResult.Metadata).toBeDefined();
- **Line 434:** Unknown test - Placeholder assertion: expect(result).toBeDefined();
- **Line 535:** Unknown test - Placeholder assertion: expect(uploadResult).toBeDefined();
- **Line 536:** Unknown test - Placeholder assertion: expect(uploadResult.ETag).toBeDefined();
- **Line 547:** Unknown test - Placeholder assertion: expect(getResult.Metadata).toBeDefined();
- **Line 558:** Unknown test - Placeholder assertion: expect(getResult.ETag).toBeDefined();
- **Line 707:** Unknown test - Placeholder assertion: expect(uploadResult).toBeDefined();
- **Line 746:** Unknown test - Placeholder assertion: expect(headResult.Metadata).toBeDefined();
- **Line 121:** / - Test has no assertions
- **Line 712:** / - Test has no assertions

### health-check-failover.test.js

- **Line 305:** Unknown test - Placeholder assertion: expect(primaryRecord).toBeDefined();
- **Line 306:** Unknown test - Placeholder assertion: expect(secondaryRecord).toBeDefined();

### image-build-and-registry.test.js

- **Line 430:** Unknown test - Placeholder assertion: expect(registryImage).toBeDefined();
- **Line 473:** Unknown test - Placeholder assertion: expect(registryImage).toBeDefined();
- **Line 515:** Unknown test - Placeholder assertion: expect(registryImage.manifest).toBeDefined();
- **Line 517:** Unknown test - Placeholder assertion: expect(registryImage.manifest.config).toBeDefined();
- **Line 518:** Unknown test - Placeholder assertion: expect(registryImage.manifest.layers).toBeDefined();
- **Line 523:** Unknown test - Placeholder assertion: expect(layer.mediaType).toBeDefined();

### migration-progress-tracking.test.js

- **Line 301:** Unknown test - Placeholder assertion: expect(phase.startTime).toBeUndefined();
- **Line 315:** Unknown test - Placeholder assertion: expect(phase.endTime).toBeUndefined();
- **Line 327:** Unknown test - Placeholder assertion: expect(overview.currentPhase).toBeDefined();
- **Line 476:** Unknown test - Placeholder assertion: expect(dependency).toBeDefined();
- **Line 634:** Unknown test - Placeholder assertion: expect(alert.id).toBeDefined();
- **Line 636:** Unknown test - Placeholder assertion: expect(alert.message).toBeDefined();
- **Line 639:** Unknown test - Placeholder assertion: expect(alert.metadata).toBeDefined();

### migration-rollback-capability.test.js

- **Line 211:** Unknown test - Placeholder assertion: expect(error).toBeUndefined();

### redis-compatibility.test.js

- **Line 208:** Unknown test - Placeholder assertion: expect(elastiCacheResult).toBeDefined();

### signed-url-security.test.js

- **Line 398:** Unknown test - Placeholder assertion: expect(response.data).toBeDefined();
- **Line 406:** Unknown test - Placeholder assertion: expect(response.headers['x-amz-cf-pop']).toBeDefined();
- **Line 407:** Unknown test - Placeholder assertion: expect(response.headers['x-amz-cf-id']).toBeDefined();
- **Line 465:** Unknown test - Placeholder assertion: expect(validResponse.data).toBeDefined();
- **Line 560:** Unknown test - Placeholder assertion: expect(response.data).toBeDefined();
- **Line 568:** Unknown test - Placeholder assertion: expect(validUrlObj.searchParams.get('Signature')).toBeTruthy();
- **Line 593:** Unknown test - Placeholder assertion: expect(currentUrlObj.searchParams.get(param)).toBeTruthy();
- **Line 680:** Unknown test - Placeholder assertion: expect(originalResponse.data).toBeDefined();
- **Line 96:** / - Test has no assertions

### stream-access-control.test.js

- **Line 478:** Unknown test - Placeholder assertion: expect(session).toBeTruthy();
- **Line 481:** Unknown test - Placeholder assertion: expect(session.streamId).toBeTruthy();
- **Line 482:** Unknown test - Placeholder assertion: expect(session.streamKey).toBeTruthy();

### stream-chat-integration.test.js

- **Line 160:** Property 16: Stream Chat Integration - Chat functionality synchronized with stream state - Placeholder assertion: expect(stream).toBeTruthy();
- **Line 220:** Unknown test - Placeholder assertion: expect(found).toBeTruthy();
- **Line 267:** Unknown test - Placeholder assertion: expect(broadcasterMessage).toBeTruthy();
- **Line 271:** Unknown test - Placeholder assertion: expect(viewerMessage).toBeTruthy();
- **Line 316:** Unknown test - Placeholder assertion: expect(broadcasterMessage).toBeTruthy();
- **Line 332:** Unknown test - Placeholder assertion: expect(viewerMessage).toBeTruthy();
- **Line 421:** Unknown test - Placeholder assertion: expect(retrieved).toBeTruthy();

### stream-recording-consistency.test.js

- **Line 281:** Unknown test - Placeholder assertion: expect(recordingDestination).toBeDefined();
- **Line 314:** Unknown test - Placeholder assertion: expect(vodJob).toBeTruthy();
- **Line 361:** Unknown test - Placeholder assertion: expect(masterPlaylist).toBeDefined();
- **Line 627:** Unknown test - Placeholder assertion: expect(jobDetails.Job.OutputGroupDetails).toBeDefined();
- **Line 676:** Unknown test - Placeholder assertion: expect(masterPlaylist).toBeDefined();

### subdomain-routing.test.js

- **Line 428:** Unknown test - Placeholder assertion: expect(resolvedEndpoint.endpoint).toBeDefined();
- **Line 591:** Unknown test - Placeholder assertion: expect(result.matchedLocation).toBeDefined();

### system-availability.test.js

- **Line 459:** Unknown test - Placeholder assertion: expect(healthData.message).toBeDefined();
- **Line 479:** Unknown test - Skipped or focused test: describe.skip('System Availability Properties (Skipped in Production)', () => {
- **Line 480:** Production tests disabled - Test has no assertions

### test-execution-completeness.test.js

- **Line 383:** Unknown test - Placeholder assertion: expect(suiteReport).toBeDefined();
- **Line 481:** Unknown test - Placeholder assertion: expect(coverageReport).toBeDefined();

### vpc-network-isolation.test.js

- **Line 222:** Unknown test - Placeholder assertion: expect(internetRoute?.NatGatewayId).toBeDefined();
- **Line 223:** Unknown test - Placeholder assertion: expect(internetRoute?.GatewayId).toBeUndefined();
- **Line 234:** Unknown test - Placeholder assertion: expect(permission.IpRanges?.some(range => range.CidrIp === '0.0.0.0/0')).toBeFalsy();
- **Line 236:** Unknown test - Placeholder assertion: expect(permission.UserIdGroupPairs).toBeDefined();
- **Line 246:** Unknown test - Placeholder assertion: expect(permission.UserIdGroupPairs).toBeDefined();
- **Line 315:** Unknown test - Placeholder assertion: expect(hasInternetAccess).toBeFalsy();
- **Line 323:** Unknown test - Placeholder assertion: expect(permission.UserIdGroupPairs).toBeDefined();

### zero-downtime-deployment.test.js

- **Line 338:** Unknown test - Placeholder assertion: expect(deploymentGroupInfo.blueGreenDeploymentConfiguration).toBeDefined();
- **Line 370:** Unknown test - Placeholder assertion: expect(blueTaskSet).toBeDefined();
- **Line 371:** Unknown test - Placeholder assertion: expect(greenTaskSet).toBeDefined();

### email-service.test.ts

- **Line 233:** should generate verification tokens - Placeholder assertion: expect(token1).toBeTruthy();
- **Line 234:** should generate verification tokens - Placeholder assertion: expect(token2).toBeTruthy();
- **Line 254:** should reject invalid tokens - Placeholder assertion: expect(result.email).toBeUndefined();
- **Line 271:** Unknown test - Placeholder assertion: expect(result.email).toBeUndefined();
