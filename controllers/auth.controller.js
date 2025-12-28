import User from "../models/user.model.js";
import { TryCatch } from "../middleware/error.js";
import ErrorHandler from "../utils/utility-class.js";

// Register a new user
export const register = TryCatch(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return next(new ErrorHandler("Please provide all required fields", 400));
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new ErrorHandler("Please provide a valid email address", 400));
  }

  // Validate password length
  if (password.length < 6) {
    return next(new ErrorHandler("Password must be at least 6 characters long", 400));
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ErrorHandler("User already exists with this email", 409));
  }

  // Create new user (password will be hashed automatically by pre-save hook)
  const user = await User.create({
    name,
    email,
    password,
    role: role || "user", // Default to "user" if not provided
  });

  // Generate JWT token
  const token = user.generateToken();

  // Remove password from response
  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    user: userResponse,
    token,
  });
});

// Login user
export const login = TryCatch(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    return next(new ErrorHandler("Please provide email and password", 400));
  }

  // Find user by email and include password field
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // Compare password
  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // Generate JWT token
  const token = user.generateToken();

  // Remove password from response
  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  res.status(200).json({
    success: true,
    message: "Login successful",
    user: userResponse,
    token,
  });
});

// Get current user profile (requires authentication)
export const getProfile = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// Logout user (optional - mainly for clearing cookies if you use them)
export const logout = TryCatch(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Login specifically for astrologers only
export const astrologerLogin = TryCatch(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    return next(new ErrorHandler("Please provide email and password", 400));
  }

  // Find user by email and include password field
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHandler("Astrologer doesn't exist", 401));
  }

  // Check if user role is astrologer
  if (user.role !== "astrologer") {
    return next(new ErrorHandler("Astrologer doesn't exist", 401));
  }

  // Compare password
  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // Generate JWT token
  const token = user.generateToken();

  // Remove password from response
  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  res.status(200).json({
    success: true,
    message: "Astrologer login successful",
    user: userResponse,
    token,
  });
});
