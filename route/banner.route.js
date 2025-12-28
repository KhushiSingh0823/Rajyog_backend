import express from "express";
import bannerController from "../controllers/banner.controller.js";
import { isAuthenticated, isAdmin } from "../middleware/auth.js";
import { uploadSingle } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public Routes (View banners)
router.get("/", bannerController.getAllBanners);
router.get("/:id", bannerController.getBannerById);

// Admin Protected Routes
router.post(
  "/",
  isAuthenticated,
  isAdmin,
  uploadSingle("banners"), // ← store images in /uploads/banners
  bannerController.createBanner
);

router.put(
  "/:id",
  isAuthenticated,
  isAdmin,
  uploadSingle("banners"), // ← store images in /uploads/banners
  bannerController.updateBanner
);

router.delete(
  "/:id",
  isAuthenticated,
  isAdmin,
  bannerController.deleteBanner
);

export default router;
