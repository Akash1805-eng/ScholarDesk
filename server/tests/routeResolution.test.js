'use strict';

const mockUserFindOne = jest.fn();
const mockOtpFindOne = jest.fn();
const mockStudentMasterFindOne = jest.fn();

jest.mock('../src/models/User', () => ({
  findOne: (...args) => mockUserFindOne(...args),
  findById: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../src/models/Otp', () => ({
  findOne: (...args) => mockOtpFindOne(...args),
  deleteMany: jest.fn().mockResolvedValue({}),
  deleteOne: jest.fn().mockResolvedValue({}),
  create: jest.fn(),
}));

jest.mock('../src/models/StudentMaster', () => ({
  findOne: (...args) => mockStudentMasterFindOne(...args),
  findById: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');

describe('Route Resolution & API Prefix Verification', () => {
  beforeEach(() => {
    mockUserFindOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    mockOtpFindOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    mockStudentMasterFindOne.mockResolvedValue(null);
  });

  describe('Root and Health Check Routes', () => {
    test('GET / returns 200 with service running status', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('running');
      expect(res.body.service).toBe('Scholarship Desk API');
    });

    test('GET /api returns 200 with service running status', async () => {
      const res = await request(app).get('/api');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('running');
      expect(res.body.service).toBe('Scholarship Desk API');
    });

    test('GET /health returns 200 with service info', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('Scholarship Desk API');
    });

    test('GET /api/health returns 200 with service info', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('Scholarship Desk API');
    });
  });

  describe('Auth Routes (Resolution with and without /api)', () => {
    test('POST /api/auth/login resolves to login handler (not 404 Route not found)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ collegeEmail: 'test@eec.srmrmp.edu.in', password: 'password123', selectedRole: 'student' });
      // Controller executed: user was not found so it returned 401 INVALID_CREDENTIALS, NOT 404 Route not found
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).not.toBe('Route not found');
    });

    test('POST /auth/login resolves to login handler directly (not 404 Route not found)', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ collegeEmail: 'test@eec.srmrmp.edu.in', password: 'password123', selectedRole: 'student' });
      // Controller executed directly without /api prefix: returned 401 INVALID_CREDENTIALS, NOT 404 Route not found
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).not.toBe('Route not found');
    });

    test('POST /api/auth/register resolves to register handler (not 404 Route not found)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).not.toBe('Route not found');
    });

    test('POST /auth/register resolves to register handler directly (not 404 Route not found)', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).not.toBe('Route not found');
    });

    test('POST /api/auth/forgot-password resolves to forgot-password handler (not 404 Route not found)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ collegeEmail: 'test@eec.srmrmp.edu.in' });
      expect(res.status).not.toBe(404);
      expect(res.body.message).not.toBe('Route not found');
    });

    test('POST /auth/forgot-password resolves to forgot-password handler directly (not 404 Route not found)', async () => {
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ collegeEmail: 'test@eec.srmrmp.edu.in' });
      expect(res.status).not.toBe(404);
      expect(res.body.message).not.toBe('Route not found');
    });

    test('POST /api/auth/verify-otp resolves correctly (not 404 Route not found)', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ collegeEmail: 'test@eec.srmrmp.edu.in', otp: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.message).not.toBe('Route not found');
    });

    test('POST /auth/verify-otp resolves correctly directly (not 404 Route not found)', async () => {
      const res = await request(app)
        .post('/auth/verify-otp')
        .send({ collegeEmail: 'test@eec.srmrmp.edu.in', otp: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.message).not.toBe('Route not found');
    });

    test('GET /api/auth/me returns 401 unauthenticated, not 404 Route not found', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.message).not.toBe('Route not found');
    });

    test('GET /auth/me returns 401 unauthenticated, not 404 Route not found', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.message).not.toBe('Route not found');
    });
  });

  describe('Non-Existent Routes Fallback', () => {
    test('Non-existent route returns 404 Route not found', async () => {
      const res = await request(app).get('/api/non-existent-endpoint-xyz');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        message: 'Route not found',
      });
    });

    test('Non-existent root route returns 404 Route not found', async () => {
      const res = await request(app).get('/non-existent-endpoint-xyz');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        message: 'Route not found',
      });
    });
  });

  describe('Frontend Base URL Normalizer Unit Test', () => {
    function resolveApiBaseUrl(raw) {
      if (!raw || typeof raw !== 'string') return '/api';
      const clean = raw.trim().replace(/\/+$/, '');
      if (!clean || clean === '/api') return '/api';
      return clean.endsWith('/api') ? clean : `${clean}/api`;
    }

    test('handles empty or missing VITE_API_URL', () => {
      expect(resolveApiBaseUrl('')).toBe('/api');
      expect(resolveApiBaseUrl(undefined)).toBe('/api');
      expect(resolveApiBaseUrl(null)).toBe('/api');
      expect(resolveApiBaseUrl('/api')).toBe('/api');
      expect(resolveApiBaseUrl('/api/')).toBe('/api');
    });

    test('handles Render URL without /api', () => {
      expect(resolveApiBaseUrl('https://scholarship-desk-api.onrender.com'))
        .toBe('https://scholarship-desk-api.onrender.com/api');
    });

    test('handles Render URL with trailing slash', () => {
      expect(resolveApiBaseUrl('https://scholarship-desk-api.onrender.com/'))
        .toBe('https://scholarship-desk-api.onrender.com/api');
    });

    test('preserves Render URL with /api already present', () => {
      expect(resolveApiBaseUrl('https://scholarship-desk-api.onrender.com/api'))
        .toBe('https://scholarship-desk-api.onrender.com/api');
    });

    test('handles Render URL with /api and trailing slash', () => {
      expect(resolveApiBaseUrl('https://scholarship-desk-api.onrender.com/api/'))
        .toBe('https://scholarship-desk-api.onrender.com/api');
    });
  });
});
