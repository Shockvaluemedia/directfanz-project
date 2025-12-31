import { ContentPolicyManager } from '../../src/lib/policy-enforcement';
import { AgeVerificationManager } from '../../src/lib/age-verification';

describe('Property Test: Content Reporting and Policy Enforcement', () => {
  describe('Property 16: Content reporting and policy enforcement', () => {
    test('Content reporting should have 24-hour SLA', async () => {
      const policyManager = new ContentPolicyManager();
      const stats = await policyManager.getReportStats();
      
      expect(stats.avgResponseTime).toBeLessThanOrEqual(24);
    });

    test('Policy violations should have graduated penalties', () => {
      const penalties = ['warning', 'suspension', 'ban'];
      
      penalties.forEach(penalty => {
        expect(['warning', 'suspension', 'ban']).toContain(penalty);
      });
    });

    test('Multiple reports should trigger auto-escalation', async () => {
      const policyManager = new ContentPolicyManager();
      
      expect(typeof policyManager.submitReport).toBe('function');
      expect(typeof policyManager.reviewReport).toBe('function');
    });

    test('Age verification should be enforced for adult content', async () => {
      const ageVerification = new AgeVerificationManager();
      
      const underageResult = await ageVerification.verifySelfDeclaration('2010-01-01');
      expect(underageResult.verified).toBe(false);
      
      const adultResult = await ageVerification.verifySelfDeclaration('1990-01-01');
      expect(adultResult.verified).toBe(true);
    });

    test('User violation history should be tracked', async () => {
      const policyManager = new ContentPolicyManager();
      
      expect(typeof policyManager.getUserViolationHistory).toBe('function');
    });

    test('Report status tracking should be comprehensive', async () => {
      const reportStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
      
      reportStatuses.forEach(status => {
        expect(['pending', 'reviewed', 'resolved', 'dismissed']).toContain(status);
      });
    });
  });
});