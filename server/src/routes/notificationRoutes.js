'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, ctrl.getNotifications);
router.patch('/:id/read', authenticate, ctrl.markRead);
router.patch('/read-all', authenticate, ctrl.markAllRead);

module.exports = router;
