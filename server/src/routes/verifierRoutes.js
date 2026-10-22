'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/verifierController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const isVerifier = [authenticate, authorize('verifier', 'admin')];

router.get('/registrations', ...isVerifier, ctrl.getPendingRegistrations);
router.patch('/registrations/:id', ...isVerifier, ctrl.reviewRegistration);
router.get('/applications', ...isVerifier, ctrl.getApplicationQueue);
router.patch('/applications/:id/status', ...isVerifier, ctrl.updateApplicationStatus);

module.exports = router;
