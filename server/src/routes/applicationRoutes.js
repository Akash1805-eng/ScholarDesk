'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/applicationController');
const { authenticate, requireApprovedStudent } = require('../middleware/authMiddleware');

router.post('/preview', authenticate, requireApprovedStudent, ctrl.previewApplication);
router.post('/', authenticate, requireApprovedStudent, ctrl.submitApplication);
router.get('/my', authenticate, ctrl.listMyApplications);
router.get('/:id', authenticate, ctrl.getApplication);
router.patch('/:id/corrections', authenticate, requireApprovedStudent, ctrl.submitCorrections);

module.exports = router;
