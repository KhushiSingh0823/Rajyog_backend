import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getUserStats,
  getAllUserConversations,
  getAdminUserConversation,
  getChatStats,
} from "../controllers/admin.controller.js";

import {
  createAstrologer,
  getAllAstrologers,
  getAstrologerById,
  updateAstrologer,
  toggleBlockAstrologer,
  deleteAstrologer,
  getAstrologerStats,
} from "../controllers/astrologer.controller.js";

import adsVideoRoutes from "./adsVideoRoutes.js"; 
import horoscopeRoutes from "./horoscope.route.js";


import { adminOnly, adminOrAstrologerOnly } from "../middleware/auth.js";

const router = express.Router();

/* ========= SHARED ADMIN/ASTROLOGER ROUTES ========= */
// Route accessible by both admin and astrologer
router.get("/chat/conversation/:userId", adminOrAstrologerOnly, getAdminUserConversation);

// All other admin routes require admin authentication
router.use(adminOnly);

/* ========= USER MANAGEMENT ROUTES ========= */
router.get("/users", getAllUsers);
router.get("/users/stats", getUserStats);
router.get("/users/:id", getUserById);
router.put("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

/* ========= ADMIN CHAT ROUTES ========= */
router.get("/chat/conversations", getAllUserConversations);
router.get("/chat/stats", getChatStats);

/* ========= ASTROLOGER MANAGEMENT ========= */
router.post("/astrologers", createAstrologer);
router.get("/astrologers", getAllAstrologers);
router.get("/astrologers/stats", getAstrologerStats);
router.get("/astrologers/:id", getAstrologerById);
router.put("/astrologers/:id", updateAstrologer);
router.put("/astrologers/:id/block", toggleBlockAstrologer);
router.delete("/astrologers/:id", deleteAstrologer);

/* ========= ADS VIDEO MANAGEMENT (FROM HERE) ========= */
router.use("/ads-videos", adsVideoRoutes); //  Full AdsVideo system embedded
router.use("/horoscope", horoscopeRoutes); //  Admin-only horoscope management


export default router;
