import AdsVideo from "../models/AdsVideo.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "7f71cd7eaaaca693f77405c989e0e27aea87337c7ebc059bc5b7818af717ef4657b37ef8b836b85fb96a99052bf3c80192561ebaaab2610d0a33bbb5628015bf";

// Helper to get token from headers or body
const getToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    return req.headers.authorization.split(" ")[1];
  }
  if (req.body.token) {
    return req.body.token;
  }
  return null;
};

// Helper to verify token
const verifyToken = (req, res) => {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: "Unauthorized: Token missing" });
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    res.status(401).json({ success: false, message: "Unauthorized: Token invalid" });
    return null;
  }
};

export const addAdsVideo = async (req, res) => {
  try {
    const decoded = verifyToken(req, res);
    if (!decoded) return;

    const { youtubeLink, title, existingImageUrl } = req.body;

    if (!youtubeLink || !title) {
      return res.status(400).json({
        success: false,
        message: "YouTube link and Title are required",
      });
    }

    // ✅ Updated: support existingImageUrl
    const coverImage = req.file
      ? `uploads/videos/${req.file.filename}`
      : existingImageUrl || null;

    if (!coverImage) {
      return res.status(400).json({
        success: false,
        message: "Cover image is required",
      });
    }

    const video = await AdsVideo.create({
      youtubeLink,
      coverImage,
      title,
      status: true,
    });

    res.status(201).json({
      success: true,
      message: "Ads Video added successfully",
      video,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAdsVideos = async (req, res) => {
  try {
    const decoded = verifyToken(req, res);
    if (!decoded) return;

    const videos = await AdsVideo.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      videos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const editAdsVideo = async (req, res) => {
  try {
    const decoded = verifyToken(req, res);
    if (!decoded) return;

    const { id } = req.params;
    const { youtubeLink, title } = req.body;

    const video = await AdsVideo.findById(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    video.youtubeLink = youtubeLink || video.youtubeLink;
    video.title = title || video.title;

    if (req.file) {
      video.coverImage = `uploads/videos/${req.file.filename}`;
    }

    await video.save();

    res.status(200).json({
      success: true,
      message: "Video updated successfully",
      video,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAdsVideo = async (req, res) => {
  try {
    const decoded = verifyToken(req, res);
    if (!decoded) return;

    const { id } = req.params;

    const video = await AdsVideo.findById(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    await video.deleteOne();

    res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const toggleStatus = async (req, res) => {
  try {
    const decoded = verifyToken(req, res);
    if (!decoded) return;

    const { id } = req.params;

    const video = await AdsVideo.findById(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    video.status = !video.status;
    await video.save();

    res.status(200).json({
      success: true,
      message: "Status updated",
      status: video.status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
