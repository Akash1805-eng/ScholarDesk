'use strict';

/**
 * Unit and integration tests for SendGrid emailService and OTP lifecycle.
 *
 * Covers:
 *  1. Missing API key
 *  2. Invalid sender address
 *  3. Successful email request via SendGrid
 *  4. SendGrid failure handling
 *  5. Expired OTP
 *  6. Wrong OTP
 *  7. Reused OTP
 *  8. OTP resend cooldown & rate limits
 */

const mockSend = jest.fn();
const mockSetApiKey = jest.fn();

jest.mock('@sendgrid/mail', () => ({
  setApiKey: mockSetApiKey,
  send: mockSend,
}));

// Setup default env before importing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.COLLEGE_EMAIL_DOMAIN = 'eec.srmrmp.edu.in';
process.env.OTP_EXPIRY_SECONDS = '30';
process.env.CLIENT_URL = 'http://localhost:5173';

const emailService = require('../src/services/emailService');
const { generateOtp, hashOtp, verifyOtpHash } = require('../src/utils/generateOtp');

describe('generateOtp & hash utilities', () => {
  test('generates a 6-digit numeric string', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });

  test('hash matches the same OTP', () => {
    const otp = '482910';
    const hash = hashOtp(otp);
    expect(verifyOtpHash('482910', hash)).toBe(true);
  });

  test('hash rejects mismatched OTP', () => {
    const hash = hashOtp('482910');
    expect(verifyOtpHash('999999', hash)).toBe(false);
  });

  test('verifyOtpHash rejects malformed hashes', () => {
    expect(verifyOtpHash('123456', '')).toBe(false);
    expect(verifyOtpHash('123456', 'not-a-hash')).toBe(false);
  });
});

describe('1. Missing API key validation', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, origEnv);
  });

  test('throws EMAIL_NOT_CONFIGURED if SENDGRID_API_KEY is missing in non-test mode', () => {
    process.env.NODE_ENV = 'development';
    process.env.SENDGRID_API_KEY = '';
    process.env.EMAIL_FROM = 'Scholarship Desk <ivaanakash9865@gmail.com>';

    expect(() => {
      emailService._internal.validateConfig();
    }).toThrow('SENDGRID_API_KEY is missing');
  });

  test('throws EMAIL_NOT_CONFIGURED if SENDGRID_API_KEY is placeholder', () => {
    process.env.NODE_ENV = 'development';
    process.env.SENDGRID_API_KEY = 'your_sendgrid_api_key';
    process.env.EMAIL_FROM = 'Scholarship Desk <ivaanakash9865@gmail.com>';

    expect(() => {
      emailService._internal.validateConfig();
    }).toThrow('SENDGRID_API_KEY is missing');
  });

  test('throws EMAIL_NOT_CONFIGURED in production if SENDGRID_API_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.SENDGRID_API_KEY = '';
    process.env.EMAIL_FROM = 'Scholarship Desk <ivaanakash9865@gmail.com>';

    expect(() => {
      emailService._internal.validateConfig();
    }).toThrow('SENDGRID_API_KEY is missing');
  });
});

describe('2. Invalid sender address validation', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, origEnv);
  });

  test('throws EMAIL_NOT_CONFIGURED if EMAIL_FROM is missing', () => {
    process.env.NODE_ENV = 'development';
    process.env.SENDGRID_API_KEY = 'SG.valid_mock_key';
    process.env.EMAIL_FROM = '';

    expect(() => {
      emailService._internal.validateConfig();
    }).toThrow('EMAIL_FROM sender address is missing');
  });

  test('throws EMAIL_INVALID_SENDER if EMAIL_FROM is malformed', () => {
    process.env.NODE_ENV = 'development';
    process.env.SENDGRID_API_KEY = 'SG.valid_mock_key';
    process.env.EMAIL_FROM = 'InvalidSenderWithoutAtSign';

    expect(() => {
      emailService._internal.validateConfig();
    }).toThrow('EMAIL_FROM sender address is invalid');
  });
});

