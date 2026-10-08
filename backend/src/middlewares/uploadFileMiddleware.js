import multer from "multer";
import fs from "fs";
const uploadDirectory = "./public/uploads/reports";
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    fs.mkdirSync(uploadDirectory, {
      recursive: true,
    });
    cb(null, uploadDirectory);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const uploadFile = multer({ storage });
export default uploadFile;
export const uploadFileMiddleware = uploadFile;