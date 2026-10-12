import dotenv from "dotenv";

dotenv.config();

const { default: app } = await import("./app.js");
const { prepareApp } = await import("./config/db.js");
const { startScheduler } = await import("./services/schedulerService.js");

const PORT = process.env.PORT || 5000;

try {
  await prepareApp();
} catch (error) {
  console.error("Database connection error:", error.message);
  process.exit(1);
}

startScheduler();
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
