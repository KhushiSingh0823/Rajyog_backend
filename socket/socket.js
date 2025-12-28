import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import ConsultationRequest from "../models/consultationRequest.model.js";

// Store active users and their socket connections
const activeUsers = new Map(); // userId -> socketId
const socketToUser = new Map(); // socketId -> userId

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Authentication middleware for socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Verify JWT token
      const jwtSecret = process.env.JWT_SECRET || "defaultsecret";
      const decoded = jwt.verify(token, jwtSecret);

      // Find user
      const user = await User.findById(decoded._id);
      if (!user) {
        return next(new Error("User not found"));
      }

      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();

    // Store user connection
    activeUsers.set(userId, socket.id);
    socketToUser.set(socket.id, userId);

    console.log(
      `User connected: ${socket.user.name} (${userId}) - Socket: ${socket.id}`
    );

    // Notify user is online
    socket.broadcast.emit("user:online", {
      userId,
      name: socket.user.name,
      role: socket.user.role,
    });

    // Send active users list to the newly connected user
    const activeUsersList = Array.from(activeUsers.keys());
    socket.emit("users:active", activeUsersList);

    // Handle user joining a conversation room
    socket.on("conversation:join", (otherUserId) => {
      const roomId = getRoomId(userId, otherUserId);
      socket.join(roomId);
      console.log(`User ${userId} joined conversation room: ${roomId}`);
    });

    // Handle user leaving a conversation room
    socket.on("conversation:leave", (otherUserId) => {
      const roomId = getRoomId(userId, otherUserId);
      socket.leave(roomId);
      console.log(`User ${userId} left conversation room: ${roomId}`);
    });

    // Handle sending messages
    socket.on("message:send", async (data, callback) => {
      try {
        const { receiverId, message } = data;

        // Validate input
        if (!receiverId || !message || !message.trim()) {
          if (callback && typeof callback === 'function') {
            return callback({
              success: false,
              error: "Receiver ID and message are required",
            });
          }
          return;
        }

        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
          if (callback && typeof callback === 'function') {
            return callback({ success: false, error: "Receiver not found" });
          }
          return;
        }

        // Prevent sending message to self
        if (userId === receiverId) {
          if (callback && typeof callback === 'function') {
            return callback({
              success: false,
              error: "Cannot send message to yourself",
            });
          }
          return;
        }

        // Save message to database
        const newMessage = await Message.create({
          sender: userId,
          receiver: receiverId,
          message: message.trim(),
        });

        // Populate sender and receiver details
        await newMessage.populate("sender", "name email role");
        await newMessage.populate("receiver", "name email role");

        // Get room ID
        const roomId = getRoomId(userId, receiverId);

        // Emit message to the room (both sender and receiver if they're in the room)
        io.to(roomId).emit("message:receive", {
          _id: newMessage._id,
          sender: newMessage.sender,
          receiver: newMessage.receiver,
          message: newMessage.message,
          isRead: newMessage.isRead,
          createdAt: newMessage.createdAt,
        });

        // Also send notification to receiver if they're online but not in the room
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("message:notification", {
            _id: newMessage._id,
            sender: newMessage.sender,
            message: newMessage.message,
            createdAt: newMessage.createdAt,
          });
        }

        // Send success response to sender
        if (callback && typeof callback === 'function') {
          callback({
            success: true,
            data: newMessage,
          });
        }
      } catch (error) {
        console.error("Error sending message:", error);
        if (callback && typeof callback === 'function') {
          callback({
            success: false,
            error: error.message || "Failed to send message",
          });
        }
      }
    });

    // Handle typing indicator
    socket.on("typing:start", (receiverId) => {
      const receiverSocketId = activeUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing:user", {
          userId,
          name: socket.user.name,
          isTyping: true,
        });
      }
    });

    socket.on("typing:stop", (receiverId) => {
      const receiverSocketId = activeUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing:user", {
          userId,
          name: socket.user.name,
          isTyping: false,
        });
      }
    });

    // Handle marking messages as read
    socket.on("message:read", async (data, callback) => {
      try {
        const { senderId } = data;

        // Mark all unread messages from sender as read
        const result = await Message.updateMany(
          {
            sender: senderId,
            receiver: userId,
            isRead: false,
          },
          {
            isRead: true,
            readAt: new Date(),
          }
        );

        // Notify sender that messages were read
        const senderSocketId = activeUsers.get(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("message:read-receipt", {
            readerId: userId,
            readerName: socket.user.name,
            count: result.modifiedCount,
          });
        }

        if (callback && typeof callback === 'function') {
          callback({
            success: true,
            count: result.modifiedCount,
          });
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
        if (callback && typeof callback === 'function') {
          callback({
            success: false,
            error: error.message || "Failed to mark messages as read",
          });
        }
      }
    });

    // ============ CONSULTATION REQUEST HANDLERS ============

    // Handle consultation request from user to astrologer
    socket.on("consultation:request", async (data, callback) => {
      try {
        const { astrologerId, message } = data;

        // Validate astrologer exists
        const astrologer = await User.findById(astrologerId);
        if (!astrologer) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "Astrologer not found",
            });
          }
          return;
        }

        // Check if astrologer role is correct
        if (astrologer.role !== "astrologer") {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "User is not an astrologer",
            });
          }
          return;
        }

        // Check if user is requesting themselves
        if (userId === astrologerId) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "Cannot request consultation with yourself",
            });
          }
          return;
        }

        // Check if there's already a pending request
        const existingRequest = await ConsultationRequest.findOne({
          user: userId,
          astrologer: astrologerId,
          status: "pending",
          expiresAt: { $gt: new Date() },
        });

        if (existingRequest) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "You already have a pending request with this astrologer",
            });
          }
          return;
        }

        // Create consultation request
        const request = await ConsultationRequest.create({
          user: userId,
          astrologer: astrologerId,
          message: message || "",
          status: "pending",
          requestedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        });

        // Populate user details
        await request.populate("user", "name email role");

        // Check if astrologer is online
        const astrologerSocketId = activeUsers.get(astrologerId);

        if (astrologerSocketId) {
          // Send real-time notification to astrologer
          io.to(astrologerSocketId).emit("consultation:incoming", {
            requestId: request._id,
            user: {
              _id: request.user._id,
              name: request.user.name,
              email: request.user.email,
              role: request.user.role,
            },
            message: request.message,
            requestedAt: request.requestedAt,
            expiresAt: request.expiresAt,
          });

          console.log(
            `Consultation request sent from ${socket.user.name} to astrologer ${astrologer.name}`
          );
        }

        // Send success response to user
        if (callback && typeof callback === "function") {
          callback({
            success: true,
            requestId: request._id,
            message: "Consultation request sent successfully",
          });
        }
      } catch (error) {
        console.error("Error creating consultation request:", error);
        if (callback && typeof callback === "function") {
          callback({
            success: false,
            error: error.message || "Failed to send consultation request",
          });
        }
      }
    });

    // Handle astrologer accepting consultation request
    socket.on("consultation:accept", async (data, callback) => {
      try {
        const { requestId } = data;

        // Find the request
        const request = await ConsultationRequest.findById(requestId).populate(
          "user",
          "name email role"
        );

        if (!request) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "Request not found",
            });
          }
          return;
        }

        // Verify the current user is the astrologer for this request
        if (request.astrologer.toString() !== userId) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "You are not authorized to accept this request",
            });
          }
          return;
        }

        // Check if request is still pending
        if (request.status !== "pending") {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: `Request is already ${request.status}`,
            });
          }
          return;
        }

        // Check if request has expired
        if (new Date() > request.expiresAt) {
          request.status = "expired";
          request.respondedAt = new Date();
          await request.save();

          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "Request has expired",
            });
          }
          return;
        }

        // Update request status
        request.status = "accepted";
        request.respondedAt = new Date();
        await request.save();

        // Notify user that request was accepted
        const userSocketId = activeUsers.get(request.user._id.toString());
        if (userSocketId) {
          io.to(userSocketId).emit("consultation:accepted", {
            requestId: request._id,
            astrologerId: userId,
            astrologerName: socket.user.name,
            message: `${socket.user.name} accepted your consultation request`,
          });

          console.log(
            `Astrologer ${socket.user.name} accepted request from ${request.user.name}`
          );
        }

        // Send success response to astrologer
        if (callback && typeof callback === "function") {
          callback({
            success: true,
            user: {
              _id: request.user._id,
              name: request.user.name,
              email: request.user.email,
              role: request.user.role,
            },
            message: "Consultation request accepted",
          });
        }
      } catch (error) {
        console.error("Error accepting consultation request:", error);
        if (callback && typeof callback === "function") {
          callback({
            success: false,
            error: error.message || "Failed to accept consultation request",
          });
        }
      }
    });

    // Handle astrologer declining consultation request
    socket.on("consultation:decline", async (data, callback) => {
      try {
        const { requestId, reason } = data;

        // Find the request
        const request = await ConsultationRequest.findById(requestId).populate(
          "user",
          "name email role"
        );

        if (!request) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "Request not found",
            });
          }
          return;
        }

        // Verify the current user is the astrologer for this request
        if (request.astrologer.toString() !== userId) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "You are not authorized to decline this request",
            });
          }
          return;
        }

        // Check if request is still pending
        if (request.status !== "pending") {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: `Request is already ${request.status}`,
            });
          }
          return;
        }

        // Update request status
        request.status = "declined";
        request.respondedAt = new Date();
        await request.save();

        // Notify user that request was declined
        const userSocketId = activeUsers.get(request.user._id.toString());
        if (userSocketId) {
          io.to(userSocketId).emit("consultation:declined", {
            requestId: request._id,
            astrologerId: userId,
            astrologerName: socket.user.name,
            reason: reason || "Astrologer is currently unavailable",
            message: `${socket.user.name} declined your consultation request`,
          });

          console.log(
            `Astrologer ${socket.user.name} declined request from ${request.user.name}`
          );
        }

        // Send success response to astrologer
        if (callback && typeof callback === "function") {
          callback({
            success: true,
            message: "Consultation request declined",
          });
        }
      } catch (error) {
        console.error("Error declining consultation request:", error);
        if (callback && typeof callback === "function") {
          callback({
            success: false,
            error: error.message || "Failed to decline consultation request",
          });
        }
      }
    });

    // Handle user cancelling their own request
    socket.on("consultation:cancel", async (data, callback) => {
      try {
        const { requestId } = data;

        // Find the request
        const request = await ConsultationRequest.findById(requestId);

        if (!request) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "Request not found",
            });
          }
          return;
        }

        // Verify the current user is the requester
        if (request.user.toString() !== userId) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "You are not authorized to cancel this request",
            });
          }
          return;
        }

        // Check if request is still pending
        if (request.status !== "pending") {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: `Request is already ${request.status}`,
            });
          }
          return;
        }

        // Update request status
        request.status = "cancelled";
        request.respondedAt = new Date();
        await request.save();

        // Notify astrologer that request was cancelled
        const astrologerSocketId = activeUsers.get(
          request.astrologer.toString()
        );
        if (astrologerSocketId) {
          io.to(astrologerSocketId).emit("consultation:cancelled", {
            requestId: request._id,
            userId: userId,
            userName: socket.user.name,
            message: `${socket.user.name} cancelled their consultation request`,
          });
        }

        // Send success response to user
        if (callback && typeof callback === "function") {
          callback({
            success: true,
            message: "Consultation request cancelled",
          });
        }
      } catch (error) {
        console.error("Error cancelling consultation request:", error);
        if (callback && typeof callback === "function") {
          callback({
            success: false,
            error: error.message || "Failed to cancel consultation request",
          });
        }
      }
    });

    // Handle completing/ending consultation
    socket.on("consultation:complete", async (data, callback) => {
      try {
        const { requestId } = data;

        // Find the request
        const request = await ConsultationRequest.findById(requestId);

        if (!request) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "Request not found",
            });
          }
          return;
        }

        // Verify the current user is either the astrologer or the user for this request
        const isAstrologer = request.astrologer.toString() === userId;
        const isUser = request.user.toString() === userId;

        if (!isAstrologer && !isUser) {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: "You are not authorized to complete this consultation",
            });
          }
          return;
        }

        // Check if request is accepted
        if (request.status !== "accepted") {
          if (callback && typeof callback === "function") {
            return callback({
              success: false,
              error: `Cannot complete ${request.status} consultation`,
            });
          }
          return;
        }

        // Update request status
        request.status = "completed";
        request.completedAt = new Date();
        await request.save();

        // Notify the other party
        const otherUserId = isAstrologer
          ? request.user.toString()
          : request.astrologer.toString();
        const otherUserSocketId = activeUsers.get(otherUserId);

        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit("consultation:completed", {
            requestId: request._id,
            completedBy: userId,
            completedByName: socket.user.name,
            message: `${socket.user.name} has ended the consultation`,
          });
        }

        // Send success response
        if (callback && typeof callback === "function") {
          callback({
            success: true,
            message: "Consultation completed successfully",
          });
        }

        console.log(
          `Consultation ${requestId} completed by ${socket.user.name}`
        );
      } catch (error) {
        console.error("Error completing consultation:", error);
        if (callback && typeof callback === "function") {
          callback({
            success: false,
            error: error.message || "Failed to complete consultation",
          });
        }
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      activeUsers.delete(userId);
      socketToUser.delete(socket.id);

      console.log(
        `User disconnected: ${socket.user.name} (${userId}) - Socket: ${socket.id}`
      );

      // Notify other users
      socket.broadcast.emit("user:offline", {
        userId,
        name: socket.user.name,
      });
    });
  });

  return io;
};

// Helper function to generate consistent room IDs for conversations
function getRoomId(userId1, userId2) {
  // Sort IDs to ensure consistent room names regardless of who initiates
  return [userId1, userId2].sort().join("_");
}

// Export function to get active users (can be used by other modules)
export const getActiveUsers = () => {
  return Array.from(activeUsers.keys());
};

// Export function to check if user is online
export const isUserOnline = (userId) => {
  return activeUsers.has(userId);
};
