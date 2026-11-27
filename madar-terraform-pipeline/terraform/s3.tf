# Course videos + payment receipts. The table stores object keys, not URLs.
# Browser uploads via presigned POST, viewing via presigned GET.
resource "aws_s3_bucket" "app" {
  bucket = var.bucket_name
}

# REQUIRED by the backend: course submit validates the video's VersionId.
resource "aws_s3_bucket_versioning" "app" {
  bucket = aws_s3_bucket.app.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Allow the Vercel site to call S3 directly (presigned upload/download).
resource "aws_s3_bucket_cors_configuration" "app" {
  bucket = aws_s3_bucket.app.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = [var.frontend_origin]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Everything stays private; access is only through presigned URLs from the backend.
resource "aws_s3_bucket_public_access_block" "app" {
  bucket = aws_s3_bucket.app.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
