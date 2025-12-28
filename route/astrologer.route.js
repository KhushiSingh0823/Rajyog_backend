import express from "express";
import {
  getActiveAstrologers,
  getOnlineAvailableAstrologers,
  getAstrologerConversations,
  getAstrologerUserChat,
  toggleAvailability,
} from "../controllers/astrologer.controller.js";
import {  sendMessage,
  getConversation,
  getAllConversations,
  markAsRead,
  deleteMessage,
  getUnreadCount,
} from "../controllers/chat.controller.js";
import { astrologerLogin } from "../controllers/auth.controller.js";
import { astrologerOnly, isAuthenticated } from "../middleware/auth.js";

const router = express.Router();

// Astrologer login route (no authentication required)
router.post("/login", astrologerLogin);

// Public route - Get list of active astrologers (for users to see and chat with)
router.get("/list", isAuthenticated, getActiveAstrologers);

// Public route - Get only ONLINE and AVAILABLE astrologers (for user chat section)
router.get("/online-available", isAuthenticated, getOnlineAvailableAstrologers);

// Astrologer-only routes - for astrologers to manage their chats
router.use(astrologerOnly);

// Toggle availability status (astrologer sets themselves as available/unavailable)
router.put("/toggle-availability", toggleAvailability);

// Astrologer chat management
router.get("/conversations", getAstrologerConversations);
router.get("/chat/:userId", getAstrologerUserChat);

// Message operations (reuse from chat controller)
router.post("/send", sendMessage);
router.put("/read/:senderId", markAsRead);
router.delete("/message/:messageId", deleteMessage);
router.get("/unread-count", getUnreadCount);

export default router;
