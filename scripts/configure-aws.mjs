import { readFile, writeFile } from "node:fs/promises";
const args = process.argv.slice(2),
  input = args[0],
  target = args.includes("--local") ? "local" : "website";
if (!input)
  throw Error(
    "Usage: node scripts/configure-aws.mjs stack-outputs.json [--local]",
  );
const data = JSON.parse(await readFile(input, "utf8"));
const values = Object.fromEntries(
  (data.Stacks?.[0]?.Outputs || data.Outputs || data).map((x) => [
    x.OutputKey,
    x.OutputValue,
  ]),
);
for (const key of [
  "ApiBaseUrl",
  "UserPoolId",
  "ClientId",
  "CognitoDomain",
  "Region",
  "WebsiteUrl",
])
  if (!values[key]) throw Error(`Missing output: ${key}`);
const origin = target === "local" ? "http://localhost:8080" : values.WebsiteUrl;
const settings = {
  mode: "aws",
  apiBaseUrl: values.ApiBaseUrl,
  cognitoDomain: values.CognitoDomain,
  region: values.Region,
  userPoolId: values.UserPoolId,
  clientId: values.ClientId,
  redirectUri: origin + "/",
  logoutUri: origin + "/",
  scopes: ["openid", "email", "profile"],
  defaultLanguage: "en",
};
await writeFile(
  "web/config.js",
  `// Public identifiers only. Generated from YOUR selected stack outputs.\nexport const config=Object.freeze(${JSON.stringify(settings, null, 2)});\n`,
);
console.log(
  `Configured AWS mode for ${origin}. No upload/deployment performed. Rebuild the frontend next. Never commit stack-output files containing unrelated data.`,
);
