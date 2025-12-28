import Astrologer from "../models/astrologer.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { TryCatch } from "../middleware/error.js";
import ErrorHandler from "../utils/utility-class.js";
import mongoose from "mongoose";

// Create a new astrologer (Admin only)
export const createAstrologer = TryCatch(async (req, res, next) => {
  const { userId, name, address } = req.body;

  // Validate required fields
  if (!userId || !name) {
    return next(new ErrorHandler("User ID and name are required", 400));
  }

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Check if user is already an astrologer
  const existingAstrologer = await Astrologer.findOne({ user: userId });
  if (existingAstrologer) {
    return next(new ErrorHandler("User is already registered as an astrologer", 409));
  }

  // Update user role to astrologer
  user.role = "astrologer";
  await user.save();

  // Create astrologer profile
  const astrologer = await Astrologer.create({
    user: userId,
    name,
    address: address || {},
  });

  // Populate user details
  await astrologer.populate("user", "name email role");

  res.status(201).json({
    success: true,
    message: "Astrologer created successfully",
    data: astrologer,
  });
});

// Get all astrologers (Admin only)
export const getAllAstrologers = TryCatch(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Filter options
  const isBlocked = req.query.isBlocked;
  const search = req.query.search || "";

  // Build query
  const query = {};
  if (isBlocked !== undefined) {
    query.isBlocked = isBlocked === "true";
  }
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  const totalAstrologers = await Astrologer.countDocuments(query);

  const astrologers = await Astrologer.find(query)
    .populate("user", "name email role createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    message: "Astrologers fetched successfully",
    data: {
      astrologers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAstrologers / limit),
        totalAstrologers,
        astrologersPerPage: limit,
        hasNextPage: page * limit < totalAstrologers,
        hasPrevPage: page > 1,
      },
    },
  });
});

// Get single astrologer by ID (Admin only)
export const getAstrologerById = TryCatch(async (req, res, next) => {
  const { id } = req.params;

  const astrologer = await Astrologer.findById(id).populate(
    "user",
    "name email role createdAt"
  );

  if (!astrologer) {
    return next(new ErrorHandler("Astrologer not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Astrologer fetched successfully",
    data: astrologer,
  });
});

// Update astrologer details (Admin only)
export const updateAstrologer = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const { name, address } = req.body;

  const astrologer = await Astrologer.findById(id);

  if (!astrologer) {
    return next(new ErrorHandler("Astrologer not found", 404));
  }

  // Update fields
  if (name) astrologer.name = name;
  if (address) {
    astrologer.address = { ...astrologer.address, ...address };
  }

  await astrologer.save();

  await astrologer.populate("user", "name email role");

  res.status(200).json({
    success: true,
    message: "Astrologer updated successfully",
    data: astrologer,
  });
});

// Block/Unblock astrologer (Admin only)
export const toggleBlockAstrologer = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;

  const astrologer = await Astrologer.findById(id);

  if (!astrologer) {
    return next(new ErrorHandler("Astrologer not found", 404));
  }

  // Toggle block status
  astrologer.isBlocked = !astrologer.isBlocked;
  astrologer.blockedAt = astrologer.isBlocked ? new Date() : null;
  astrologer.blockedReason = astrologer.isBlocked ? reason || "" : "";

  await astrologer.save();

  await astrologer.populate("user", "name email role");

  res.status(200).json({
    success: true,
    message: `Astrologer ${astrologer.isBlocked ? "blocked" : "unblocked"} successfully`,
    data: astrologer,
  });
});

// Delete astrologer (Admin only)
export const deleteAstrologer = TryCatch(async (req, res, next) => {
  const { id } = req.params;

  const astrologer = await Astrologer.findById(id);

  if (!astrologer) {
    return next(new ErrorHandler("Astrologer not found", 404));
  }

  // Update user role back to regular user
  await User.findByIdAndUpdate(astrologer.user, { role: "user" });

  // Delete astrologer profile
  await astrologer.deleteOne();

  res.status(200).json({
    success: true,
    message: "Astrologer deleted successfully",
  });
});

// Get astrologer statistics (Admin only)
export const getAstrologerStats = TryCatch(async (req, res, next) => {
  const totalAstrologers = await Astrologer.countDocuments();
  const blockedAstrologers = await Astrologer.countDocuments({ isBlocked: true });
  const activeAstrologers = await Astrologer.countDocuments({ isBlocked: false });

  // Get astrologers registered in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentAstrologers = await Astrologer.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
  });

  res.status(200).json({
    success: true,
    message: "Astrologer statistics fetched successfully",
    stats: {
      totalAstrologers,
      activeAstrologers,
      blockedAstrologers,
      recentAstrologers,
    },
  });
});

