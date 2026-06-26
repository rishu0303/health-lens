const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const { uploadReportFile } = require("../middleware/uploadMiddleware");
const { apiRateLimiter, uploadRateLimiter } = require("../middleware/rateLimitMiddleware");
const {
  uploadReport,
  getReports,
  getReportById,
  chatWithReport,
  getChatHistory,
  handleUserQuery,
  getKnowledgeBase,
  syncKnowledgeBase,
} = require("../controllers/reportController");

router.post("/query", apiRateLimiter, protect, handleUserQuery);
router.get("/knowledge-base/status", protect, getKnowledgeBase);
router.post("/knowledge-base/sync", apiRateLimiter, protect, syncKnowledgeBase);
router.post("/upload", uploadRateLimiter, protect, uploadReportFile, uploadReport);
router.get("/", protect, getReports);
router.get("/:id", protect, getReportById);
router.post("/:id/chat", apiRateLimiter, protect, chatWithReport);
router.get("/:id/chat-history", protect, getChatHistory);

module.exports = router;
