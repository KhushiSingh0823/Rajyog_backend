import express from "express";
import {
  createBlog,
  getAllBlogs,
  getBlog,
  updateBlog,
  deleteBlog,
  toggleBlogStatus,
  likeBlog,
  dislikeBlog,
  addComment,
  deleteComment,
  getComments,
} from "../controllers/blog.controller.js";

import { uploadMiddleware } from "../middleware/uploadMiddleware.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = express.Router();
const upload = uploadMiddleware("blogs");

// Create Blog
router.post("/", upload.single("image"), createBlog);

// Update Blog
router.put("/:id", upload.single("image"), updateBlog);

// Toggle Blog Status (enable/disable)
router.patch("/:id/status", toggleBlogStatus);

// Get Blogs
router.get("/", getAllBlogs);
router.get("/:id", getBlog);

// Delete Blog
router.delete("/:id", deleteBlog);

// =====================================================
//              LIKE / DISLIKE / COMMENTS
// =====================================================

// LIKE
router.post("/:id/like", isAuthenticated, likeBlog);

// DISLIKE
router.post("/:id/dislike", isAuthenticated, dislikeBlog);

// ADD COMMENT
router.post("/:id/comment", isAuthenticated, addComment);

// DELETE COMMENT
router.delete("/:id/comment/:commentId", isAuthenticated, deleteComment);

// GET COMMENTS
router.get("/:id/comments", getComments);

export default router;
