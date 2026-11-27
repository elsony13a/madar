import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { createService } from "./service.mjs";
import { HttpError } from "./domain.mjs";
const table = process.env.TABLE_NAME,
  bucket = process.env.PRIVATE_BUCKET;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  }),
  s3 = new S3Client({});
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  clientId: process.env.CLIENT_ID,
  tokenUse: "access",
  scope: "openid",
});
const db = {
  async get(Key) {
    return (
      await ddb.send(
        new GetCommand({ TableName: table, Key, ConsistentRead: true }),
      )
    ).Item;
  },
  async query(PK, prefix) {
    let items = [],
      LastEvaluatedKey;
    do {
      const result = await ddb.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: prefix
            ? "PK = :pk AND begins_with(SK, :prefix)"
            : "PK = :pk",
          ExpressionAttributeValues: {
            ":pk": PK,
            ...(prefix ? { ":prefix": prefix } : {}),
          },
          ExclusiveStartKey: LastEvaluatedKey,
          ConsistentRead: true,
        }),
      );
      items.push(...result.Items);
      LastEvaluatedKey = result.LastEvaluatedKey;
      if (items.length > 2000)
        throw new HttpError(
          503,
          "Starter query limit reached; add cursor pagination before scaling.",
        );
    } while (LastEvaluatedKey);
    return items;
  },
  async atomic(writes) {
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: writes.map(({ item, version }) => ({
            Put: {
              TableName: table,
              Item: item,
              ConditionExpression:
                version === undefined
                  ? "attribute_not_exists(PK)"
                  : "#version = :version",
              ...(version === undefined
                ? {}
                : {
                    ExpressionAttributeNames: { "#version": "version" },
                    ExpressionAttributeValues: { ":version": version },
                  }),
            },
          })),
        }),
      );
    } catch (e) {
      if (e.name === "TransactionCanceledException")
        throw new HttpError(
          409,
          "Data changed or access was already granted. Refresh before trying again.",
        );
      throw e;
    }
  },
};
const files = {
  async upload(key, type, maxBytes) {
    const post = await createPresignedPost(s3, {
      Bucket: bucket,
      Key: key,
      Fields: { "Content-Type": type },
      Conditions: [
        ["content-length-range", 1, maxBytes],
        ["eq", "$Content-Type", type],
      ],
      Expires: 120,
    });
    return { url: post.url, fields: post.fields, key, maxBytes };
  },
  async head(Key) {
    try {
      const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key }));
      return {
        size: r.ContentLength,
        contentType: r.ContentType,
        version: r.VersionId,
      };
    } catch (e) {
      if (e.$metadata?.httpStatusCode === 404)
        throw new HttpError(400, "Upload has not completed");
      throw e;
    }
  },
  async download(Key, VersionId, seconds) {
    return getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key,
        VersionId,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: seconds },
    );
  },
};
const aiEnabled = process.env.BEDROCK_ENABLED === "true";
const aiRegion = process.env.BEDROCK_REGION || "",
  aiModel = process.env.BEDROCK_MODEL_ID || "";
if (
  aiEnabled &&
  (!/^[a-z]{2}-[a-z]+-[0-9]+$/.test(aiRegion) ||
    !/^[a-z0-9][a-z0-9.:-]{2,150}$/.test(aiModel) ||
    /^(us|eu|apac|global|au|ca|jp|in)\./.test(aiModel))
)
  throw Error(
    "Explicit supported in-region foundation model ID and region required",
  );
const bedrock = aiEnabled
  ? new BedrockRuntimeClient({ region: aiRegion, maxAttempts: 1 })
  : null;
const ai = {
  enabled: aiEnabled,
  modelId: aiModel,
  region: aiRegion,
  async generate({ source, count, system }) {
    const r = await bedrock.send(
      new ConverseCommand({
        modelId: aiModel,
        system: [{ text: system }],
        messages: [
          {
            role: "user",
            content: [
              {
                text: JSON.stringify({
                  questionCount: count,
                  untrustedLessonSource: source,
                }),
              },
            ],
          },
        ],
        inferenceConfig: { maxTokens: 2048 },
      }),
      { abortSignal: AbortSignal.timeout(20000) },
    );
    if (r.stopReason !== "end_turn")
      throw new HttpError(
        502,
        "Model response was incomplete or blocked. No quiz adopted.",
      );
    return {
      text: (r.output?.message?.content || [])
        .filter((c) => typeof c.text === "string")
        .map((c) => c.text)
        .join(""),
      usage: r.usage
        ? {
            inputTokens: r.usage.inputTokens,
            outputTokens: r.usage.outputTokens,
            totalTokens: r.usage.totalTokens,
          }
        : null,
    };
  },
};
const dispatch = createService({
  ai,
  db,
  files,
  paymentInstructions: process.env.MANUAL_PAYMENT_INSTRUCTIONS || "",
  paymentMode: process.env.PAYMENT_MODE || "disabled",
});
export async function handler(event) {
  const method = event.requestContext?.http?.method,
    path = event.rawPath;
  const respond = (statusCode, data) => ({
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
    body: JSON.stringify(data),
  });
  try {
    if (!method || !path)
      throw new HttpError(400, "HTTP API payload 2.0 required");
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body || "";
    if (Buffer.byteLength(raw) > 300000)
      throw new HttpError(413, "Request too large");
    let body = {};
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        throw new HttpError(400, "Invalid JSON");
      }
    }
    if (!body || Array.isArray(body) || typeof body !== "object")
      throw new HttpError(400, "JSON body must be an object");
    const isPublic =
      method === "GET" &&
      (path === "/courses" || /^\/courses\/[^/]+$/.test(path));
    let claims = null;
    if (!isPublic) {
      const auth =
        event.headers?.authorization || event.headers?.Authorization || "";
      if (!auth.startsWith("Bearer "))
        throw new HttpError(401, "Access token required");
      try {
        claims = await verifier.verify(auth.slice(7));
      } catch {
        throw new HttpError(401, "Invalid or expired access token");
      }
    }
    let decoded;
    try {
      decoded = path
        .split("/")
        .map((p) => decodeURIComponent(p))
        .join("/");
    } catch {
      throw new HttpError(400, "Invalid URL encoding");
    }
    return respond(
      200,
      await dispatch({ method, path: decoded, body, claims }),
    );
  } catch (e) {
    if (!e.status)
      console.error(
        JSON.stringify({
          requestId: event.requestContext?.requestId,
          error: e.name,
        }),
      );
    return respond(e.status || 500, {
      message: e.status
        ? e.message
        : "Server error. Check the request ID in CloudWatch.",
      requestId: event.requestContext?.requestId,
    });
  }
}
