import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { TryCatch } from "../middleware/error.js";
import ErrorHandler from "../utils/utility-class.js";
import mongoose from "mongoose";

// Send a message
export const sendMessage = TryCatch(async (req, res, next) => {
  const { receiverId, message } = req.body;
  const senderId = req.user._id;

  // Validate input
  if (!receiverId || !message) {
    return next(new ErrorHandler("Receiver ID and message are required", 400));
  }

  if (!message.trim()) {
    return next(new ErrorHandler("Message cannot be empty", 400));
  }

  // Check if receiver exists
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    return next(new ErrorHandler("Receiver not found", 404));
  }

  // Prevent sending message to self
  if (senderId.toString() === receiverId) {
    return next(new ErrorHandler("Cannot send message to yourself", 400));
  }

  // Create message
  const newMessage = await Message.create({
    sender: senderId,
    receiver: receiverId,
    message: message.trim(),
  });

  // Populate sender and receiver details
  await newMessage.populate("sender", "name email role");
  await newMessage.populate("receiver", "name email role");

  res.status(201).json({
    success: true,
    message: "Message sent successfully",
    data: newMessage,
  });
});

// Get conversation between two users
export const getConversation = TryCatch(async (req, res, next) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  // Validate user exists
  const otherUser = await User.findById(userId).select("name email role");
  if (!otherUser) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  // Get messages between current user and specified user
  const messages = await Message.find({
    $or: [
      { sender: currentUserId, receiver: userId },
      { sender: userId, receiver: currentUserId },
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
      { sender: currentUserId, receiver: userId },
      { sender: userId, receiver: currentUserId },
    ],
  });

  // Get unread message count for current user
  const unreadCount = await Message.countDocuments({
    sender: userId,
    receiver: currentUserId,
    isRead: false,
  });

  res.status(200).json({
    success: true,
    message: "Conversation fetched successfully",
    data: {
      messages,
      otherUser,
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

// Get all conversations (list of users current user has chatted with)
export const getAllConversations = TryCatch(async (req, res, next) => {
  const currentUserId = req.user._id;

  // Get unique users who have exchanged messages with current user
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [
          { sender: new mongoose.Types.ObjectId(currentUserId) },
          { receiver: new mongoose.Types.ObjectId(currentUserId) },
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
            { $eq: ["$sender", new mongoose.Types.ObjectId(currentUserId)] },
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
                  { $eq: ["$receiver", new mongoose.Types.ObjectId(currentUserId)] },
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
    select: "name email role",
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
        isSentByMe: conv.lastMessageSender.toString() === currentUserId.toString(),
      })),
      totalConversations: populatedConversations.length,
    },
  });
});

// Mark messages as read
export const markAsRead = TryCatch(async (req, res, next) => {
  const { senderId } = req.params;
  const receiverId = req.user._id;

  // Validate sender exists
  const sender = await User.findById(senderId);
  if (!sender) {
    return next(new ErrorHandler("Sender not found", 404));
  }

  // Mark all unread messages from sender to current user as read
  const result = await Message.updateMany(
    {
      sender: senderId,
      receiver: receiverId,
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} message(s) marked as read`,
    data: {
      messagesMarked: result.modifiedCount,
    },
  });
});

// Delete a message (only sender can delete)
export const deleteMessage = TryCatch(async (req, res, next) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);

  if (!message) {
    return next(new ErrorHandler("Message not found", 404));
  }

  // Check if user is the sender
  if (message.sender.toString() !== userId.toString()) {
    return next(
      new ErrorHandler("You can only delete your own messages", 403)
    );
  }

  await message.deleteOne();

  res.status(200).json({
    success: true,
    message: "Message deleted successfully",
  });
});

// Get unread message count
export const getUnreadCount = TryCatch(async (req, res, next) => {
  const userId = req.user._id;

  const unreadCount = await Message.countDocuments({
    receiver: userId,
    isRead: false,
  });

  res.status(200).json({
    success: true,
    message: "Unread count fetched successfully",
    data: {
      unreadCount,
    },
  });
});

// Get all admins (for users to chat with)
export const getAllAdmins = TryCatch(async (req, res, next) => {
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Optional search by name or email
  const search = req.query.search || "";

  // Build query - only users with admin role
  const query = { role: "admin" };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  // Get total count
  const totalAdmins = await User.countDocuments(query);

  // Fetch admins (exclude password)
  const admins = await User.find(query)
    .select("name email role createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    message: "Admins fetched successfully",
    data: {
      admins,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAdmins / limit),
        totalAdmins,
        adminsPerPage: limit,
        hasNextPage: page * limit < totalAdmins,
        hasPrevPage: page > 1,
      },
    },
  });
});
