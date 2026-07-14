const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const planningService = require('../services/planning.service');

const createPlanning = asyncHandler(async (req, res) => {
    const planning = await planningService.createPlanning(req.body, req.user.id);

    return res.status(201).json(new ApiResponse(201,planning,"Planning berhasil dibuat."));
});

const getAllPlanning = asyncHandler(async (req, res) => {
    const planning = await planningService.getAllPlanning(req.user.id);

    return res.status(200).json(new ApiResponse(
            200,
            planning,
            "Planning berhasil diambil."
        )
    );

});

const getPlanningDetail = asyncHandler(async (req, res) => {

    const planning = await planningService.getPlanningDetail(
        req.params.id,
        req.user.id
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            planning,
            "Detail planning berhasil diambil."
        )
    );

});

const deletePlanning = asyncHandler(async (req, res) => {

    await planningService.deletePlanning(
        req.params.id,
        req.user.id
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            null,
            "Planning berhasil dihapus."
        )
    );

});

module.exports = {

    createPlanning,

    getAllPlanning,

    getPlanningDetail,

    deletePlanning

};