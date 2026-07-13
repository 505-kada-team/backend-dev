const Planning = require('../models/planning.model');
const ApiError = require('../utils/ApiError');

/**
 * Ambil semua planning milik satu user, terbaru dulu.
 */
const getAllPlannings = async (userId) => {
  return Planning.find({ userId }).sort({ createdAt: -1 });
};

/**
 * Ambil satu planning berdasarkan id, dipastikan miliknya user yang login.
 * Filter {_id, userId} sekaligus mencegah user A membaca planning milik user B
 * meski tahu id-nya.
 */
const getPlanningById = async (planningId, userId) => {
  const planning = await Planning.findOne({ _id: planningId, userId });
  if (!planning) {
    throw new ApiError(404, 'Planning tidak ditemukan');
  }
  return planning;
};

/**
 * Buat planning baru. Selalu dimulai sebagai 'draft' -
 * status 'final' hanya boleh didapat lewat setAsFinal().
 */
const createPlanning = async (userId, name) => {
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Nama planning wajib diisi', { field: 'name' });
  }

  return Planning.create({ userId, name: name.trim(), status: 'draft' });
};

/**
 * Update data planning biasa (misal ganti nama).
 * Field status sengaja dibuang dari updates - perubahan status HARUS lewat
 * setAsFinal(), supaya aturan "1 final per user" tidak pernah bisa dilewati.
 */
const updatePlanning = async (planningId, userId, updates) => {
  const safeUpdates = { ...updates };
  delete safeUpdates.status;
  delete safeUpdates.userId; // jaga-jaga: owner tidak boleh dipindah lewat body request

  if (safeUpdates.name !== undefined) {
    if (!safeUpdates.name.trim()) {
      throw new ApiError(400, 'Nama planning wajib diisi', { field: 'name' });
    }
    safeUpdates.name = safeUpdates.name.trim();
  }

  const planning = await Planning.findOneAndUpdate(
    { _id: planningId, userId },
    safeUpdates,
    { new: true, runValidators: true }
  );

  if (!planning) {
    throw new ApiError(404, 'Planning tidak ditemukan');
  }
  return planning;
};

/**
 * Jadikan satu planning sebagai 'final' untuk user ini.
 * Dibungkus transaction supaya "turunkan yang lama" + "naikkan yang baru"
 * berjalan atomik - tidak akan ada state di mana dua-duanya final atau
 * dua-duanya draft kalau terjadi error di tengah proses.
 */
const setAsFinal = async (planningId, userId) => {
  const session = await Planning.startSession();
  try {
    let result;

    await session.withTransaction(async () => {
      // Pastikan planning yang ingin dijadikan final memang ada & milik user ini
      const target = await Planning.findOne({ _id: planningId, userId }).session(session);
      if (!target) {
        throw new ApiError(404, 'Planning tidak ditemukan');
      }

      // Turunkan planning 'final' lain milik user ini menjadi 'draft'
      await Planning.updateMany(
        { userId, status: 'final', _id: { $ne: planningId } },
        { status: 'draft' },
        { session }
      );

      target.status = 'final';
      result = await target.save({ session });
    });

    return result;
  } catch (error) {
    // Jaga-jaga kalau race condition tetap lolos transaction dan index unik menolak
    if (error.code === 11000) {
      throw new ApiError(409, 'Terjadi konflik saat menetapkan planning final, silakan coba lagi');
    }
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Hapus planning milik user ini.
 */
const deletePlanning = async (planningId, userId) => {
  const planning = await Planning.findOneAndDelete({ _id: planningId, userId });
  if (!planning) {
    throw new ApiError(404, 'Planning tidak ditemukan');
  }
  return planning;
};

module.exports = {
  getAllPlannings,
  getPlanningById,
  createPlanning,
  updatePlanning,
  setAsFinal,
  deletePlanning,
};
