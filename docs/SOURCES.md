# Official technical references

Checked while preparing this source on 20 Nov 2026. These sources support the selected integration patterns; they do not prove this project was deployed.

- Cognito authorization endpoint, code flow and PKCE S256:
  https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html
- Cognito PKCE public-client flow:
  https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html
- Cognito token endpoint:
  https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html
- Verifying Cognito JWTs with `aws-jwt-verify`, access-token use and client/pool checks:
  https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html
- HTTP API JWT authorizers and scopes:
  https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html
- SAM OAuth2/JWT authorizer syntax:
  https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-httpapi-oauth2authorizer.html
- SAM route-level authorizer overrides:
  https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-httpapifunctionauth.html
- Cognito logout behavior, including token/session limits:
  https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
- S3 presigned URLs:
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- S3 signed upload behavior and why an upload key can otherwise be overwritten:
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- CloudFront private S3 origin access control:
  https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
- DynamoDB transaction IAM actions are governed by the underlying item operations:
  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html
- Cognito domain branding versions, classic hosted UI vs managed login:
  https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_CreateUserPoolDomain.html

Dependencies are pinned by the included lockfiles. DM Sans and Noto Sans Arabic font license notices are included under `docs/licenses/`; the font files are bundled locally so the demo does not need Google Fonts requests.

## Bedrock v5 current references

Fetched 20 November 2026. Claims, design tradeoffs and unresolved activation choices are documented with exact URLs in BEDROCK.md. No live account state or selected model was verified.

- https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html
- https://aws.amazon.com/bedrock/pricing/
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html
