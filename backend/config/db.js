import mongoose from "mongoose";
import { syncSequences } from "../utils/sequence.js";
import { seedLoanProducts } from "../utils/seedProducts.js";
import { createSuperAdmin } from "../utils/createSuperAdmin.js";

mongoose.set("bufferCommands", false);

const cache = globalThis.__lmsCache || (globalThis.__lmsCache = { connection: null, ready: null });

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!cache.connection) {
    cache.connection = mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((error) => {
        cache.connection = null;
        throw error;
      });
  }
  return cache.connection;
};

export const prepareApp = async () => {
  await connectDB();
  if (!cache.ready) {
    cache.ready = (async () => {
      await syncSequences();
      await seedLoanProducts();
      await createSuperAdmin();
    })().catch((error) => {
      cache.ready = null;
      throw error;
    });
  }
  return cache.ready;
};
