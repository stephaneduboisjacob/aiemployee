import { describe, expect, it } from 'vitest';
import { canEmployeeUseTool, evaluateApproval, policyMatches } from './policy.js';
import { qualifyHvacCaller } from './hvac.js';

describe('consequential action policies', () => {
  it('auto-approves a $500 quote and routes a higher quote to a human', () => {
    expect(evaluateApproval({ role: 'sales_assistant', actionType: 'send_quote', amountCents: 50_000 }).decision).toBe('auto_approve');
    expect(evaluateApproval({ role: 'sales_assistant', actionType: 'send_quote', amountCents: 50_001 }).approvers).toEqual(['manager']);
    expect(evaluateApproval({ role: 'sales_assistant', actionType: 'send_quote', amountCents: 500_001 }).approvers).toEqual(['owner']);
  });

  it('requires approval for every new-vendor purchase order', () => {
    expect(evaluateApproval({ role: 'purchasing_assistant', actionType: 'vendor_purchase_order', isNewVendor: true }).decision).toBe('require_approval');
  });

  it('keeps employee tools inside their role allowlist', () => {
    expect(canEmployeeUseTool('receptionist', 'book_visit')).toBe(true);
    expect(canEmployeeUseTool('ar_clerk', 'send_quote')).toBe(false);
  });

  it('matches policy conditions by role, customer tier, and local time', () => {
    expect(policyMatches(
      { role: 'sales_assistant', actionType: 'send_quote', customerTier: 'standard', localHour: 19 },
      { name: 'weekday-vip', version: 2, matcher: { role: 'sales_assistant', actionType: 'send_quote', customerTiers: ['vip'], startHour: 8, endHour: 18 }, decision: 'auto_approve', approvers: [], expiresAfterHours: 12, reason: 'fixture' },
    )).toBe(false);
  });

  it('uses recipient counts for campaign approval thresholds', () => {
    expect(evaluateApproval({ role: 'sales_assistant', actionType: 'outbound_campaign', recipientCount: 50 }).policyName).toBe('default-consequential-action');
    expect(evaluateApproval({ role: 'sales_assistant', actionType: 'outbound_campaign', recipientCount: 51 }).policyName).toBe('campaign-over-50');
  });

  it('routes reported carbon monoxide danger to a human instead of booking', () => {
    const result = qualifyHvacCaller({ name: 'Jamie Rivera', phone: '+15125550182', email: 'jamie@example.test', address: '1 Oak St', city: 'Austin', region: 'TX', postalCode: '78745', issue: 'The carbon monoxide alarm is sounding' });
    expect(result.nextAction).toBe('human_safety_escalation');
    expect(result.safetyEscalation).toBe(true);
  });
});
