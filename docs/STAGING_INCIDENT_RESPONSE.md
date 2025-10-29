# Staging Environment Incident Response Plan

## 🚨 Staging-Specific Emergency Procedures

This document outlines specific incident response procedures for the DirectFanZ Project staging environment, complementing the main incident response plan.

---

## 📋 Staging Environment Details

- **Environment URL**: https://directfanz-project-staging.vercel.app
- **Environment Type**: Preview/Staging deployment on Vercel
- **Purpose**: Pre-production testing and validation
- **Data**: Mock/test data only - no production user data
- **Monitoring**: Automated health checks every 5 minutes

---

## 🎯 Staging-Specific Incident Classifications

### 🔴 **STAGING CRITICAL (P0-S)**
- Staging environment completely down
- Security vulnerabilities detected in staging code
- Staging deployment pipeline broken
- Critical functionality failures blocking production deployment

**Response Time**: < 30 minutes  
**Impact**: Blocks production deployment and testing

### 🟡 **STAGING HIGH (P1-S)**
- Partial staging functionality failures
- Performance degradation in staging
- Staging environment configuration issues
- CI/CD pipeline intermittent failures

**Response Time**: < 2 hours  
**Impact**: Testing and validation affected

### 🟢 **STAGING MEDIUM (P2-S)**
- Non-critical feature issues in staging
- Staging monitoring alerts
- Environment configuration drift
- Test data inconsistencies

**Response Time**: < 8 hours  
**Impact**: Limited testing impact

---

## 🔧 Staging Emergency Response Procedures

### **Immediate Response Commands**

#### **Quick Health Check**
```bash
# Run immediate staging health check
npm run staging:health

# Check staging security status  
npm run staging:security

# View staging monitoring logs
tail -f logs/staging-health.log
```

#### **Emergency Staging Diagnostics**
```bash
# Check staging deployment status
vercel ls --scope directfanz-project

# View recent deployments
vercel inspect --scope directfanz-project

# Check staging environment variables
vercel env ls --environment preview
```

#### **Staging Recovery Actions**
```bash
# Redeploy staging environment
node scripts/deploy-staging.js

# Force fresh staging deployment
vercel deploy --build-env NODE_ENV=production --force

# Rollback to last known good staging deployment
vercel rollback [DEPLOYMENT_URL]
```

---

## 📊 Staging Monitoring & Alerts

### **Automated Monitoring**
- **Health Checks**: Every 5 minutes via `staging-health.js`
- **Security Scans**: On every deployment via GitHub Actions
- **Performance Monitoring**: Response time tracking and alerting

### **Key Metrics Monitored**
- **Availability**: Homepage, API endpoints, authentication
- **Performance**: Response times, loading speeds
- **Security**: Headers validation, endpoint security
- **Configuration**: Environment variables, build status

### **Alert Thresholds**
```javascript
{
  "response_time": {
    "warning": 1000,    // 1 second
    "critical": 2000    // 2 seconds
  },
  "availability": {
    "warning": 99.0,    // 99% uptime
    "critical": 95.0    // 95% uptime
  },
  "failed_checks": {
    "warning": 2,       // 2 consecutive failures
    "critical": 5       // 5 consecutive failures
  }
}
```

---

## 🛠️ Common Staging Issues & Solutions

### **Issue: Staging Environment Down**
**Symptoms**: Health checks failing, 500 errors, no response
**Immediate Actions**:
1. Check Vercel deployment status
2. Review build logs for errors
3. Verify environment variables configuration
4. Redeploy if necessary

```bash
# Diagnostic commands
vercel logs --scope directfanz-project
vercel inspect [DEPLOYMENT_URL]
npm run staging:health
```

### **Issue: Staging Build Failures**
**Symptoms**: Deployment fails, build errors in logs
**Immediate Actions**:
1. Check recent code changes that might cause build issues
2. Verify TypeScript compilation
3. Check for missing dependencies
4. Review environment variable configuration

```bash
# Build diagnostic commands
npm run type-check
npm run lint
npm run build
npm run test
```

### **Issue: Staging Performance Degradation**
**Symptoms**: Slow response times, timeouts
**Immediate Actions**:
1. Run performance diagnostics
2. Check for database connection issues
3. Review recent deployments for performance impacts
4. Monitor resource usage

```bash
# Performance diagnostic commands
npm run staging:health
curl -w "@curl-format.txt" -o /dev/null https://directfanz-project-staging.vercel.app
```

### **Issue: Staging Security Alerts**
**Symptoms**: Security scan failures, missing headers
**Immediate Actions**:
1. Run comprehensive security check
2. Review security configuration
3. Check for exposed sensitive information
4. Validate security headers

```bash
# Security diagnostic commands
npm run staging:security
npm run security:check
npm run validate:secrets
```

---

## 🔄 Staging Recovery Procedures

