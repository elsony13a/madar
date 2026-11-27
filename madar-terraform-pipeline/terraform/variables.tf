variable "aws_region" {
  description = "AWS region. MUST be the same region as the Cognito user pool."
  type        = string
  default     = "eu-central-1"
}

variable "project" {
  description = "Name prefix for ECS cluster, service, ECR repo, log group."
  type        = string
  default     = "madar"
}

variable "table_name" {
  description = "DynamoDB table name (backend reads it from TABLE_NAME)."
  type        = string
  default     = "madar"
}

variable "bucket_name" {
  description = "S3 bucket for course videos + payment receipts (backend reads PRIVATE_BUCKET). Must be globally unique."
  type        = string
  default     = "madadr-photos"
}

variable "cognito_user_pool_id" {
  description = "Existing Cognito user pool ID, e.g. eu-central-1_XXXXXXXXX."
  type        = string
}

variable "cognito_client_id" {
  description = "Existing Cognito app client ID (public client, no secret)."
  type        = string
}

variable "frontend_origin" {
  description = "Frontend origin allowed by S3 CORS and the backend ALLOWED_ORIGINS."
  type        = string
  default     = "https://madar-five-swart.vercel.app"
}

variable "manual_payment_instructions" {
  description = "Text shown to students for manual payment (Vodafone Cash number). Empty disables manual payment."
  type        = string
  default     = ""
  sensitive   = true
}

variable "image_tag" {
  description = "Docker image tag in ECR the service should run. The pipeline sets this to the git SHA."
  type        = string
  default     = "latest"
}

variable "container_port" {
  description = "Port server.mjs listens on (PORT env)."
  type        = number
  default     = 3000
}
