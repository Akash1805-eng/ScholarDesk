'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentController');
const { authenticate, requireApprovedStudent } = require('../middleware/authMiddleware');
const { documentUpload } = require('../middleware/uploadMiddleware');

router.get('/profile', authenticate, requireApprovedStudent, ctrl.getProfile);
router.put('/profile', authenticate, requireApprovedStudent, ctrl.updateProfile);
router.get('/documents', authenticate, requireApprovedStudent, ctrl.getDocuments);
router.post('/documents', authenticate, requireApprovedStudent, documentUpload.single('file'), ctrl.uploadDocument);
router.get('/documents/:id/download', authenticate, ctrl.downloadDocument);
router.get('/documents/:id/file', authenticate, ctrl.downloadDocument);

module.exports = router;
