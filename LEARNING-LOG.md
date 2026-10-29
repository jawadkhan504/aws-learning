# AWS learning log

## Done

### Account setup
- Account uses the new AWS sign-up experience: owned by an AWS Builder ID (no root user), Free plan with $100 credits.
- MFA turned on for the Builder ID.
- Did **not** activate advanced features — it needs a paid plan and can't be undone.
- AWS commands are run in **CloudShell**, not the local CLI (this Mac is shared).

### Git + GitHub
- Repo: https://github.com/jawadkhan504/aws-learning
- Pushed with a fine-grained personal access token.

### EC2, deployed by hand
- Amazon Linux 2023, t3.micro, no key pair, connected with EC2 Instance Connect.
- Security group allowed port 22 (SSH) and 3000 (app) from anywhere.
- Installed Node 24 with nvm, cloned the repo, built and ran it; `GET /health` worked from the internet.
- Request path: browser → public IP → VPC → public subnet → security group → EC2 → NestJS.

## Now: S3 (mentor's direction)
Bucket: `aws-learning-jawad-1793119872` in **ap-southeast-2 (Sydney)**. Use the regional endpoint `https://<bucket>.s3.ap-southeast-2.amazonaws.com`.

1. ✅ Basics with the CLI: buckets, objects, keys, private by default, presigned URLs
   - Folders are only key prefixes; bucket names are globally unique because they're part of a URL.
   - A presigned URL is temporary borrowed permission; the bucket stays private.
2. ✅ Security: Block Public Access, bucket policies vs IAM policies, encryption
   - Decision order: explicit Deny > Allow > default deny.
   - Block Public Access overrode a public policy even for an admin. Keep it on; turn it off per bucket only if needed.
   - A policy scoped to `public/*` gives least privilege; an `aws:SecureTransport` Deny forces HTTPS.
   - SSE-S3 (AES256) encryption at rest is on by default.
   - CloudShell runs as the assumed role `AccountFullAccessRole`, with temporary STS credentials.
3. ✅ Versioning and lifecycle rules
   - Versioning keeps every old copy of a file, like Google Docs version history. It can be paused, never fully switched off.
   - Deleting with versioning on only adds a "DELETED" sticky note (a delete marker). Remove the note and the file is back.
   - Lifecycle rules are standing instructions AWS runs once a day. Ours delete old copies after 30 days, and move `logs/` to the cheaper Standard-IA class after 30 days, then delete it after 365.
   - Storage classes: Standard (front shelf), Standard-IA (back room, small fee per fetch), Glacier (cheap warehouse, slow to fetch).
   - Files under 128 KB aren't moved to cheaper classes, because moving them costs more than it saves.
4. Static website: public bucket, then CloudFront + OAC
   - ✅ Part 1: separate public bucket `aws-learning-site-1793210439` (public and private files never share a bucket).
     Site: http://aws-learning-site-1793210439.s3-website-ap-southeast-2.amazonaws.com
   - The "website" switch sets **how** S3 behaves (home page and 404 page). Block Public Access plus a bucket policy decide **who** can see it. With only the switch on, you get 403.
   - Deploying a static site just means uploading new files.
   - Limits: plain `http` only ("Not Secure"), and the bucket is fully public. Part 2 fixes both with CloudFront.
   - ✅ Part 2: CloudFront distribution `my-first-site` (ID `ET8TJ8P1UA0ED`). Site: https://dw2diy45ktr6z.cloudfront.net
     - CloudFront is a worldwide network of copies in front of the bucket: https 🔒, faster for visitors.
     - The bucket is private again. Its policy only allows `cloudfront.amazonaws.com` from **our** distribution (Origin Access Control). Block Public Access is back on and website hosting is off, so the old `s3-website` address returns 404.
     - CloudFront keeps copies (caching). To deploy, upload the new files, then run `aws cloudfront create-invalidation --distribution-id ET8TJ8P1UA0ED --paths "/about.html"`, and wait 1–2 minutes.
     - Skipped WAF (the paid firewall); it's worth it for apps with logins, forms or an API.
     - Pages need `<meta charset="utf-8">` or emojis show as garbled characters.
5. NestJS file upload/download with the AWS SDK and presigned URLs
6. Event notifications (S3 → Lambda / SQS)

## Later
Docker + ECR → ECS Fargate + load balancer → GitHub Actions CI/CD → Terraform/CDK → RDS, Secrets Manager, CloudWatch, Route 53, HTTPS
