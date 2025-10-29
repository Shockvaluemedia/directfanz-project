# API Response Standardization Migration Plan

## Current State Analysis

The DirectFanZ API currently has 3 different response patterns:

1. **Manual Responses** - Direct NextResponse.json() calls with inconsistent structure
2. **Basic Helpers** - Using api-utils.ts helpers (apiSuccess, apiError)
3. **Advanced System** - Using api-error-handler.ts comprehensive system

## Target State

Standardize all API routes to use the advanced `withApiHandler` system from `api-error-handler.ts` which provides:

- Consistent response structure
- Proper error categorization  
- Request ID tracking
- User context logging
- Automatic error normalization
- Development vs production error handling

## Migration Strategy

### Phase 1: Standardize Response Structure
✅ **COMPLETED** - Advanced error handling system already exists in `api-error-handler.ts`

### Phase 2: Migrate Routes by Priority

**High Priority Routes** (Auth & Core functionality):
- `/api/auth/login` 
- `/api/auth/register`
- `/api/auth/forgot-password`
- `/api/artist/content` (GET/POST)
- `/api/artist/profile`

**Medium Priority Routes**:
- `/api/admin/*` routes
- `/api/analytics/*` routes  
- `/api/upload/*` routes

**Low Priority Routes**:
- Debug routes
- Test routes
- Health check routes

### Phase 3: Remove Legacy Helpers
- Keep `api-error-handler.ts` as the primary system
- Deprecate `api-errors.ts` and `api-utils.ts`
- Update imports across the codebase

## Standard Response Format

```typescript
// Success Response
{
  success: true,
  data: T,
  requestId: string,
  timestamp: string
}

// Error Response  
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any,
    timestamp: string
  },
  requestId: string,
  timestamp: string
}
```

## Implementation Examples

### Before (Manual Response)
```typescript
export async function POST(request: NextRequest) {
  try {
    // logic here
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: user,
      token: token,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
```

### After (Standardized)
```typescript
export const POST = withAuthenticatedApiHandler(
  async (context: ApiRequestContext, userId: string, userRole: string) => {
    // logic here - just return the data
    return {
      message: 'Login successful', 
      user: user,
      token: token
    };
    // Error handling is automatic via withApiHandler wrapper
  }
);
```

## Benefits

1. **Consistency** - All APIs return the same structure
2. **Monitoring** - Request IDs for tracing issues
3. **Debugging** - Better error context in development
4. **Security** - Sanitized error messages in production
5. **Performance** - Built-in request timing and logging
6. **Type Safety** - TypeScript interfaces for all responses

## Next Steps

1. Migrate high-priority auth routes first
2. Test each migration thoroughly  
3. Update frontend to expect standardized responses
4. Remove old helper functions
5. Update API documentation