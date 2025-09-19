// Mock for NextAuth
module.exports = {
  default: jest.fn().mockImplementation(() => ({
    GET: jest.fn(),
    POST: jest.fn(),
  })),
  NextAuth: jest.fn().mockImplementation(() => ({
    GET: jest.fn(),
    POST: jest.fn(),
  })),
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'user-123', email: 'test@example.com', role: 'fan' },
    expires: '2024-12-31',
  }),
  // Mock providers
  providers: {
    Google: jest.fn(),
    GitHub: jest.fn(),
    Credentials: jest.fn(),
  },
};
