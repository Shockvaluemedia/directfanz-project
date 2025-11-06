# 🔧 Debug Streaming Issues Checklist

## Current Status: Investigating Streaming Problems

The `/streams` page loads visually but shows "0 streams" and appears to have data loading issues.

---

## 🧪 **Step-by-Step Debugging Process**

### **1. Browser Console Errors**
**Action**: Open DirectFanZ.io/streams in browser and check console for errors

**Look for:**
- API request failures
- JavaScript runtime errors
- Authentication errors
- Network request issues

### **2. Network Tab Investigation**
**Action**: Check browser dev tools Network tab while loading streams page

**Look for:**
- Failed API requests to `/api/livestream`
- 401/403 authentication errors
- 500 server errors
- Requests timing out

### **3. Authentication Status**
**Action**: Verify user authentication state

**Check:**
- Are you signed in?
- What role is your user (ARTIST vs FAN)?
- Is your session valid?
- Are cookies/tokens working?

### **4. API Endpoint Testing**
**Action**: Test API endpoints directly

**Commands to run:**
```bash
# Test unauthorized access (should return 401)
curl -s https://directfanz.io/api/livestream

# Test with authentication (need to get session token)
# Browser dev tools → Application → Cookies → Copy session token
```

### **5. Database Investigation**
**Action**: Check if live_streams table has data or constraints

**Possible issues:**
- No streams exist in database
- Database permissions
- Table schema mismatch

---

## 🔍 **Common Issues & Solutions**

### **Issue 1: "Create Stream" Button Not Working**
**Symptoms**: Button click doesn't navigate or shows error
**Solution**: Check authentication and user role (must be ARTIST)

### **Issue 2: API Requests Failing**
**Symptoms**: Network errors, 401/403 responses
**Solution**: Verify authentication middleware and session handling

### **Issue 3: Data Not Loading**
**Symptoms**: Page loads but shows empty state
**Solution**: Check API response format and component data handling

### **Issue 4: JavaScript Errors**
**Symptoms**: Console errors, broken functionality
**Solution**: Check for client-side JavaScript issues

---

## 🛠️ **Quick Fixes to Try**

### **Fix 1: Force Refresh Browser Cache**
- Hard refresh (Ctrl+F5 or Cmd+Shift+R)
- Clear browser cache
- Try incognito/private browsing

### **Fix 2: Sign In as Artist**
- Create new account with ARTIST role
- Test streaming features with proper permissions

### **Fix 3: Check Component State**
- Verify React component is receiving data
- Check if loading states are stuck

---

## 📋 **Information Needed**

To help debug, please provide:

1. **Browser Console Output**: Any errors when visiting /streams
2. **Network Tab**: Failed requests and their response codes
3. **User Account**: Are you signed in? What role?
4. **Specific Behavior**: What exactly happens when you try to use streaming?
5. **Button Clicks**: Does "Create Stream" button work?

---

## ⚡ **Immediate Debugging Commands**

Run these to help identify the issue:

```bash
# Test streams page loading
curl -s https://directfanz.io/streams | grep -i "error"

# Test API endpoint directly  
curl -s https://directfanz.io/api/livestream

# Check if studio page works
curl -s https://directfanz.io/studio | grep -i "studio"
```

---

## 🎯 **Next Steps**

Based on your specific symptoms, I can:

1. **Fix JavaScript errors** in streaming components
2. **Debug API authentication** issues
3. **Check database connectivity** and data
4. **Verify user permissions** and role-based access
5. **Test full streaming flow** end-to-end

**Please let me know what specific error or behavior you're seeing!** 🔧