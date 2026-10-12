# Architecture notes

## Page request

1. A visitor requests the site over HTTPS from the CloudFront distribution.
2. CloudFront serves a cached object when available. On a cache miss, it requests the object from the S3 origin.
3. CloudFront signs the origin request using Origin Access Control (OAC) and SigV4.
4. The bucket policy allows `s3:GetObject` only when the request comes from this distribution. S3 Block Public Access remains enabled.

The distribution uses the S3 REST origin, not S3 static website hosting. This allows the bucket to remain private while CloudFront serves the site publicly.

## Site deployment

1. A push to `main` that changes `site/` starts the GitHub Actions workflow. The workflow can also be started manually.
2. GitHub Actions requests an OIDC token. AWS validates the token's audience and repository/branch claims against the IAM role trust policy.
3. AWS returns short-lived credentials for the role. The role can synchronize site objects to the dedicated bucket and invalidate this distribution's cache.
4. The workflow runs `aws s3 sync` with deletion enabled, then requests a CloudFront invalidation.

No long-lived AWS access key is stored in the GitHub repository. The workflow role is for publishing site content; infrastructure changes are managed separately with OpenTofu.

## Infrastructure safeguards

- S3 Block Public Access is enabled, and bucket ownership controls disable ACL-based access.
- CloudFront is the only permitted reader of S3 objects, scoped by the distribution ARN in the bucket policy.
- S3 default server-side encryption and versioning are enabled. A lifecycle rule expires noncurrent object versions after 30 days.
- CloudFront redirects HTTP requests to HTTPS, uses TLS 1.2 or newer, compresses responses, and adds security response headers.
- OpenTofu applies project, environment, and management tags to provider-managed resources.

## Scope and tradeoffs

The application is static and single-player. Game state exists only in the browser; there is no API, database, account system, or shared leaderboard.

The OpenTofu state is local for this learning deployment. A team environment should use a protected remote backend with encryption, locking, and controlled access. The configuration also uses `force_destroy` for the dedicated site bucket to support teardown, so that bucket must not hold unrelated data. The default CloudFront certificate is used; a custom domain would require DNS and certificate configuration.
