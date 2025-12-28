import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * -----------------------------------------
 *  IMAGE UPLOAD (Your Original Code)
 * -----------------------------------------
 */

export const uploadMiddleware = (folderName) => {
  // Create folder if not exists
  const dir = `uploads/${folderName}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Storage config
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueName =
        Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname);

      cb(null, uniqueName);
    },
  });

  // File type filter (only images)
  const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, WEBP images are allowed!"));
    }
  };

  return multer({ storage, fileFilter });
};

// For single image upload
export const uploadSingle = (folderName) =>
  uploadMiddleware(folderName).single("image");



/**
 * -----------------------------------------
 *  VIDEO UPLOAD (Your New Code — Added)
 * -----------------------------------------
 */

const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/videos";

    // Auto-create videos folder
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },

  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    );
  },
});

// Export video upload handler
export const uploadVideo = multer({ storage: videoStorage }).single("video");