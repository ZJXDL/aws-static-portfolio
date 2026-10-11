variable "aws_region" {
  description = "AWS region for the S3 bucket. CloudFront is a global service."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short name used in resource names and tags."
  type        = string
  default     = "cloud-portfolio"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Use lowercase letters, numbers, and hyphens only."
  }
}
