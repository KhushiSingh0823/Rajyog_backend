import Banner from "../models/banner.model.js";

// Get all banners
export const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });

    // Return banners with full image URLs
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const bannersWithUrl = banners.map(b => ({
      ...b._doc,
      image: `${baseUrl}/uploads/banners/${b.image}`
    }));

    res.status(200).json(bannersWithUrl);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Get single banner
export const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const bannerWithUrl = {
      ...banner._doc,
      image: `${baseUrl}/uploads/banners/${banner.image}`
    };

    res.status(200).json(bannerWithUrl);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Create banner
export const createBanner = async (req, res) => {
  try {
    const body = req.body || {};
    const { title, category, createdAt, expiryDate, status } = body;

    if (!title || !category || !createdAt || !expiryDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Banner image is required" });
    }

    const banner = new Banner({
      title,
      category,
      image: req.file.filename,
      createdAt,
      expiryDate,
      status: status || "Enabled",
    });

    await banner.save();

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const bannerWithUrl = {
      ...banner._doc,
      image: `${baseUrl}/uploads/banners/${banner.image}`
    };

    res.status(201).json(bannerWithUrl);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Update banner
export const updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    const body = req.body || {};
    const { title, category, createdAt, expiryDate, status } = body;

    if (req.file) banner.image = req.file.filename;
    if (title) banner.title = title;
    if (category) banner.category = category;
    if (createdAt) banner.createdAt = createdAt;
    if (expiryDate) banner.expiryDate = expiryDate;
    if (status) banner.status = status;

    await banner.save();

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const updatedBanner = {
      ...banner._doc,
      image: `${baseUrl}/uploads/banners/${banner.image}`
    };

    res.status(200).json(updatedBanner);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Delete banner
export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });
    res.status(200).json({ message: "Banner deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Default export
export default {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};
