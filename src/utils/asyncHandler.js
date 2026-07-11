/**
 * Bungkus controller async supaya error otomatis dilempar ke next()
 * tanpa perlu tulis try-catch di setiap controller.
 *
 * Pemakaian:
 *   router.get('/users', asyncHandler(userController.getUsers));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