// ============ PUBLIC & ASTROLOGER CHAT FUNCTIONS ============

// Get list of active astrologers (Public - for users to see and chat with)
export const getActiveAstrologers = TryCatch(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const search = req.query.search || "";

  // Build query - only active (non-blocked) astrologers
  const query = { isBlocked: false };
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  const totalAstrologers = await Astrologer.countDocuments(query);

  const astrologers = await Astrologer.find(query)
    .populate("user", "name email isAvailable")
    .select("name address createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    message: "Active astrologers fetched successfully",
    data: {
      astrologers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAstrologers / limit),
        totalAstrologers,
        astrologersPerPage: limit,
      },
    },
  });
});

// Get only ONLINE and AVAILABLE astrologers (for user chat section)
export const getOnlineAvailableAstrologers = TryCatch(async (req, res, next) => {
  const { getActiveUsers } = await import("../socket/socket.js");

  // Get all currently connected users (online via socket)
  const onlineUserIds = getActiveUsers();

  // Find astrologers who are:
  // 1. Not blocked
  // 2. User is available (isAvailable = true)
  // 3. User is online (in socket active users)
  const astrologers = await Astrologer.find({
    isBlocked: false
  })
    .populate({
      path: "user",
      select: "name email role isAvailable",
      match: {
        isAvailable: true, // Must have availability toggle ON
        _id: { $in: onlineUserIds } // Must be socket connected
      }
    })
    .select("name address createdAt");

  // Filter out astrologers whose user is null (didn't match criteria)
  const availableAstrologers = astrologers.filter(astro => astro.user !== null);

  res.status(200).json({
    success: true,
    message: "Online and available astrologers fetched successfully",
    data: {
      astrologers: availableAstrologers,
      count: availableAstrologers.length,
    },
  });
});

// Get astrologer's conversations with users (Astrologer only)
export const getAstrologerConversations = TryCatch(async (req, res, next) => {
  const astrologerId = req.user._id;

  // Verify user is an astrologer
  const astrologer = await Astrologer.findOne({ user: astrologerId });
  if (!astrologer) {
    return next(new ErrorHandler("Astrologer profile not found", 404));
  }

  // Get all users who have conversations with this astrologer
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [
          { sender: new mongoose.Types.ObjectId(astrologerId) },
          { receiver: new mongoose.Types.ObjectId(astrologerId) },
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
            { $eq: ["$sender", new mongoose.Types.ObjectId(astrologerId)] },
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
                  { $eq: ["$receiver", new mongoose.Types.ObjectId(astrologerId)] },
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
    message: "Conversations fetched successfully",
    data: {
      conversations: populatedConversations.map((conv) => ({
        user: conv._id,
        lastMessage: conv.lastMessage,
        lastMessageTime: conv.lastMessageTime,
        unreadCount: conv.unreadCount,
        isSentByMe: conv.lastMessageSender.toString() === astrologerId.toString(),
      })),
      totalConversations: populatedConversations.length,
    },
  });
});

// Get conversation between astrologer and specific user (Astrologer only)
export const getAstrologerUserChat = TryCatch(async (req, res, next) => {
  const { userId } = req.params;
  const astrologerId = req.user._id;

  // Verify user is an astrologer
  const astrologer = await Astrologer.findOne({ user: astrologerId });
  if (!astrologer) {
    return next(new ErrorHandler("Astrologer profile not found", 404));
  }

  // Validate user exists
  const user = await User.findById(userId).select("name email role");
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  // Get messages between astrologer and user
  const messages = await Message.find({
    $or: [
      { sender: astrologerId, receiver: userId },
      { sender: userId, receiver: astrologerId },
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
      { sender: astrologerId, receiver: userId },
      { sender: userId, receiver: astrologerId },
    ],
  });

  // Get unread message count from user to astrologer
  const unreadCount = await Message.countDocuments({
    sender: userId,
    receiver: astrologerId,
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

// Toggle astrologer availability status (for astrologer's own availability)
export const toggleAvailability = TryCatch(async (req, res, next) => {
  const astrologerId = req.user._id;

  // Verify user is an astrologer
  if (req.user.role !== "astrologer") {
    return next(new ErrorHandler("Only astrologers can toggle availability", 403));
  }

  const user = await User.findById(astrologerId);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Toggle availability
  user.isAvailable = !user.isAvailable;
  await user.save();

  // Broadcast availability change via socket if io is available
  const io = req.app.get("io");
  if (io) {
    io.emit("astrologer:availability", {
      astrologerId: user._id,
      isAvailable: user.isAvailable,
      name: user.name,
    });
  }

  res.status(200).json({
    success: true,
    message: `Availability set to ${user.isAvailable ? "available" : "unavailable"}`,
    data: {
      isAvailable: user.isAvailable,
    },
  });
});
