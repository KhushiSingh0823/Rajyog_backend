import mongoose from "mongoose";

const interactionSchema = new mongoose.Schema(
  {
    astrologer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Astrologer reference is required"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    sessionStart: {
      type: Date,
      default: Date.now,
    },
    sessionEnd: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // Duration in seconds
      default: 0,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "completed", "idle"],
      default: "active",
    },
    // Additional metadata
    userSatisfaction: {
      type: Number, // Rating from 1-5
      default: null,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
interactionSchema.index({ astrologer: 1, createdAt: -1 });
interactionSchema.index({ user: 1, createdAt: -1 });
interactionSchema.index({ astrologer: 1, user: 1 });
interactionSchema.index({ status: 1 });
interactionSchema.index({ sessionStart: 1, sessionEnd: 1 });

// Virtual for calculating duration if session is active
interactionSchema.virtual("currentDuration").get(function () {
  if (this.status === "active" && this.sessionStart) {
    const now = new Date();
    const start = new Date(this.sessionStart);
    return Math.floor((now - start) / 1000); // Return duration in seconds
  }
  return this.duration;
});

// Method to end session
interactionSchema.methods.endSession = function () {
  if (this.status === "active") {
    this.sessionEnd = new Date();
    this.duration = Math.floor(
      (this.sessionEnd - this.sessionStart) / 1000
    );
    this.status = "completed";
  }
};

// Method to update message count
interactionSchema.methods.incrementMessageCount = function () {
  this.messageCount += 1;
  this.lastMessageAt = new Date();
};

const Interaction = mongoose.model("Interaction", interactionSchema);

export default Interaction;
