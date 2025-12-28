import express from "express";
import {
  getPendingRequests,
  getRequestHistory,
  getUserRequests,
  cancelRequest,
  getConsultationStats,
  expireOldRequests,
  checkConsultationStatus,
} from "../controllers/consultation.controller.js";
import { isAuthenticated, astrologerOnly } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// User routes
router.get("/my-requests", getUserRequests);
router.get("/status/:astrologerId", checkConsultationStatus);
router.post("/cancel/:requestId", cancelRequest);

// Astrologer routes
router.get("/pending", astrologerOnly, getPendingRequests);
router.get("/history", astrologerOnly, getRequestHistory);
router.get("/stats", astrologerOnly, getConsultationStats);

// Admin/utility route
router.post("/expire-old", expireOldRequests);

export default router;
