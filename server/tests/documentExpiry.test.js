'use strict';

const { DOCUMENT_TYPES, DOCUMENT_EXPIRY_CONFIG, supportsExpiryDate } = require('../src/models/Document');
const { uploadDocument } = require('../src/controllers/studentController');
const Document = require('../src/models/Document');
const { saveFile } = require('../src/services/storageService');

// Mock storageService so tests don't write files
jest.mock('../src/services/storageService', () => ({
  generateStorageKey: jest.fn(() => 'mock-storage-key'),
  saveFile: jest.fn().mockResolvedValue(true),
  getFile: jest.fn().mockResolvedValue({ stream: {} }),
}));

describe('Document Expiry Configuration & Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Document Expiry Configuration Rules', () => {
    test('Identity Proof supports optional expiry', () => {
      expect(supportsExpiryDate('identity_proof')).toBe(true);
      expect(DOCUMENT_EXPIRY_CONFIG.identity_proof.supportsExpiry).toBe(true);
    });

    test('Income Certificate supports optional expiry', () => {
      expect(supportsExpiryDate('income_certificate')).toBe(true);
      expect(DOCUMENT_EXPIRY_CONFIG.income_certificate.supportsExpiry).toBe(true);
    });

    test('Disability Certificate supports optional expiry', () => {
      expect(supportsExpiryDate('disability_certificate')).toBe(true);
      expect(DOCUMENT_EXPIRY_CONFIG.disability_certificate.supportsExpiry).toBe(true);
    });

    test('Community Certificate has no expiry', () => {
      expect(supportsExpiryDate('community_certificate')).toBe(false);
      expect(DOCUMENT_EXPIRY_CONFIG.community_certificate.supportsExpiry).toBe(false);
    });

    test('Marksheet has no expiry', () => {
      expect(supportsExpiryDate('marksheet')).toBe(false);
      expect(DOCUMENT_EXPIRY_CONFIG.marksheet.supportsExpiry).toBe(false);
    });

    test('First Graduate Certificate has no expiry', () => {
      expect(supportsExpiryDate('first_graduate_certificate')).toBe(false);
      expect(DOCUMENT_EXPIRY_CONFIG.first_graduate_certificate.supportsExpiry).toBe(false);
    });

    test('Bank Evidence has no expiry', () => {
      expect(supportsExpiryDate('bank_evidence')).toBe(false);
      expect(DOCUMENT_EXPIRY_CONFIG.bank_evidence.supportsExpiry).toBe(false);
    });

    test('Bonafide Certificate has no expiry', () => {
      expect(supportsExpiryDate('bonafide_certificate')).toBe(false);
      expect(DOCUMENT_EXPIRY_CONFIG.bonafide_certificate.supportsExpiry).toBe(false);
    });

    test('Unknown or invalid document type returns false', () => {
      expect(supportsExpiryDate('random_unknown_type')).toBe(false);
      expect(supportsExpiryDate(null)).toBe(false);
      expect(supportsExpiryDate(undefined)).toBe(false);
    });
  });

  describe('2. Controller Date Validation & Conditional Expiry Handling', () => {
    function mockReqRes(body, file = { originalname: 'test.pdf', mimetype: 'application/pdf', size: 1024, buffer: Buffer.from('test') }) {
      const req = {
        user: { id: '507f1f77bcf86cd799439011', role: 'student' },
        body,
        file,
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();
      return { req, res, next };
    }

    test('Rejects invalid issue date format', async () => {
      const { req, res, next } = mockReqRes({
        documentType: 'identity_proof',
        issueDate: 'not-a-valid-date',
      });

      await uploadDocument(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Invalid issue date format.',
      }));
    });

    test('Rejects invalid expiry date format', async () => {
      const { req, res, next } = mockReqRes({
        documentType: 'identity_proof',
        issueDate: '2026-01-01',
        expiryDate: 'invalid-expiry-date',
      });

      await uploadDocument(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Invalid expiry date format.',
      }));
    });

    test('Rejects expiry date earlier than issue date on expirable doc type', async () => {
      const { req, res, next } = mockReqRes({
        documentType: 'identity_proof',
        issueDate: '2026-06-01',
        expiryDate: '2026-01-01', // earlier than issue date!
      });

      await uploadDocument(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Expiry date cannot be earlier than issue date.',
      }));
    });

    test('Identity Proof can be uploaded WITH an expiry date', async () => {
      jest.spyOn(Document, 'findOne').mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
      const createSpy = jest.spyOn(Document, 'create').mockImplementation(data => Promise.resolve({ _id: 'doc1', ...data }));

      const { req, res, next } = mockReqRes({
        documentType: 'identity_proof',
        issueDate: '2026-01-01',
        expiryDate: '2030-01-01',
      });

      await uploadDocument(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        documentType: 'identity_proof',
        issueDate: new Date('2026-01-01'),
        expiryDate: new Date('2030-01-01'),
      }));
    });

    test('Identity Proof can be uploaded WITHOUT an expiry date', async () => {
      jest.spyOn(Document, 'findOne').mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
      const createSpy = jest.spyOn(Document, 'create').mockImplementation(data => Promise.resolve({ _id: 'doc2', ...data }));

      const { req, res, next } = mockReqRes({
        documentType: 'identity_proof',
        issueDate: '2026-01-01',
      });

      await uploadDocument(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        documentType: 'identity_proof',
        issueDate: new Date('2026-01-01'),
        expiryDate: null,
      }));
    });

    test('Income Certificate can be uploaded with or without an expiry date', async () => {
      jest.spyOn(Document, 'findOne').mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
      const createSpy = jest.spyOn(Document, 'create').mockImplementation(data => Promise.resolve({ _id: 'doc3', ...data }));

      const { req, res, next } = mockReqRes({
        documentType: 'income_certificate',
        issueDate: '2026-03-01',
        expiryDate: '2027-03-01',
      });

      await uploadDocument(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        documentType: 'income_certificate',
        expiryDate: new Date('2027-03-01'),
      }));
    });

    test('Disability Certificate can be uploaded with or without an expiry date', async () => {
      jest.spyOn(Document, 'findOne').mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
      const createSpy = jest.spyOn(Document, 'create').mockImplementation(data => Promise.resolve({ _id: 'doc4', ...data }));

      const { req, res, next } = mockReqRes({
        documentType: 'disability_certificate',
        issueDate: '2025-01-01',
      });

      await uploadDocument(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        documentType: 'disability_certificate',
        expiryDate: null,
      }));
    });

    test('Community Certificate, Marksheet, Bonafide etc. nullify stale expiryDate', async () => {
      jest.spyOn(Document, 'findOne').mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
      const createSpy = jest.spyOn(Document, 'create').mockImplementation(data => Promise.resolve({ _id: 'doc5', ...data }));

      const nonExpirableTypes = [
        'community_certificate',
        'marksheet',
        'first_graduate_certificate',
        'bank_evidence',
        'bonafide_certificate',
      ];

      for (const docType of nonExpirableTypes) {
        createSpy.mockClear();
        const { req, res, next } = mockReqRes({
          documentType: docType,
          issueDate: '2026-01-01',
          expiryDate: '2030-01-01', // Stale date submitted by client
        });

        await uploadDocument(req, res, next);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
          documentType: docType,
          issueDate: new Date('2026-01-01'),
          expiryDate: null, // Nullified because documentType does not support expiry
        }));
      }
    });
  });
});
