resource "aws_ecr_repository" "app" {
  name                 = var.project
  force_delete         = true # lets terraform destroy remove images too (learning project)
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}
