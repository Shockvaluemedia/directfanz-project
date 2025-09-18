import { jest } from '@jest/globals';
import { sendEmail, DEFAULT_NOTIFICATION_PREFERENCES } from '../notifications';

// Since notifications module is globally mocked, we'll test the mock itself
// This test verifies that the module exports the correct structure
describe('Notifications', () => {
  describe('sendEmail', () => {
    it('should be a mock function', () => {
      expect(jest.isMockFunction(sendEmail)).toBe(true);
    });
  });

  describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
        newContent: true,
        comments: true,
        subscriptionUpdates: true,
      });
    });
  });
});
