output "ecr_repository_url" {
  description = "Push the Docker image here"
  value       = aws_ecr_repository.app.repository_url
}

output "cluster_name" {
  value = aws_ecs_cluster.app.name
}

output "service_name" {
  value = aws_ecs_service.app.name
}

output "get_task_public_ip" {
  description = "Run this after the service is up to get the IP for web/public/vercel.json"
  value       = "aws ecs list-tasks --cluster ${aws_ecs_cluster.app.name} --service-name ${aws_ecs_service.app.name} --query 'taskArns[0]' --output text | xargs -I{} aws ecs describe-tasks --cluster ${aws_ecs_cluster.app.name} --tasks {} --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text | xargs -I{} aws ec2 describe-network-interfaces --network-interface-ids {} --query 'NetworkInterfaces[0].Association.PublicIp' --output text"
}
