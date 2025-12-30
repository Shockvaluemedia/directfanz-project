# Domain CAA Records Issue

## Problem
Your domain `directfanz.io` has CAA (Certificate Authority Authorization) records that only allow specific certificate authorities to issue SSL certificates. AWS Certificate Manager is not in the allowed list.

## Current CAA Records
```
directfanz.io. CAA 0 issue "comodoca.com"
directfanz.io. CAA 0 issue "digicert.com"
directfanz.io. CAA 0 issue "globalsign.com"
directfanz.io. CAA 0 issue "letsencrypt.org"
directfanz.io. CAA 0 issue "pki.goog"
directfanz.io. CAA 0 issue "sectigo.com"
```

## Solution Options

### Option 1: Add AWS to CAA Records (Recommended)
In Hostinger DNS settings, add this CAA record:
```
Type: CAA
Name: @
Value: 0 issue "amazon.com"
```

### Option 2: Remove CAA Records
Delete all CAA records in Hostinger (less secure but simpler).

### Option 3: Deploy Without SSL First
Deploy infrastructure without SSL certificates, then add them after DNS change.

## Let's Go with Option 3 for Now
I'll modify the terraform to deploy without SSL certificates first, then we can add them after the DNS change.