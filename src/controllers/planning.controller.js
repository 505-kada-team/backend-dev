const planningService = require('../services/planning.service');

// @route GET /api/v1/planning
const getAll = async (req, res, next) => {
  try {
    const plannings = await planningService.getAllPlannings(req.user._id);
    res.status(200).json({ success: true, data: plannings });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/v1/planning/:id
const getById = async (req, res, next) => {
  try {
    const planning = await planningService.getPlanningById(req.params.id, req.user._id);
    res.status(200).json({ success: true, data: planning });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/v1/planning
const create = async (req, res, next) => {
  try {
    const { name } = req.body;
    const planning = await planningService.createPlanning(req.user._id, name);
    res.status(201).json({ success: true, data: planning });
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/v1/planning/:id
const update = async (req, res, next) => {
  try {
    const planning = await planningService.updatePlanning(req.params.id, req.user._id, req.body);
    res.status(200).json({ success: true, data: planning });
  } catch (error) {
    next(error);
  }
};

// @route PATCH /api/v1/planning/:id/set-final
// Endpoint terpisah dari update biasa karena ini sebuah aksi dengan efek
// samping ke planning lain (menurunkan planning final sebelumnya).
const setFinal = async (req, res, next) => {
  try {
    const planning = await planningService.setAsFinal(req.params.id, req.user._id);
    res.status(200).json({ success: true, data: planning });
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/v1/planning/:id
const remove = async (req, res, next) => {
  try {
    await planningService.deletePlanning(req.params.id, req.user._id);
    res.status(200).json({ success: true, message: 'Planning berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getById, create, update, setFinal, remove };
