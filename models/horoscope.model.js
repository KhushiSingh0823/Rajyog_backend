import mongoose from "mongoose";

const HoroscopeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["daily", "weekly", "yearly"],
    required: true,
    lowercase: true,
  },
  sign: {
    type: String,
    required: true,
    lowercase: true,
  },
  date: {
    type: Date,
    required: true,
  },
  title: { type: String },
  content: { type: String, required: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Prevent duplicate entries for same type+sign+date
HoroscopeSchema.index({ type: 1, sign: 1, date: 1 }, { unique: true });

HoroscopeSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Horoscope", HoroscopeSchema);
