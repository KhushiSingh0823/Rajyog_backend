import express from "express";
import {
  sendMessage,
  getConversation,
  getAllConversations,
  markAsRead,
  deleteMessage,
  getUnreadCount,
  getAllAdmins,
} from "../controllers/chat.controller.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = express.Router();

// All chat routes require authentication
router.use(isAuthenticated);

// Chat routes
router.post("/send", sendMessage);
router.get("/conversations", getAllConversations);
router.get("/conversation/:userId", getConversation);
router.put("/read/:senderId", markAsRead);
router.delete("/:messageId", deleteMessage);
router.get("/unread-count", getUnreadCount);
router.get("/admins", getAllAdmins);

export default router;
