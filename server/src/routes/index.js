'use strict';
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const studentRoutes = require('./studentRoutes');
const scholarshipRoutes = require('./scholarshipRoutes');
const applicationRoutes = require('./applicationRoutes');
const verifierRoutes = require('./verifierRoutes');
const adminRoutes = require('./adminRoutes');
const notificationRoutes = require('./notificationRoutes');
const { generalLimiter } = require('../middleware/rateLimitMiddleware');

// Apply general rate limit to all routes
router.use(generalLimiter);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Scholarship Desk API',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/scholarships', scholarshipRoutes);
router.use('/applications', applicationRoutes);
router.use('/verifier', verifierRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
