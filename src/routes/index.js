const express = require('express');
const authRoutes = require('./auth.routes');
const inventoryRoutes = require('./inventory.routes');

const router = express.Router();

// Tambahkan route domain lain di sini seiring capstone berkembang,
// misal: router.use('/products', productRoutes);
router.use('/auth', authRoutes);

// // Inventory
router.use('/inventory', inventoryRoutes);

router.get('/health', (req, res) => res.status(200).json({ success: true, message: 'OK' }));

module.exports = router;