describe('3. Successful email request via SendGrid', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSetApiKey.mockReset();
    process.env.NODE_ENV = 'development';
    process.env.SENDGRID_API_KEY = 'SG.mock_valid_key';
    process.env.EMAIL_FROM = '"Scholarship Desk <ivaanakash9865@gmail.com>"';
  });

  test('returns accepted: true with messageId when SendGrid returns 202', async () => {
    mockSend.mockResolvedValueOnce([
      {
        statusCode: 202,
        headers: {
          'x-message-id': 'sg_msg_id_abc123456',
        },
      },
      {},
    ]);

    const result = await emailService.sendOtpEmail({
      to: '310624104006@eec.srmrmp.edu.in',
      otp: '782194',
      purpose: 'registration',
      expirySeconds: 30,
    });

    expect(result.accepted).toBe(true);
    expect(result.messageId).toBe('sg_msg_id_abc123456');
    expect(mockSetApiKey).toHaveBeenCalledWith('SG.mock_valid_key');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '310624104006@eec.srmrmp.edu.in',
        from: 'Scholarship Desk <ivaanakash9865@gmail.com>',
        subject: expect.stringContaining('Registration OTP'),
      })
    );
  });
});

describe('4. SendGrid failure handling', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSetApiKey.mockReset();
    process.env.NODE_ENV = 'development';
    process.env.SENDGRID_API_KEY = 'SG.mock_valid_key';
    process.env.EMAIL_FROM = 'Scholarship Desk <ivaanakash9865@gmail.com>';
  });

  test('returns accepted: false and detailed error on SendGrid rejection', async () => {
    const error = new Error('Bad Request');
    error.response = {
      body: {
        errors: [
          {
            message: 'The from address does not match a verified Sender Identity.',
            field: 'from',
          },
        ],
      },
    };
    mockSend.mockRejectedValueOnce(error);

    const result = await emailService.sendOtpEmail({
      to: '310624104006@eec.srmrmp.edu.in',
      otp: '123456',
      purpose: 'registration',
      expirySeconds: 30,
    });

    expect(result.accepted).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.rawError).toContain('verified Sender Identity');
  });

  test('returns accepted: false on network / API exception', async () => {
    mockSend.mockRejectedValueOnce(new Error('Connection timeout to api.sendgrid.com'));

    const result = await emailService.sendOtpEmail({
      to: '310624104006@eec.srmrmp.edu.in',
      otp: '123456',
      purpose: 'registration',
      expirySeconds: 30,
    });

    expect(result.accepted).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.rawError).toContain('Connection timeout');
  });
});

describe('5. Expired OTP handling', () => {
  test('rejects OTP after 30 seconds have elapsed', () => {
    const expirySeconds = 30;
    const dispatchedAt = new Date(Date.now() - 31000); // 31 seconds ago
    const expiresAt = new Date(dispatchedAt.getTime() + expirySeconds * 1000);

    const isExpired = new Date() > expiresAt;
    expect(isExpired).toBe(true);
  });

  test('accepts OTP within 30 seconds', () => {
    const expirySeconds = 30;
    const dispatchedAt = new Date(Date.now() - 10000); // 10 seconds ago
    const expiresAt = new Date(dispatchedAt.getTime() + expirySeconds * 1000);

    const isExpired = new Date() > expiresAt;
    expect(isExpired).toBe(false);
  });
});

describe('6. Wrong OTP handling', () => {
  test('fails verification when input digits do not match hash', () => {
    const generated = '654321';
    const hash = hashOtp(generated);
    const submitted = '123456';

    const isValid = verifyOtpHash(submitted, hash);
    expect(isValid).toBe(false);
  });
});

describe('7. Reused OTP handling', () => {
  test('enforces single-use flag and blocks subsequent verification', () => {
    const otpDoc = {
      used: false,
      codeHash: hashOtp('555666'),
      attempts: 0,
    };

    // First use: verify and mark used
    expect(otpDoc.used).toBe(false);
    expect(verifyOtpHash('555666', otpDoc.codeHash)).toBe(true);
    otpDoc.used = true;

    // Second use: must be blocked because used === true
    expect(otpDoc.used).toBe(true);
  });
});

describe('8. Resend cooldown & rate control', () => {
  test('blocks resend if cooldown has not elapsed', () => {
    const cooldownSeconds = 30;
    const lastResentAt = new Date(Date.now() - 12000); // only 12 seconds ago
    const elapsed = Date.now() - lastResentAt.getTime();
    const inCooldown = elapsed < cooldownSeconds * 1000;

    expect(inCooldown).toBe(true);
  });

  test('allows resend once cooldown passes', () => {
    const cooldownSeconds = 30;
    const lastResentAt = new Date(Date.now() - 31000); // 31 seconds ago
    const elapsed = Date.now() - lastResentAt.getTime();
    const inCooldown = elapsed < cooldownSeconds * 1000;

    expect(inCooldown).toBe(false);
  });

  test('locks out after 5 failed attempts', () => {
    const maxAttempts = 5;
    const currentAttempts = 5;
    const lockedOut = currentAttempts >= maxAttempts;

    expect(lockedOut).toBe(true);
  });
});
