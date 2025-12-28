import mongoose from "mongoose";

export const connectDB = async (mongoURL) => {
  try {
    if (!mongoURL) {
      throw new Error("MongoDB URL is missing from environment variables");
    }

    const conn = await mongoose.connect(mongoURL,{
      dbName: "AstoDB"
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};
