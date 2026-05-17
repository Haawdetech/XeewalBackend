const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
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

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Format de fichier non supporté"));
};

const compressAndUpload = (prefix, maxWidth, quality) => async (req, res, next) => {
  if (!req.files?.length && !req.file) return next();

  const files = req.files || (req.file ? [req.file] : []);
  const s3 = getS3();
  const bucket = process.env.AWS_BUCKET_NAME;
  const uploaded = [];

  try {
    for (const file of files) {
      const key = `${prefix}/${uuidv4()}.webp`;

      const compressed = await sharp(file.buffer)
        .resize({ width: maxWidth, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: compressed,
        ContentType: "image/webp",
      }));

      const url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      file.location = url;
      uploaded.push(url);
    }

    if (req.files) req.uploadedUrls = uploaded;
    else if (req.file) req.file.location = uploaded[0];

    next();
  } catch (err) {
    next(err);
  }
};

const makeUploader = (prefix, maxWidth, quality, maxSize) => {
  const upload = multer({ storage: memoryStorage, fileFilter, limits: { fileSize: maxSize } });
  return {
    single: (field) => [
      upload.single(field),
      compressAndUpload(prefix, maxWidth, quality),
    ],
    array: (field, max) => [
      upload.array(field, max),
      compressAndUpload(prefix, maxWidth, quality),
    ],
  };
};

const uploadProduct  = makeUploader("products", 1200, 82, 5 * 1024 * 1024);
const uploadCategory = makeUploader("categories", 600, 80, 2 * 1024 * 1024);
const uploadAvatar   = makeUploader("avatars", 400, 80, 2 * 1024 * 1024);

module.exports = { uploadProduct, uploadCategory, uploadAvatar };
