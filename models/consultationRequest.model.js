import mongoose from "mongoose";

const consultationRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    astrologer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Astrologer reference is required"],
    },
    message: {
      type: String,
      default: "",
      maxlength: [500, "Message cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired", "cancelled", "completed"],
      default: "pending",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
consultationRequestSchema.index({ astrologer: 1, status: 1 });
consultationRequestSchema.index({ user: 1, status: 1 });
consultationRequestSchema.index({ expiresAt: 1 });
consultationRequestSchema.index({ status: 1, createdAt: -1 });

// Set expiration time before saving (5 minutes from request time)
consultationRequestSchema.pre("save", function (next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  }
  next();
});

const ConsultationRequest = mongoose.model(
  "ConsultationRequest",
  consultationRequestSchema
);

export default ConsultationRequest;
