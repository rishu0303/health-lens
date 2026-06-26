const multer = require("multer");
const path = require("path");

const maxUploadSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 10);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads"));
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9);

    cb(
      null,
      uniqueName + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    "application/pdf": [".pdf"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/jpg": [".jpg", ".jpeg"],
  };
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedTypes[file.mimetype]?.includes(extension)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only PDF, PNG, JPG files allowed"
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxUploadSizeMb * 1024 * 1024,
    files: 1,
  },
});

function uploadReportFile(req, res, next) {
  upload.single("report")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? `File is too large. Maximum allowed size is ${maxUploadSizeMb}MB.`
        : error.message;

      return res.status(400).json({ message });
    }

    return res.status(400).json({ message: error.message });
  });
}



module.exports = upload;
module.exports.uploadReportFile = uploadReportFile;
