import mongoose from "mongoose";

const adsVideoSchema = new mongoose.Schema(
  {
    youtubeLink: { type: String, required: true },
    coverImage: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: Boolean, default: true },// enable/disable
     token: { type: String }, 
  },
  { timestamps: true }
);

export default mongoose.model("AdsVideo", adsVideoSchema);
