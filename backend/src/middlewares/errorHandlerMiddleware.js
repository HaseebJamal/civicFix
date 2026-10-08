import apiErrorHandler from "../utils/apiErrorHandler.js";

const errorMiddleware = (err, req, res, next) => {
  console.error("ERROR:", err);

  let error = err;

  // PostgreSQL errors
  if (err.code === "23505") {
    error = new apiErrorHandler(
      409,
      "A record with this value already exists."
    );
  }

  // PostgreSQL CHECK constraint violation
  else if (err.code === "23514") {
    error = new apiErrorHandler(
      400,
      "Invalid value provided."
    );
  }

  // PostgreSQL foreign key violation
  else if (err.code === "23503") {
    error = new apiErrorHandler(
      400,
      "Related record does not exist or cannot be deleted."
    );
  }

  // PostgreSQL NOT NULL violation
  else if (err.code === "23502") {
    error = new apiErrorHandler(
      400,
      "Required field is missing."
    );
  }

  // JSON parsing error
  else if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    error = new apiErrorHandler(
      400,
      "Invalid JSON payload."
    );
  }

  // Unknown error
  if (!(error instanceof apiErrorHandler)) {
    error = new apiErrorHandler(
      error.statusCode || error.status || 500,
      error.message || "Internal Server Error"
    );
  }

  return res.status(error.statusCode).json({
    success: false,
    statusCode: error.statusCode,
    message: error.message,
  });
};

export default errorMiddleware;