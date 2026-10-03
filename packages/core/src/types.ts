export type EmployeeRole = 'receptionist' | 'sales_assistant' | 'ar_clerk' | 'support_technician' | 'purchasing_assistant';
export type HumanRole = 'owner' | 'admin' | 'manager' | 'employee' | 'read_only';
export type ApprovalDecision = 'auto_approve' | 'require_approval' | 'deny';

export interface ApprovalContext {
  role: EmployeeRole;
  actionType: string;
  amountCents?: number;
  customerTier?: string;
  localHour?: number;
  isNewVendor?: boolean;
  recipientCount?: number;
}

export interface PolicyMatcher {
  role?: EmployeeRole;
  actionType?: string;
  minimumAmountCents?: number;
  maximumAmountCents?: number;
  customerTiers?: string[];
  startHour?: number;
  endHour?: number;
  isNewVendor?: boolean;
  minimumRecipientCount?: number;
}

export interface PolicyRule {
  name: string;
  version: number;
  matcher: PolicyMatcher;
  decision: ApprovalDecision;
  approvers: HumanRole[];
  expiresAfterHours: number;
  reason: string;
}

export interface PolicyResult {
  decision: ApprovalDecision;
  policyName: string;
  policyVersion: number;
  approvers: HumanRole[];
  reason: string;
  expiresAfterHours: number;
}
