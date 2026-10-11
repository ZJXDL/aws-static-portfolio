# Interview walkthrough

## 30-second summary

> This project provisions a static site on AWS with OpenTofu. CloudFront serves it over HTTPS from a private S3 bucket. Origin Access Control signs CloudFront's requests, and the bucket policy allows reads only from this distribution. The current site upload uses the AWS CLI. A GitHub Actions OIDC workflow and IAM examples are included, but connecting them is a next step. The infrastructure also configures security headers, encryption, versioning, and a teardown path.

## How a page request works

1. A visitor opens the CloudFront URL over HTTPS.
2. CloudFront checks its cache. If it does not have the requested file, it contacts the S3 origin.
3. CloudFront signs that origin request with OAC. The bucket policy checks the CloudFront distribution ARN and permits `s3:GetObject` only for that distribution.
4. CloudFront returns the file with the configured HTTPS behavior and security response headers.

The S3 website hosting endpoint is not used. That lets the bucket remain private and lets CloudFront use OAC.

## How deployment works

1. For the current deployment, OpenTofu provisions AWS resources and the AWS CLI syncs the `site/` files to the bucket.
2. A CloudFront invalidation clears cached paths after an update so visitors receive the new site files.
3. The repository includes a GitHub Actions workflow for future automation. Once its OIDC provider, trust policy, IAM role, and repository variables are configured, a push to `main` can request short-lived AWS role credentials and publish the site.

The planned GitHub deploy role is scoped to website delivery and cache invalidation; it should not modify OpenTofu-managed infrastructure. Infrastructure changes are applied separately by an authorized operator.

## Design decisions to explain

| Decision | Reason |
| --- | --- |
| Private S3 bucket + CloudFront OAC | Visitors use CloudFront; direct public S3 access stays blocked. |
| GitHub OIDC instead of access keys | GitHub receives short-lived credentials after AWS validates repository and branch claims. |
| OpenTofu | Infrastructure can be reviewed as code, recreated, and removed consistently. |
| CloudFront default TLS certificate | Keeps the starter simple and avoids a domain and separate certificate setup. |
| Local OpenTofu state | Makes the learning setup easy to follow; teams should move state to a protected remote backend. |
| `force_destroy` on the dedicated bucket | Allows a clean teardown after the site files have been uploaded. It must only be used for this disposable portfolio bucket. |

## Questions to prepare for

- **What happens if GitHub is compromised?** The trust policy limits which repo and branch can assume the role, and the role's permissions are limited to this bucket and distribution. Protect the main branch with reviews and required checks.
- **How would you roll back?** Restore an earlier site revision from Git and redeploy. S3 versioning also retains object versions, but this starter does not automate restoring one.
- **How would you reduce cost?** Review CloudFront and S3 usage, configure a budget alert, avoid unnecessary invalidations, and tear down the stack when it is not needed.
- **How would you improve production readiness?** Use remote OpenTofu state with locking, add pull request checks and approval gates, use a custom domain only with its DNS and certificate configured, and add monitoring and a recovery procedure.
- **What does this project not prove yet?** It shows a small static workload and delivery pipeline. It does not demonstrate application servers, databases, Kubernetes, or incident response; add separate projects to show those areas.

Be ready to open the OpenTofu files and explain the bucket policy, OAC, CloudFront distribution, IAM trust conditions, and deploy permissions in your own words.