### **Standard Recovery Workflow**
1. **Identify Issue**: Use monitoring and health checks
2. **Immediate Mitigation**: Apply quick fixes or rollback
3. **Root Cause Analysis**: Investigate underlying cause
4. **Permanent Fix**: Implement proper solution
5. **Validation**: Verify fix and monitor stability

### **Emergency Rollback Procedure**
```bash
# 1. Get list of recent deployments
vercel ls --scope directfanz-project

# 2. Identify last known good deployment
vercel inspect [PREVIOUS_DEPLOYMENT_URL]

# 3. Promote previous deployment (if needed)
# Note: Vercel doesn't have direct rollback, redeploy from last good commit

# 4. Alternative: Redeploy from specific commit
git checkout [LAST_GOOD_COMMIT]
vercel deploy --build-env NODE_ENV=production
git checkout main
```

### **Configuration Recovery**
```bash
# Restore staging environment variables
# 1. Check current config
vercel env ls --environment preview

# 2. Remove problematic variables
vercel env rm [VAR_NAME] preview

# 3. Re-add correct variables from .env.staging
# (Manual process - copy from .env.staging template)

# 4. Redeploy with new config
vercel deploy --build-env NODE_ENV=production
```

---

## 🤝 Coordination with Production Agent

### **Communication Protocol**
When staging issues occur, coordinate with the staging deployment agent:

1. **Immediate Notification**: Update `AGENT_COORDINATION_PLAN.md`
2. **Status Updates**: Regular updates every 30 minutes during incidents
3. **Resolution Confirmation**: Both agents verify fix before closing incident

### **Handoff Procedures**
- **Security Issues**: Security agent leads, staging agent assists
- **Deployment Issues**: Staging agent leads, security agent monitors
- **Performance Issues**: Joint investigation and resolution
- **Configuration Issues**: Joint effort with clear role separation

---

## 📈 Staging Incident Metrics

### **Response Time Targets**
- **Detection**: < 5 minutes (automated monitoring)
- **Initial Response**: < 30 minutes for critical, < 2 hours for high
- **Resolution**: < 2 hours for critical, < 8 hours for high

### **Key Performance Indicators**
- **Mean Time to Detection (MTTD)**: Target < 5 minutes
- **Mean Time to Response (MTTR)**: Target < 30 minutes  
- **Mean Time to Resolution**: Target < 2 hours
- **Staging Availability**: Target > 99.0%

---

## 📚 Staging Environment Documentation

### **Quick Reference Links**
- **Staging URL**: https://directfanz-project-staging.vercel.app
- **Vercel Dashboard**: https://vercel.com/dashboard
- **GitHub Actions**: https://github.com/Shockvaluemedia/directfanz-project/actions
- **Monitoring Reports**: `monitoring/staging/health-report.json`

### **Environment Configuration**
- **Framework**: Next.js 14 with TypeScript
- **Hosting**: Vercel Preview Environment
- **Database**: Mock/staging database (not production)
- **Authentication**: Test credentials only
- **Payment Processing**: Stripe test mode
- **File Storage**: Staging S3 bucket or mock storage

---

## 🔐 Staging Security Considerations

### **Data Security**
- **No Production Data**: Staging uses only mock/test data
- **Test Credentials**: All credentials are for testing only
- **Security Headers**: Same security standards as production
- **Access Control**: Limited to development team

### **Security Monitoring**
- **Automated Scans**: Every deployment
- **Vulnerability Checks**: Dependency scanning
- **Configuration Validation**: Environment security checks
- **Header Validation**: Security headers presence and configuration

---

## 📞 Staging Emergency Contacts

### **Primary Contacts**
- **Security & Infrastructure Agent**: Agent 1 (Current)
- **Staging Deployment Agent**: Agent 2 (Staging Setup)
- **Project Owner**: Demetrius Brooks

### **Escalation Path**
1. **Level 1**: Direct agent coordination
2. **Level 2**: Joint troubleshooting session
3. **Level 3**: Project owner notification
4. **Level 4**: External support (Vercel, service providers)

---

## 🔄 Staging Maintenance Schedule

### **Regular Maintenance**
- **Daily**: Automated health checks and monitoring
- **Weekly**: Security scans and configuration validation  
- **Bi-weekly**: Performance optimization review
- **Monthly**: Comprehensive staging environment audit

### **Maintenance Windows**
- **Preferred Time**: Outside business hours (EST)
- **Duration**: Typically < 30 minutes for routine maintenance
- **Coordination**: Both agents coordinate maintenance activities

---

*This staging incident response plan is maintained alongside the main incident response plan and updated based on staging environment changes and lessons learned from incidents.*

**Last Updated**: 2025-09-22T12:45:00Z  
**Next Review**: 2025-10-22T12:45:00Z  
**Version**: 1.0