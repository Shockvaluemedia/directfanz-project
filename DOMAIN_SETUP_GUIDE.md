# DirectFanz.io Domain Setup Guide

## Current Status ✅
- Domain `directfanz.io` has been added to your Vercel project
- Environment variables have been updated to use your custom domain:
  - `NEXT_PUBLIC_APP_URL` → `https://directfanz.io`
  - `NEXTAUTH_URL` → `https://directfanz.io`
- New production deployment completed
- Vercel is attempting to create SSL certificate for your domain

## Required DNS Configuration at Hostinger

To complete the domain setup, you need to update the DNS records in your Hostinger dashboard:

### Step 1: Access Hostinger DNS Management
1. Log into your Hostinger account
2. Go to "Domains" section
3. Find `directfanz.io` and click "Manage"
4. Navigate to "DNS/Name Servers" or "DNS Zone"

### Step 2: Update DNS Records

Replace the current DNS records with these Vercel-specific records:

#### For Root Domain (directfanz.io):
```
Type: A
Name: @ (or leave blank)
Value: 76.76.19.19
TTL: 60 (or Auto)
```

#### For WWW Subdomain:
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 60 (or Auto)
```

### Step 3: Alternative Configuration (If A Record Doesn't Work)
If the A record approach doesn't work, try this CNAME configuration:

```
Type: CNAME
Name: @ (or leave blank)
Value: cname.vercel-dns.com
TTL: 60 (or Auto)
```

### Step 4: Remove Old Records
- Delete any existing A records pointing to other IP addresses
- Remove any CNAME records that conflict with the new setup
- Keep only MX records (for email) if you have any

### Step 5: Verification Commands

After updating DNS records, test with these commands:

```bash
# Test DNS propagation
dig directfanz.io
dig www.directfanz.io

# Test website access
curl -I https://directfanz.io
curl -I https://www.directfanz.io
```

## Expected Timeline

- **DNS Propagation**: 15 minutes to 48 hours (usually within 1-2 hours)
- **SSL Certificate**: Automatically generated once DNS is pointing correctly
- **Full Functionality**: Available once SSL certificate is issued

## Troubleshooting

### If the domain still doesn't work after 2 hours:

1. **Double-check DNS records** in Hostinger dashboard
2. **Clear DNS cache**: 
   ```bash
   sudo dscacheutil -flushcache
   ```
3. **Test with different DNS servers**:
   ```bash
   nslookup directfanz.io 8.8.8.8
   ```
4. **Check Vercel dashboard** for any SSL certificate errors

### Common Issues:

- **"Connection timed out"**: DNS not propagated yet or incorrect A record
- **"Certificate error"**: SSL certificate still being generated
- **"404 Not Found"**: Domain not properly connected to Vercel project

## Verification Checklist

Once everything is working, verify these endpoints:

- ✅ `https://directfanz.io` - Main site
- ✅ `https://www.directfanz.io` - WWW subdomain  
- ✅ `https://directfanz.io/api/health` - API endpoints
- ✅ `https://directfanz.io/auth/signin` - Authentication flows

## Current Vercel Configuration

Your project is configured with:
- **Project**: directfanz-platform  
- **Domain**: directfanz.io
- **SSL**: Being generated automatically
- **Environment**: Production with custom domain URLs

## Next Steps After Domain Is Active

1. **Remove Vercel deployment protection** to allow public access
2. **Test all critical functionality** with the custom domain
3. **Update any hardcoded URLs** in your marketing materials
4. **Set up domain redirects** (www → non-www or vice versa)
5. **Configure email services** if needed

## Support

If you encounter issues:
1. Check Hostinger's DNS propagation tools
2. Use Vercel's domain troubleshooting in their dashboard
3. Run the verification commands above to diagnose

---

**Status**: Waiting for DNS propagation at Hostinger
**Next Action**: Update DNS records in Hostinger dashboard as described above