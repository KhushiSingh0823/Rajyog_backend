import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import { errorMiddleware } from "./middleware/error.js";
import { connectDB } from "./utils/features.js";
import { initializeSocket } from "./socket/socket.js";

import authRoutes from "./route/auth.route.js";
import adminRoutes from "./route/admin.route.js";
import chatRoutes from "./route/chat.route.js";
import astrologerRoutes from "./route/astrologer.route.js";
import consultationRoutes from "./route/consultation.route.js";
import blogRoutes from "./route/blog.route.js";
import bannerRoute from "./route/banner.route.js"; 

dotenv.config();   // ⬅️ FIXED

console.log("MONGO_URI from .env:", process.env.MONGO_URI); // ⬅️ DEBUG

const port = process.env.PORT || 4000;
const mongoURL = process.env.MONGO_URI;

connectDB(mongoURL);

const app = express();

app.use(express.json());
app.use(morgan("dev"));

const corsOptions = {
  //origin: "http://localhost:5173", // frontend origin
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // include OPTIONS for preflight
  allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // must include Authorization
  
};
app.use(cors(corsOptions));



// Static folder for uploaded files
app.use("/uploads", express.static("uploads"));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/astrologer", astrologerRoutes);
app.use("/api/consultation", consultationRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/banners", bannerRoute);


app.get("/test",(req,res)=>{
    res.send("API is Working fine Astro")
})

app.use(errorMiddleware);

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Make io accessible to routes if needed
app.set("io", io);

server.listen(port, () => {
  console.log(`Express is working on ${port}`);
  console.log(`Socket.IO server is running`);
});