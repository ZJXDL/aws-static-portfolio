output "site_url" {
  description = "HTTPS URL for the deployed portfolio."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "bucket_name" {
  description = "S3 bucket used as the private CloudFront origin."
  value       = aws_s3_bucket.site.id
}

output "distribution_id" {
  description = "CloudFront distribution ID used by the GitHub Actions deployment."
  value       = aws_cloudfront_distribution.site.id
}
