output "static_ip" {
  value = aws_lightsail_static_ip.app.ip_address
}

output "url" {
  value = "https://${var.domain_name}"
}

output "ssh_command" {
  value = "ssh ubuntu@${var.domain_name}"
}
