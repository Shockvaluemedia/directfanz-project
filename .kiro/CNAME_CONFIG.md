## CNAME Configuration for Hostinger

**Add this CNAME record in Hostinger DNS:**

```
Type: CNAME
Name: @ (or directfanz.io)
Value: directfanz-alb-448804778.us-east-1.elb.amazonaws.com
TTL: 300
```

**Also add www subdomain:**
```
Type: CNAME  
Name: www
Value: directfanz-alb-448804778.us-east-1.elb.amazonaws.com
TTL: 300
```

**Result**: DirectFanz will be live at https://directfanz.io within 5 minutes