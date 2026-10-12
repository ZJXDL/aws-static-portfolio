# Interview walkthrough

## 30-second summary

> Minefield is a browser-side classic Minesweeper game with three standard board sizes. I host the static HTML, CSS, and JavaScript on AWS: CloudFront serves it over HTTPS from a private S3 bucket. Origin Access Control signs CloudFront's requests, and the bucket policy allows reads only from this distribution. GitHub Actions deploys game changes using OIDC and short-lived AWS credentials, then invalidates CloudFront. OpenTofu manages the infrastructure, including security headers, encryption, versioning, and teardown.

## How a page request works

1. A visitor opens the CloudFront URL over HTTPS.
2. CloudFront checks its cache. If it does not have the requested file, it contacts the S3 origin.
3. CloudFront signs that origin request with OAC. The bucket policy checks the CloudFront distribution ARN and permits `s3:GetObject` only for that distribution.
4. CloudFront returns the file with the configured HTTPS behavior and security response headers.

The S3 website hosting endpoint is not used. That lets the bucket remain private and lets CloudFront use OAC.

## How deployment works

1. OpenTofu provisions the AWS resources.
2. A push to `main` that changes `site/` starts the GitHub Actions workflow. It can also be started manually from GitHub Actions.
3. The workflow requests a GitHub OIDC token. AWS checks its audience and repository/branch subject against the dedicated IAM role's trust policy, then returns short-lived credentials.
4. The role syncs the site files to the private S3 bucket and requests a CloudFront invalidation. No long-lived AWS access key is stored in GitHub.

The GitHub deploy role is scoped to website delivery and cache invalidation; it cannot modify OpenTofu-managed infrastructure. Infrastructure changes are applied separately by an authorized operator.

## Design decisions to explain

| Decision | Reason |
| --- | --- |
| Private S3 bucket + CloudFront OAC | Visitors use CloudFront; direct public S3 access stays blocked. |
| GitHub OIDC instead of access keys | GitHub receives short-lived credentials after AWS validates repository and branch claims. |
| OpenTofu | Infrastructure can be reviewed as code, recreated, and removed consistently. |
| CloudFront default TLS certificate | Keeps the starter simple and avoids a domain and separate certificate setup. |
| Local OpenTofu state | Makes the learning setup easy to follow; teams should move state to a protected remote backend. |
| `force_destroy` on the dedicated bucket | Allows a clean teardown after the site files have been uploaded. It must only be used for this disposable portfolio bucket. |
| Browser-side game state | Keeps the game fast and available without sign-in; personal bests are device-local, not a shared ranking. |

## Questions to prepare for

- **What happens if GitHub is compromised?** The trust policy limits which repo and branch can assume the role, and the role's permissions are limited to this bucket and distribution. Protect the main branch with reviews and required checks.
- **How would you roll back?** Restore an earlier site revision from Git and redeploy. S3 versioning also retains object versions, but this starter does not automate restoring one.
- **How would you reduce cost?** Review CloudFront and S3 usage, configure a budget alert, avoid unnecessary invalidations, and tear down the stack when it is not needed.
- **How would you improve production readiness?** Use remote OpenTofu state with locking, add pull request checks and approval gates, use a custom domain only with its DNS and certificate configured, and add monitoring and a recovery procedure.
- **What does this project not prove yet?** It shows a small static workload and delivery pipeline. The game has no accounts or server-backed leaderboard yet, and it does not demonstrate application servers, databases, Kubernetes, or incident response. A later authenticated score service would extend the project beyond static hosting.

Be ready to open the OpenTofu files and explain the bucket policy, OAC, CloudFront distribution, IAM trust conditions, and deploy permissions in your own words.
