const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { decryptKey } = require("../utils/cryptoKeys");

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const getS3 = () =>
  new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: decryptKey(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: decryptKey(process.env.AWS_SECRET_ACCESS_KEY),
    },
  });

const makeStorage = (prefix) =>
  multerS3({
    s3: getS3(),
    bucket: (req, file, cb) => cb(null, process.env.AWS_BUCKET_NAME),
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${prefix}/${uuidv4()}${ext}`);
    },
   // console.log(con);
    
  });

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Format de fichier non supporté"));
};

const uploadProduct = multer({ storage: makeStorage("products"), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadCategory = multer({ storage: makeStorage("categories"), fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });
const uploadAvatar = multer({ storage: makeStorage("avatars"), fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

module.exports = { uploadProduct, uploadCategory, uploadAvatar };
