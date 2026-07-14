const express = require('express');
const authRoutes = require('./auth.routes');
const menuRoutes = require('./menu.routes');
const inventoryRoutes = require('./inventory.routes');
const planningRoutes = require('./planning.routes');
const salesRoutes = require('./sales.routes');


const router = express.Router();

// Tambahkan route domain lain di sini seiring capstone berkembang,
// misal: router.use('/products', productRoutes);
router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/planning', planningRoutes);
router.use('/sales', salesRoutes);

router.get('/health', (req, res) => res.status(200).json({ success: true, message: 'OK' }));

module.exports = router;