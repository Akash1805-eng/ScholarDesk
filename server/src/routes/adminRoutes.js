'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { importUpload } = require('../middleware/uploadMiddleware');
const { importLimiter } = require('../middleware/rateLimitMiddleware');

const isAdmin = [authenticate, authorize('admin')];

router.post('/verifiers', ...isAdmin, ctrl.createVerifier);
router.get('/verifiers', ...isAdmin, ctrl.listVerifiers);
router.get('/students', ...isAdmin, ctrl.listStudentMaster);
router.post('/students/import/preview', ...isAdmin, importLimiter, importUpload.single('file'), ctrl.importPreview);
router.post('/students/import/confirm', ...isAdmin, importLimiter, ctrl.importCommit);
router.get('/students/import/template', ...isAdmin, ctrl.downloadTemplate);
router.get('/students/import/history', ...isAdmin, ctrl.getImportHistory);
router.post('/students/promote', ...isAdmin, ctrl.promoteYear);
router.patch('/applications/:id/decision', ...isAdmin, ctrl.makeDecision);
router.get('/reports', ...isAdmin, ctrl.getReports);

module.exports = router;
