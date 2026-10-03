import type { ApprovalContext, PolicyResult, PolicyRule } from './types.js';

export const defaultPolicyRules: readonly PolicyRule[] = [
  { name: 'new-vendor-po', version: 1, matcher: { actionType: 'vendor_purchase_order', isNewVendor: true }, decision: 'require_approval', approvers: ['owner', 'manager'], expiresAfterHours: 24, reason: 'Purchase orders to a new vendor always require approval.' },
  { name: 'quote-under-500', version: 1, matcher: { role: 'sales_assistant', actionType: 'send_quote', maximumAmountCents: 50_000 }, decision: 'auto_approve', approvers: [], expiresAfterHours: 24, reason: 'Quote is at or below $500.' },
  { name: 'quote-500-to-5000', version: 1, matcher: { role: 'sales_assistant', actionType: 'send_quote', minimumAmountCents: 50_001, maximumAmountCents: 500_000 }, decision: 'require_approval', approvers: ['manager'], expiresAfterHours: 24, reason: 'Salesperson approval is required for quotes above $500 through $5,000.' },
  { name: 'quote-over-5000', version: 1, matcher: { role: 'sales_assistant', actionType: 'send_quote', minimumAmountCents: 500_001 }, decision: 'require_approval', approvers: ['owner'], expiresAfterHours: 24, reason: 'Owner approval is required for quotes above $5,000.' },
  { name: 'refund-under-100', version: 1, matcher: { role: 'ar_clerk', actionType: 'refund', maximumAmountCents: 10_000 }, decision: 'auto_approve', approvers: [], expiresAfterHours: 24, reason: 'Refund is at or below $100.' },
  { name: 'refund-over-100', version: 1, matcher: { role: 'ar_clerk', actionType: 'refund', minimumAmountCents: 10_001 }, decision: 'require_approval', approvers: ['manager'], expiresAfterHours: 24, reason: 'Manager approval is required for refunds above $100.' },
  { name: 'campaign-over-50', version: 1, matcher: { actionType: 'outbound_campaign', minimumRecipientCount: 51 }, decision: 'require_approval', approvers: ['owner'], expiresAfterHours: 24, reason: 'Owner approval is required for campaigns to more than 50 recipients.' },
];

export function policyMatches(context: ApprovalContext, rule: PolicyRule): boolean {
  const matcher = rule.matcher;
  if (matcher.role && matcher.role !== context.role) return false;
  if (matcher.actionType && matcher.actionType !== context.actionType) return false;
  if (matcher.minimumAmountCents !== undefined && (context.amountCents ?? -1) < matcher.minimumAmountCents) return false;
  if (matcher.maximumAmountCents !== undefined && (context.amountCents ?? Number.POSITIVE_INFINITY) > matcher.maximumAmountCents) return false;
  if (matcher.customerTiers && (!context.customerTier || !matcher.customerTiers.includes(context.customerTier))) return false;
  if (matcher.startHour !== undefined && (context.localHour === undefined || context.localHour < matcher.startHour)) return false;
  if (matcher.endHour !== undefined && (context.localHour === undefined || context.localHour >= matcher.endHour)) return false;
  if (matcher.isNewVendor !== undefined && matcher.isNewVendor !== context.isNewVendor) return false;
  if (matcher.minimumRecipientCount !== undefined && (context.recipientCount ?? 0) < matcher.minimumRecipientCount) return false;
  return true;
}

export function evaluateApproval(context: ApprovalContext, rules: readonly PolicyRule[] = defaultPolicyRules): PolicyResult {
  const rule = rules.find((candidate) => policyMatches(context, candidate));
  if (!rule) return { decision: 'require_approval', policyName: 'default-consequential-action', policyVersion: 1, approvers: ['owner'], expiresAfterHours: 24, reason: 'No auto-approval rule matches this consequential action.' };
  return { decision: rule.decision, policyName: rule.name, policyVersion: rule.version, approvers: rule.approvers, expiresAfterHours: rule.expiresAfterHours, reason: rule.reason };
}

export function canEmployeeUseTool(role: string, tool: string): boolean {
  const allowlist: Record<string, readonly string[]> = {
    receptionist: ['lookup_customer', 'create_contact', 'check_calendar', 'book_visit', 'take_message', 'handoff'],
    sales_assistant: ['lookup_customer', 'create_quote', 'send_quote', 'update_deal', 'schedule_follow_up', 'handoff'],
    ar_clerk: ['lookup_invoice', 'record_payment', 'send_reminder', 'escalate_dispute'],
    support_technician: ['lookup_kb', 'update_ticket', 'escalate_ticket'],
    purchasing_assistant: ['check_inventory', 'compare_vendors', 'draft_purchase_order', 'handoff'],
  };
  return allowlist[role]?.includes(tool) ?? false;
}
