# ECS Fargate: cluster + task definition + service, with the networking and
# IAM the console build had (default VPC, public task IP, no ALB).

# ---------- Networking: default VPC + default subnets + security group ----------

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "tasks" {
  name        = "${var.project}-tasks"
  description = "Allow inbound to the backend container port (no ALB yet)"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Backend HTTP"
    from_port   = var.container_port
    to_port     = var.container_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Vercel proxies /api/* here; an ALB is the proper fix
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------- Logs ----------

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.project}"
  retention_in_days = 7
}

# ---------- IAM: execution role (pulls image, writes logs) ----------

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.project}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ---------- IAM: task role (what the backend code itself may call) ----------

resource "aws_iam_role" "task" {
  name               = "${var.project}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "task" {
  statement {
    sid    = "DynamoDB"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:TransactWriteItems", # payment review uses a transaction
    ]
    resources = [aws_dynamodb_table.app.arn]
  }

  statement {
    sid    = "S3Objects"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:GetObjectVersion", # submit validates the video VersionId
    ]
    resources = ["${aws_s3_bucket.app.arn}/*"]
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "${var.project}-task"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# ---------- Cluster ----------

resource "aws_ecs_cluster" "app" {
  name = var.project
}

# ---------- Task definition ----------
# Environment matches backend/handler.mjs + backend/server.mjs exactly.

resource "aws_ecs_task_definition" "app" {
  family                   = var.project
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = var.project
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "TABLE_NAME", value = aws_dynamodb_table.app.name },
        { name = "PRIVATE_BUCKET", value = aws_s3_bucket.app.bucket },
        { name = "USER_POOL_ID", value = var.cognito_user_pool_id },
        { name = "CLIENT_ID", value = var.cognito_client_id },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "ALLOWED_ORIGINS", value = var.frontend_origin },
        { name = "PORT", value = tostring(var.container_port) },
        { name = "PAYMENT_MODE", value = var.manual_payment_instructions != "" ? "manual" : "disabled" },
        { name = "MANUAL_PAYMENT_INSTRUCTIONS", value = var.manual_payment_instructions },
        # Bedrock is deferred. When enabled later, add:
        # { name = "BEDROCK_ENABLED", value = "true" },
        # { name = "BEDROCK_REGION", value = "us-east-1" },
        # { name = "BEDROCK_MODEL_ID", value = "<model id>" },
        # plus bedrock:InvokeModel on the task role.
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])
}

# ---------- Service ----------

resource "aws_ecs_service" "app" {
  name            = var.project
  cluster         = aws_ecs_cluster.app.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = true # public task IP, like the console build
  }

  # If a new image fails to start, roll back instead of looping forever.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}
