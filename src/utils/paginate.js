/**
 * Helper pagination generik dengan dukungan filter & search.
 * @param {Model} model - Mongoose model
 * @param {Object} baseFilter - filter wajib (misal { deletedAt: null })
 * @param {Object} query - req.query dari client
 * @param {Object} options - konfigurasi tambahan
 */
const paginate = async (model, baseFilter = {}, query = {}, options = {}) => {
  const {
    searchableFields = [], // field yang bisa di-search, misal ['name', 'email']
    defaultSort = '-createdAt',
    defaultLimit = 10,
    maxLimit = 100,
  } = options;

  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || defaultLimit, maxLimit);
  const skip = (page - 1) * limit;
  const sort = query.sort || defaultSort;

  const filter = { ...baseFilter };

  // Search sederhana pakai regex di beberapa field sekaligus
  if (query.search && searchableFields.length > 0) {
    filter.$or = searchableFields.map((field) => ({
      [field]: { $regex: query.search, $options: 'i' },
    }));
  }

  const [data, total] = await Promise.all([
    model.find(filter).sort(sort).skip(skip).limit(limit),
    model.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

module.exports = paginate;

// How to use this paginate function in a controller:
// const paginate = require('../utils/paginate');
// const User = require('../models/user.model');

// const getUsers = asyncHandler(async (req, res) => {
//   const { data, meta } = await paginate(
//     User,
//     {},                          // baseFilter, misal { role: 'user' }
//     req.query,                   // ?page=2&limit=20&search=budi
//     { searchableFields: ['name', 'email'] }
//   );

//   return new ApiResponse(200, data, 'Berhasil mengambil data user', meta).send(res);
// });
