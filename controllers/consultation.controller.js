import ConsultationRequest from "../models/consultationRequest.model.js";
import User from "../models/user.model.js";
import { TryCatch } from "../middleware/error.js";
import ErrorHandler from "../utils/utility-class.js";

// Get all pending requests for astrologer (REST API fallback)
export const getPendingRequests = TryCatch(async (req, res, next) => {
  const astrologerId = req.user._id;

  // Verify user is an astrologer
  if (req.user.role !== "astrologer") {
    return next(new ErrorHandler("Only astrologers can access this", 403));
  }

  // Get all pending requests that haven't expired
  const requests = await ConsultationRequest.find({
    astrologer: astrologerId,
    status: "pending",
    expiresAt: { $gt: new Date() },
  })
    .populate("user", "name email role")
    .sort({ requestedAt: -1 })
    .limit(20);

  res.status(200).json({
    success: true,
    message: "Pending requests fetched successfully",
    data: {
      requests,
      count: requests.length,
    },
  });
});

// Get request history for astrologer
export const getRequestHistory = TryCatch(async (req, res, next) => {
  const astrologerId = req.user._id;

  // Verify user is an astrologer
  if (req.user.role !== "astrologer") {
    return next(new ErrorHandler("Only astrologers can access this", 403));
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Filter by status
  const status = req.query.status; // accepted, declined, expired
  const query = { astrologer: astrologerId };

  if (status && ["accepted", "declined", "expired", "completed"].includes(status)) {
    query.status = status;
  } else {
    // Show all non-pending requests
    query.status = { $in: ["accepted", "declined", "expired", "cancelled", "completed"] };
  }

  const totalRequests = await ConsultationRequest.countDocuments(query);

  const requests = await ConsultationRequest.find(query)
    .populate("user", "name email role")
    .sort({ requestedAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    message: "Request history fetched successfully",
    data: {
      requests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRequests / limit),
        totalRequests,
        requestsPerPage: limit,
      },
    },
  });
});

// Get user's consultation requests
export const getUserRequests = TryCatch(async (req, res, next) => {
  const userId = req.user._id;

  // Get user's pending and recent requests
  const requests = await ConsultationRequest.find({
    user: userId,
    $or: [
      { status: "pending" },
      { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Last 24 hours
    ],
  })
    .populate("astrologer", "name email role")
    .sort({ requestedAt: -1 })
    .limit(10);

  res.status(200).json({
    success: true,
    message: "Your requests fetched successfully",
    data: {
      requests,
      count: requests.length,
    },
  });
});

// Cancel a pending request (user only)
export const cancelRequest = TryCatch(async (req, res, next) => {
  const { requestId } = req.params;
  const userId = req.user._id;

  const request = await ConsultationRequest.findById(requestId);

  if (!request) {
    return next(new ErrorHandler("Request not found", 404));
  }

  // Check if user owns this request
  if (request.user.toString() !== userId.toString()) {
    return next(new ErrorHandler("You can only cancel your own requests", 403));
  }

  // Check if request is still pending
  if (request.status !== "pending") {
    return next(
      new ErrorHandler(
        `Cannot cancel ${request.status} request`,
        400
      )
    );
  }

  request.status = "cancelled";
  request.respondedAt = new Date();
  await request.save();

  res.status(200).json({
    success: true,
    message: "Request cancelled successfully",
  });
});

// Get consultation statistics for astrologer
export const getConsultationStats = TryCatch(async (req, res, next) => {
  const astrologerId = req.user._id;

  // Verify user is an astrologer
  if (req.user.role !== "astrologer") {
    return next(new ErrorHandler("Only astrologers can access this", 403));
  }

  // Get stats
  const totalRequests = await ConsultationRequest.countDocuments({
    astrologer: astrologerId,
  });

  const acceptedRequests = await ConsultationRequest.countDocuments({
    astrologer: astrologerId,
    status: "accepted",
  });

  const declinedRequests = await ConsultationRequest.countDocuments({
    astrologer: astrologerId,
    status: "declined",
  });

  const pendingRequests = await ConsultationRequest.countDocuments({
    astrologer: astrologerId,
    status: "pending",
    expiresAt: { $gt: new Date() },
  });

  // Today's requests
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayRequests = await ConsultationRequest.countDocuments({
    astrologer: astrologerId,
    requestedAt: { $gte: todayStart },
  });

  const todayAccepted = await ConsultationRequest.countDocuments({
    astrologer: astrologerId,
    status: "accepted",
    requestedAt: { $gte: todayStart },
  });

  // Calculate acceptance rate
  const acceptanceRate =
    totalRequests > 0
      ? ((acceptedRequests / totalRequests) * 100).toFixed(2)
      : 0;

  res.status(200).json({
    success: true,
    message: "Consultation stats fetched successfully",
    data: {
      totalRequests,
      acceptedRequests,
      declinedRequests,
      pendingRequests,
      todayRequests,
      todayAccepted,
      acceptanceRate: parseFloat(acceptanceRate),
    },
  });
});

// Expire old pending requests (Background job - can be called via cron or manually)
export const expireOldRequests = TryCatch(async (req, res, next) => {
  const result = await ConsultationRequest.updateMany(
    {
      status: "pending",
      expiresAt: { $lt: new Date() },
    },
    {
      status: "expired",
      respondedAt: new Date(),
    }
  );

  res.status(200).json({
    success: true,
    message: "Expired requests updated",
    data: {
      expiredCount: result.modifiedCount,
    },
  });
});

// Check consultation status with an astrologer
export const checkConsultationStatus = TryCatch(async (req, res, next) => {
  const { astrologerId } = req.params;
  const userId = req.user._id;

  // Validate astrologer exists
  const astrologer = await User.findById(astrologerId);
  if (!astrologer) {
    return next(new ErrorHandler("Astrologer not found", 404));
  }

  if (astrologer.role !== "astrologer") {
    return next(new ErrorHandler("User is not an astrologer", 400));
  }

  // Check for pending request
  const pendingRequest = await ConsultationRequest.findOne({
    user: userId,
    astrologer: astrologerId,
    status: "pending",
    expiresAt: { $gt: new Date() },
  });

  // Check for active (accepted) consultation
  const activeConsultation = await ConsultationRequest.findOne({
    user: userId,
    astrologer: astrologerId,
    status: "accepted",
  });

  res.status(200).json({
    success: true,
    message: "Consultation status fetched successfully",
    data: {
      canRequest: !pendingRequest && !activeConsultation,
      hasPending: !!pendingRequest,
      hasActive: !!activeConsultation,
      pendingRequest: pendingRequest || null,
      activeConsultation: activeConsultation || null,
    },
  });
});
