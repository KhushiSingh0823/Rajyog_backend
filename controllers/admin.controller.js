import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { TryCatch } from "../middleware/error.js";
import ErrorHandler from "../utils/utility-class.js";
import mongoose from "mongoose";

// Get all users (Admin only)
export const getAllUsers = TryCatch(async (req, res, next) => {
  console.log(req.user,"user")
  // Extract query parameters for pagination and filtering
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Optional search by name or email
  const search = req.query.search || "";

  // Build search query
  const searchQuery = search
    ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  // Get total count for pagination
  const totalUsers = await User.countDocuments(searchQuery);

  // Fetch users (excluding password field)
  const users = await User.find(searchQuery)
    .select("-password")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: {
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        usersPerPage: limit,
        hasNextPage: page * limit < totalUsers,
        hasPrevPage: page > 1,
      },
    },
  });
});

// Get single user by ID (Admin only)
export const getUserById = TryCatch(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id).select("-password");

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "User fetched successfully",
    user,
  });
});

// Update user role (Admin only)
export const updateUserRole = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;

  // Validate role
  if (!role || !["user", "admin", "astrologer"].includes(role)) {
    return next(new ErrorHandler("Invalid role. Must be 'user', 'admin', or 'astrologer'", 400));
  }

  const user = await User.findById(id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Prevent admin from demoting themselves
  if (user._id.toString() === req.user._id.toString() && role === "user") {
    return next(new ErrorHandler("You cannot demote yourself", 403));
  }

  user.role = role;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User role updated to ${role} successfully`,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// Delete user (Admin only)
export const deleteUser = TryCatch(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Prevent admin from deleting themselves
  if (user._id.toString() === req.user._id.toString()) {
    return next(new ErrorHandler("You cannot delete your own account", 403));
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

// Get user statistics (Admin only)
export const getUserStats = TryCatch(async (req, res, next) => {
  const totalUsers = await User.countDocuments();
  const adminUsers = await User.countDocuments({ role: "admin" });
  const regularUsers = await User.countDocuments({ role: "user" });

  // Get users registered in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentUsers = await User.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
  });

  res.status(200).json({
    success: true,
    message: "User statistics fetched successfully",
    stats: {
      totalUsers,
      adminUsers,
      regularUsers,
      recentUsers,
    },
  });
});

// ============ ADMIN CHAT FUNCTIONS ============

// Get all user conversations (admin view - see all users who have sent messages)
export const getAllUserConversations = TryCatch(async (req, res, next) => {
  const adminId = req.user._id;

  // Get all users who have conversations with admin
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [
          { sender: new mongoose.Types.ObjectId(adminId) },
          { receiver: new mongoose.Types.ObjectId(adminId) },
        ],
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$sender", new mongoose.Types.ObjectId(adminId)] },
            "$receiver",
            "$sender",
          ],
        },
        lastMessage: { $first: "$message" },
        lastMessageTime: { $first: "$createdAt" },
        lastMessageSender: { $first: "$sender" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$receiver", new mongoose.Types.ObjectId(adminId)] },
                  { $eq: ["$isRead", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $sort: { lastMessageTime: -1 },
    },
  ]);

  // Populate user details
  const populatedConversations = await User.populate(conversations, {
    path: "_id",
    select: "name email role createdAt",
  });

  res.status(200).json({
    success: true,
    message: "All user conversations fetched successfully",
    data: {
      conversations: populatedConversations.map((conv) => ({
        user: conv._id,
        lastMessage: conv.lastMessage,
        lastMessageTime: conv.lastMessageTime,
        unreadCount: conv.unreadCount,
        isSentByAdmin: conv.lastMessageSender.toString() === adminId.toString(),
      })),
      totalConversations: populatedConversations.length,
    },
  });
});

// Get conversation between admin and specific user
export const getAdminUserConversation = TryCatch(async (req, res, next) => {
  const { userId } = req.params;
  const adminId = req.user._id;

  // Validate user exists
  const user = await User.findById(userId).select("name email role");
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  // Get messages between admin and user
  const messages = await Message.find({
    $or: [
      { sender: adminId, receiver: userId },
      { sender: userId, receiver: adminId },
    ],
  })
    .populate("sender", "name email role")
    .populate("receiver", "name email role")
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit);

  // Get total message count
  const totalMessages = await Message.countDocuments({
    $or: [
      { sender: adminId, receiver: userId },
      { sender: userId, receiver: adminId },
    ],
  });

  // Get unread message count from user to admin
  const unreadCount = await Message.countDocuments({
    sender: userId,
    receiver: adminId,
    isRead: false,
  });

  res.status(200).json({
    success: true,
    message: "Conversation fetched successfully",
    data: {
      messages,
      user,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
        messagesPerPage: limit,
      },
      unreadCount,
    },
  });
});

// Get all chat statistics (admin view)
export const getChatStats = TryCatch(async (req, res, next) => {
  const totalMessages = await Message.countDocuments();
  const unreadMessages = await Message.countDocuments({ isRead: false });

  // Get unique users who have sent/received messages
  const uniqueUsers = await Message.distinct("sender");
  const usersWithChats = uniqueUsers.length;

  // Get messages from last 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const recentMessages = await Message.countDocuments({
    createdAt: { $gte: oneDayAgo },
  });

  res.status(200).json({
    success: true,
    message: "Chat statistics fetched successfully",
    stats: {
      totalMessages,
      unreadMessages,
      usersWithChats,
      recentMessages,
    },
  });
});
