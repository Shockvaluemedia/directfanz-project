# Error Handling System

This document provides a quick overview of our unified error handling system.
For detailed information, refer to the full guide in
`docs/ERROR_HANDLING_GUIDE.md`.

## Overview

Our error handling system provides:

- Consistent error structure across both API and client code
- Automatic error categorization and logging
- User-friendly error messages
- Monitoring integration
- Request tracing with unique IDs

## Key Components

1. **Error Types** (`errors.ts`)
   - `AppError` class with error codes
   - User-friendly message mapping

2. **API Error Handler** (`api-error-handler.ts`)
   - API route wrappers
   - Standardized responses

3. **Client Error Handler** (`client-error-handler.ts`)
   - React utilities and hooks
   - Toast notifications

4. **Error Monitoring** (`error-monitoring.ts`)
   - Monitoring service integration
   - Performance tracking

5. **Error Boundaries** (`ErrorBoundary.tsx`)
   - React error boundaries
   - Recovery mechanisms

## Quick Usage Guide

### API Routes

```typescript
// Simple API route
export const GET = withApiHandler(async context => {
  // Your code here (errors handled automatically)
  return data;
});

// Authenticated route
export const POST = withAuthenticatedApiHandler(
  async (context, userId, userRole, request) => {
    // Parse request with validation
    const data = validateApiRequest(schema, await request.json(), context);

    // Throw typed errors when needed
    if (!hasPermission) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Permission denied',
        403,
        { details: 'context' },
        context.requestId,
        userId
      );
    }

    return result;
  }
);
```

### React Components

```tsx
function MyComponent() {
  // Use the error handling hook
  const { apiCall, handleError } = useErrorHandler();

  // Handle API calls with automatic error handling
  const handleSubmit = async data => {
    const result = await apiCall(async () => {
      return fetch('/api/endpoint', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(res => res.json());
    });

    if (result) {
      // Success case
    }
    // Errors show toast notifications automatically
  };

  return <form onSubmit={handleSubmit}>...</form>;
}

// Use error boundaries
function MyPage() {
  return (
    <PageErrorBoundary>
      <PageContent />
    </PageErrorBoundary>
  );
}
```

## Migration Tips

1. Replace manual try/catch with `withApiHandler` or
   `withAuthenticatedApiHandler`
2. Replace generic errors with typed `AppError`s
3. Add error boundaries to React components
4. Use the `useErrorHandler` hook for client-side error handling

## Best Practices

- Use appropriate error codes for each error type
- Include helpful context for debugging
- Write user-friendly error messages
- Don't log sensitive information
- Test error scenarios thoroughly

For more details, see the complete documentation in
`docs/ERROR_HANDLING_GUIDE.md`.
