import Horoscope from "../models/horoscope.model.js";
import { TryCatch } from "../middleware/error.js";
export const createHoroscope = async (req, res) => {
  try {
    const { type, sign, date, title, content } = req.body;

    if (!type || !sign || !date || !content) {
      return res.status(400).json({
        success: false,
        message: "type, sign, date, and content are required",
      });
    }

    const exists = await Horoscope.findOne({ type, sign, date });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Horoscope already exists for this type, sign, and date",
      });
    }

    const newEntry = await Horoscope.create({
      type,
      sign,
      date,
      title,
      content,
    });

    res.status(201).json({
      success: true,
      data: newEntry,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET ALL / FILTER
export const getHoroscopes = TryCatch(async (req, res, next) => {
  const { type, sign, date } = req.query;

  if (!type || !sign || !date) {
    return res.status(400).json({
      message: "type, sign, and date are required"
    });
  }

  let startDate, endDate;

  const inputDate = new Date(date);

  // DAILY
  if (type === "daily") {
    startDate = new Date(inputDate);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(inputDate);
    endDate.setHours(23, 59, 59, 999);
  }

  // WEEKLY
  else if (type === "weekly") {
    const day = inputDate.getDay(); // 0 = Sunday
    const diffToMonday = inputDate.getDate() - day + (day === 0 ? -6 : 1);

    startDate = new Date(inputDate.setDate(diffToMonday));
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  }

  // YEARLY
  else if (type === "yearly") {
    startDate = new Date(inputDate.getFullYear(), 0, 1); // Jan 1
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(inputDate.getFullYear(), 11, 31); // Dec 31
    endDate.setHours(23, 59, 59, 999);
  }

  else {
    return res.status(400).json({
      message: "Invalid type. Use daily, weekly, or yearly"
    });
  }

  const horoscopes = await Horoscope.find({
    type: type.toLowerCase(),
    sign: sign.toLowerCase(),
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 });

  res.json({
    success: true,
    count: horoscopes.length,
    data: horoscopes
  });

});


export const getHoroscopeById = TryCatch(async (req, res) => {
  const horoscope = await Horoscope.findById(req.params.id);

  if (!horoscope) {
    return res.status(404).json({
      success: false,
      message: "Horoscope not found"
    });
  }

  res.json({
    success: true,
    data: horoscope
  });
});

// UPDATE
export const updateHoroscope = async (req, res) => {
  try {
    const { type, sign, date, title, content } = req.body;

    const updated = await Horoscope.findByIdAndUpdate(
      req.params.id,
      { type, sign, date, title, content },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Horoscope not found",
      });
    }

    res.json({ success: true, updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE
export const deleteHoroscope = async (req, res) => {
  try {
    const deleted = await Horoscope.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Horoscope not found",
      });
    }

    res.json({
      success: true,
      message: "Horoscope deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
