# 🚨 URGENT: IAM Permission Request for DirectFanz Production Deployment

## Status: DirectFanz 95% Deployed - Blocked by IAM Permissions

**Current Situation:**
- ✅ All AWS infrastructure deployed and operational
- ✅ DirectFanz application built and pushed to ECR
- ✅ Domain (directfanz.io) resolving correctly
- ❌ **BLOCKED**: Cannot deploy DirectFanz container due to missing IAM permissions

## Required IAM Permission

**User:** `arn:aws:iam::545582548240:user/directfanz-app-user`

**Missing Permission:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::545582548240:role/ecsTaskExecutionRole"
        }
    ]
}
```

## Why This Permission is Needed

The `iam:PassRole` permission is required to:
1. Register ECS task definitions that use ECR images
2. Allow ECS tasks to pull container images from ECR
3. Enable proper logging and monitoring for production containers

## Impact Without This Permission

- ❌ Cannot deploy DirectFanz application container
- ❌ Site shows CloudFront 403 errors (nginx placeholder running)
- ❌ Production launch blocked

## Immediate Action Required

**Please add the PassRole permission to user `directfanz-app-user` for role `ecsTaskExecutionRole`**

Once this permission is added:
1. DirectFanz container will deploy automatically (2-3 minutes)
2. Site will be fully functional at https://directfanz.io
3. Production launch can proceed

## Security Note

This permission is standard for ECS deployments and only allows passing the specific execution role needed for container operations. It does not grant broader IAM privileges.

---

**Time Sensitive:** DirectFanz is ready to go live - this is the final blocker.