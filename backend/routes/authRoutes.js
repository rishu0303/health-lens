const express = require("express");

const {
  registerUser,
  loginUser,
  getProfile,
} = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");
const { authRateLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.post("/register", authRateLimiter, registerUser);

router.post("/login", authRateLimiter, loginUser);
router.get("/profile", protect, getProfile);

module.exports = router;
