import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type Bucket = "adventure-assets" | "service-references";

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || "auto";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("S3 storage credentials are required");

const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: { accessKeyId, secretAccessKey },
});
const publicClient = new S3Client({
  endpoint: process.env.S3_PUBLIC_ENDPOINT || endpoint,
  region,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: { accessKeyId, secretAccessKey },
});

const names: Record<Bucket, string> = {
  "adventure-assets": process.env.S3_ASSET_BUCKET || "adventure-assets",
  "service-references": process.env.S3_REFERENCE_BUCKET || "service-references",
};

function bucketName(bucket: Bucket) { return names[bucket]; }

function objectKey(key: string) {
  if (!key || key.startsWith("/") || key.split("/").some((part) => part === ".." || part === ".")) throw new Error("Invalid object key");
  return key;
}

export const storage = {
  async upload(bucket: Bucket, key: string, body: Uint8Array, contentType: string) {
    await client.send(new PutObjectCommand({ Bucket: bucketName(bucket), Key: objectKey(key), Body: body, ContentType: contentType }));
  },
  async download(bucket: Bucket, key: string) {
    const result = await client.send(new GetObjectCommand({ Bucket: bucketName(bucket), Key: objectKey(key) }));
    if (!result.Body) throw new Error("Object body is empty");
    return new Uint8Array(await result.Body.transformToByteArray());
  },
  async remove(bucket: Bucket, key: string) {
    await client.send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: objectKey(key) }));
  },
  async copy(bucket: Bucket, source: string, target: string) {
    await client.send(new CopyObjectCommand({ Bucket: bucketName(bucket), CopySource: `${bucketName(bucket)}/${objectKey(source).split("/").map(encodeURIComponent).join("/")}`, Key: objectKey(target) }));
  },
  async exists(bucket: Bucket, key: string) {
    try { await client.send(new HeadObjectCommand({ Bucket: bucketName(bucket), Key: objectKey(key) })); return true; }
    catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false; throw error; }
  },
  signedDownload(bucket: Bucket, key: string, seconds = 300) {
    if (seconds < 1 || seconds > 3600) throw new Error("Invalid signed URL lifetime");
    return getSignedUrl(publicClient, new GetObjectCommand({ Bucket: bucketName(bucket), Key: objectKey(key) }), { expiresIn: seconds });
  },
  signedUpload(bucket: Bucket, key: string, contentType: string, seconds = 300) {
    if (seconds < 1 || seconds > 900) throw new Error("Invalid signed URL lifetime");
    return getSignedUrl(publicClient, new PutObjectCommand({ Bucket: bucketName(bucket), Key: objectKey(key), ContentType: contentType }), { expiresIn: seconds });
  },
  publicUrl(key: string) {
    const origin = process.env.S3_PUBLIC_REFERENCE_URL;
    if (!origin) throw new Error("S3_PUBLIC_REFERENCE_URL is required");
    return `${origin.replace(/\/$/, "")}/${objectKey(key).split("/").map(encodeURIComponent).join("/")}`;
  },
};
