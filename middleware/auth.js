import jwt from "jsonwebtoken";
import { TryCatch } from "./error.js";
import ErrorHandler from "../utils/utility-class.js";
import User from "../models/user.model.js";

// Middleware to verify JWT token and authenticate user
export const isAuthenticated = TryCatch(async (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }

  try {
    // Verify token
    const jwtSecret = process.env.JWT_SECRET || "defaultsecret";
    const decoded = jwt.verify(token, jwtSecret);

    // Find user by ID from token
    const user = await User.findById(decoded._id);

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    return next(new ErrorHandler("Invalid or expired token", 401));
  }
});

// Middleware to check if user is admin
export const isAdmin = TryCatch(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  if (req.user.role !== "admin") {
    return next(
      new ErrorHandler("Access denied. Admin privileges required", 403)
    );
  }

  next();
});

// Combined middleware for admin-only routes
export const adminOnly = [isAuthenticated, isAdmin];

// Middleware to check if user is astrologer
export const isAstrologer = TryCatch(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  if (req.user.role !== "astrologer") {
    return next(
      new ErrorHandler("Access denied. Astrologer privileges required", 403)
    );
  }

  next();
});

// Combined middleware for astrologer-only routes
export const astrologerOnly = [isAuthenticated, isAstrologer];

// Middleware to check if user is admin or astrologer
export const isAdminOrAstrologer = TryCatch(async (req, _res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  if (req.user.role !== "admin" && req.user.role !== "astrologer") {
    return next(
      new ErrorHandler("Access denied. Admin or Astrologer privileges required", 403)
    );
  }

  next();
});

// Combined middleware for admin or astrologer routes
export const adminOrAstrologerOnly = [isAuthenticated, isAdminOrAstrologer];
