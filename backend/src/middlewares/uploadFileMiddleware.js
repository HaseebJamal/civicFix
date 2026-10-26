import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const uploadRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../public/uploads",
);
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadDirectory;

    if (file.fieldname === "profileImage") {
      uploadDirectory = path.join(uploadRoot, "profiles");
    } else if (file.fieldname === "coverImage") {
      uploadDirectory = path.join(uploadRoot, "covers");
    } else if (
      file.fieldname === "reportImage" ||
      file.fieldname === "image"
    ) {
      uploadDirectory = path.join(uploadRoot, "reports");
    } else {
      return cb(new Error("Invalid file field"));
    }

    fs.mkdirSync(uploadDirectory, {
      recursive: true,
    });

    cb(null, uploadDirectory);
  },

  filename: function (req, file, cb) {
    const extension = path.extname(file.originalname);

    const filename = `${req.user.id}-${Date.now()}${extension}`;

    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const uploadFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default uploadFile;

export const uploadFileMiddleware = uploadFile;