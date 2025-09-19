// Mock for jose JWT library
module.exports = {
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    setSubject: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token'),
  })),
  jwtVerify: jest.fn().mockResolvedValue({
    payload: { sub: 'user-123', email: 'test@example.com' },
  }),
  createLocalJWKSet: jest.fn(),
  importJWK: jest.fn(),
  importPKCS8: jest.fn(),
  importSPKI: jest.fn(),
  base64url: {
    encode: jest.fn().mockReturnValue('encoded-value'),
    decode: jest.fn().mockReturnValue('decoded-value'),
  },
};
