import express from "express";
import multer from "multer";
import {
  addAdsVideo,
  getAdsVideos,
  editAdsVideo,
  deleteAdsVideo,
  toggleStatus,
} from "../controllers/adsVideoController.js";

const router = express.Router();

// Multer setup for cover image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/videos"); // make sure this folder exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Routes

// GET all videos
router.get("/", getAdsVideos);

// POST add new video (with cover image)
router.post("/add", upload.single("coverImage"), addAdsVideo);

// PUT edit video by ID (optional cover image update)
router.put("/edit/:id", upload.single("coverImage"), editAdsVideo);

// DELETE video by ID
router.delete("/delete/:id", deleteAdsVideo);

// PUT toggle status of video by ID
router.put("/toggle/:id", toggleStatus);

export default router;
