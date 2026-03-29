import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { config } from "../config";

let s3Client: S3Client | null = null;

const getS3Client = () => {
  if (!config.awsRegion || !config.awsBucket || !config.awsAccessKeyId || !config.awsSecretAccessKey) {
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
  }

  return s3Client;
};

export const createUploadUrl = async (input: {
  restaurantId: string;
  filename: string;
  contentType: string;
}) => {
  const client = getS3Client();
  if (!client || !config.awsBucket || !config.awsRegion) {
    return null;
  }

  const extension = input.filename.includes(".") ? input.filename.split(".").pop() : "jpg";
  const key = `restaurants/${input.restaurantId}/menu/${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: config.awsBucket,
    Key: key,
    ContentType: input.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: 60 * 5,
  });

  const publicUrl =
    config.awsPublicBaseUrl?.replace(/\/$/, "")
      ? `${config.awsPublicBaseUrl!.replace(/\/$/, "")}/${key}`
      : `https://${config.awsBucket}.s3.${config.awsRegion}.amazonaws.com/${key}`;

  return { key, uploadUrl, publicUrl };
};
