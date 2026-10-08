import apiErrorHandler from "../utils/apiErrorHandler.js";
import asyncHandler from "../utils/asyncHandler.js";

export const userRoleMiddleware = (allowedRoles) => {
  return asyncHandler(async (req, res, next) => {
    //  console.log("USER ROLE:", req.user?.role);
    // console.log("ALLOWED ROLES:", allowedRoles);
    // console.log("USER ID:", req.user?.id);
    if (!req.user) {
      throw new apiErrorHandler(
        401,
        "Unauthorized request"
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new apiErrorHandler(
        403,
        "You do not have permission to perform this action"
      );
    }

    next();
  });
};