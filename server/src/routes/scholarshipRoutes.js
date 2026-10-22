'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/applicationController');
const { authenticate, requireApprovedStudent } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Scholarship routes (mounted under /api/scholarships)
router.get('/', authenticate, ctrl.listScholarships);
router.get('/:id', authenticate, ctrl.getScholarship);
router.get('/:id/eligibility', authenticate, requireApprovedStudent, ctrl.checkEligibility);
router.post('/', authenticate, authorize('admin'), ctrl.createScholarship);
router.put('/:id', authenticate, authorize('admin'), ctrl.updateScholarship);

module.exports = router;
