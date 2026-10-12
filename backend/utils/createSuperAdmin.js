import User from "../models/User.js";
import bcrypt from "bcryptjs";

export const createSuperAdmin = async () => {
  try {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const name = process.env.SUPER_ADMIN_NAME;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !name || !password) {
      console.warn("Super admin env vars not set, skipping creation.");
      return;
    }

    const exists = await User.findOne({ email });
    if (exists) return;

    const hashed = await bcrypt.hash(password, 12);
    await User.create({
      name,
      email,
      password: hashed,
      role: "admin",
      isActive: true,
      loginAttempts: 0,
      isLocked: false
    });

    console.log(`Super admin created: ${email}`);
  } catch (err) {
    console.error("Super admin creation failed:", err.message);
  }
};
