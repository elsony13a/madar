# Madar — Terraform + GitHub Actions pipeline

Rebuilds the Madar backend infrastructure with Terraform and a GitHub Actions pipeline.
Everything is based on the real backend code (`backend/handler.mjs` + `backend/server.mjs`).

## What Terraform creates

You asked for: DynamoDB, S3, ECR, cluster, task definition, service.
They are all here — plus the things around them that the console build also had
(without these, `terraform apply` succeeds but the app fails):

- `dynamodb.tf` — the one table, keys `PK` (String) + `SK` (String), on-demand, no GSI. Matches the code.
- `s3.tf` — bucket for videos + receipts, **versioning enabled** (the code rejects videos without a VersionId), CORS for your Vercel origin, and public access fully blocked (uploads/downloads use presigned URLs anyway).
- `ecr.tf` — the Docker image repository.
- `ecs.tf` — cluster, task definition, service (Fargate, 256 CPU / 512 MB, public IP, no ALB), **plus**:
  - IAM execution role (pulls the image, writes logs)
  - IAM task role (DynamoDB on this table, S3 `PutObject`/`GetObject`/`GetObjectVersion` on this bucket)
  - security group opening port 3000
  - CloudWatch log group `/ecs/madar`
  - the task's environment variables, matching the code exactly: `TABLE_NAME`, `PRIVATE_BUCKET`, `USER_POOL_ID`, `CLIENT_ID`, `AWS_REGION`, `ALLOWED_ORIGINS`, `PORT`, `PAYMENT_MODE`, `MANUAL_PAYMENT_INSTRUCTIONS`
  - a deployment circuit breaker: if a new image crashes, the service rolls back
- `outputs.tf` — prints the ECR URL and a ready-made command that returns the task's public IP.

**Not created (on purpose):** the Cognito user pool. Yours already works and has users.
Terraform only takes the pool ID and client ID as inputs. Same for Vercel: the frontend
stays on Vercel, only `vercel.json` needs the new task IP after each deploy.

## One-time setup (GitHub)

In the repo: Settings → Secrets and variables → Actions.

Secrets:
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (you already have these)
- `COGNITO_USER_POOL_ID` — e.g. `eu-central-1_XXXXXXXXX`
- `COGNITO_CLIENT_ID`
- `MANUAL_PAYMENT_INSTRUCTIONS` — the Vodafone Cash text (leave empty to keep manual payment off)

Variables:
- `AWS_REGION` — same region as the Cognito pool
- `FRONTEND_ORIGIN` — `https://madar-five-swart.vercel.app`
- `BUCKET_NAME` — `madadr-photos` (see the conflict note below)
- `TABLE_NAME` — `madar` (see the conflict note below)

Then put the `terraform/` folder and `.github/workflows/deploy.yml` in the repo root
(next to the `Dockerfile` — the workflow builds from the repo root) and push to `main`.

## Important: the resources you made by hand in the console

The console build already created a DynamoDB table and the `madadr-photos` bucket.
Terraform will fail with "already exists" if the names match. Pick one:

**Option A (simpler, fresh start):** use new names, e.g. `TABLE_NAME=madar-tf` and
`BUCKET_NAME=madadr-photos-tf`. Terraform creates fresh empty ones. Old test data stays
in the old table/bucket.

**Option B (keep existing data):** import the console resources before the first apply:

    cd terraform
    terraform import aws_dynamodb_table.app <existing-table-name>
    terraform import aws_s3_bucket.app madadr-photos
    terraform import aws_s3_bucket_versioning.app madadr-photos
    terraform import aws_s3_bucket_cors_configuration.app madadr-photos
    terraform import aws_s3_bucket_public_access_block.app madadr-photos

(Importing only works when running Terraform locally first; after that the GitHub
pipeline can take over — though without remote state, see below.)

## What happens on each push

1. `terraform init`
2. `terraform apply -target=aws_ecr_repository.app` (makes sure ECR exists)
3. Docker build → push to ECR, tagged with the commit SHA
4. `terraform apply -auto-approve` with that tag (new task definition revision, service updates itself)
5. The workflow waits for the new task and prints its public IP in the job log

## After each deploy: connect frontend to backend

1. Copy the task's public IP from the GitHub job log (or run the command in `terraform output get_task_public_ip`).
2. Put it in `web/public/vercel.json` as the `/api/*` rewrite target: `http://<IP>:3000/$1`.
3. `npm run build` and redeploy `dist/` to Vercel.
4. Check `http://<IP>:3000/health` and `/api/payment-method`.

The IP changes on every new task — that is the quick-test setup you know. The proper fix
is an ALB in front of the service; say the word and I'll add `alb.tf`.

## Running Terraform locally instead

    cd terraform
    cp terraform.tfvars.example terraform.tfvars   # fill it in
    terraform init
    terraform apply -auto-approve -target=aws_ecr_repository.app
    # build + push the image (same commands as the workflow), then:
    terraform apply -auto-approve

## Known limitation (fine for learning, worth knowing)

Terraform state (`terraform.tfstate`) lives on the machine that ran it. In GitHub Actions
it is thrown away after each run, so every run re-plans from scratch — mostly harmless here
because names are fixed, but the "already exists" errors return if you ever change names.
The real fix is a remote state backend (S3 + DynamoDB lock). That can be the next step
after this pipeline works.
