import express from "express";
import {
  createHoroscope,
  getHoroscopes,
  getHoroscopeById,
  updateHoroscope,
  deleteHoroscope,
} from "../controllers/horoscope.controller.js";

const router = express.Router();


router.get("/", getHoroscopes);
router.get("/:id", getHoroscopeById);


router.post("/", createHoroscope);
router.put("/:id", updateHoroscope);
router.delete("/:id", deleteHoroscope);

export default router;
