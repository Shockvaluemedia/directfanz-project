import { apiSuccess, apiCreated, apiError, apiValidationError } from '@/lib/api-response';

describe('API Response Helpers', () => {
  it('apiSuccess wraps data in standard format', async () => {
    const res = apiSuccess({ user: { id: '1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: { user: { id: '1' } } });
  });

  it('apiCreated returns 201', async () => {
    const res = apiCreated({ id: 'new-1' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('apiError returns standard error format', async () => {
    const res = apiError('NOT_FOUND', 'User not found');
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
  });

  it('apiError uses custom status when provided', async () => {
    const res = apiError('CUSTOM', 'Custom error', undefined, 418);
    expect(res.status).toBe(418);
  });

  it('apiValidationError returns 400 with details', async () => {
    const errors = [{ path: ['email'], message: 'Required' }];
    const res = apiValidationError(errors);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual(errors);
  });
});
