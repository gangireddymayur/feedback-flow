function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  const message =
    status >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";
  res.status(status).json({
    error: message,
    ...(err.issues ? { issues: err.issues } : {}),
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
