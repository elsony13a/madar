# One table holds everything (courses, users, enrollments, payments, reviews, questions).
# Matches backend/handler.mjs: partition key PK (String), sort key SK (String), on-demand, no GSI.
resource "aws_dynamodb_table" "app" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false # learning project; set true for real data
  }
}
