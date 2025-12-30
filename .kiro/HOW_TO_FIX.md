## How to Fix DirectFanz SSL Error

**Step 1**: Go to AWS IAM Console → Users → directfanz-app-user

**Step 2**: Click "Add permissions" → "Attach policies directly" → "Create policy"

**Step 3**: Copy and paste this JSON:
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

**Step 4**: Save policy as "ECSRoleFix"

**Step 5**: Run this command:
```bash
bash .kiro/fix-trust-policy.sh
```

**Result**: DirectFanz will be live at https://directfanz.io in 2 minutes