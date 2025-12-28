import express from "express";
import {
  register,
  login,
  logout,
  getProfile,
} from "../controllers/auth.controller.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// Protected routes (will need auth middleware in future)
// router.get("/profile", isAuthenticated, getProfile);

export default router;
