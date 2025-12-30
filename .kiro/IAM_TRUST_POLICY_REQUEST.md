## URGENT: Additional IAM Permission Required

**Issue**: ECS tasks cannot start due to trust policy error
**Error**: "ECS was unable to assume the role 'arn:aws:iam::545582548240:role/ecsTaskExecutionRole'"

**Required Action**: Add this inline policy to `directfanz-app-user`:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "iam:UpdateAssumeRolePolicy",
            "Resource": "arn:aws:iam::545582548240:role/ecsTaskExecutionRole"
        }
    ]
}
```

**After applying**: Run `bash .kiro/fix-trust-policy.sh`

**Result**: DirectFanz will be live at https://directfanz.io within 2 minutes