import type { EmployeeRole } from './types.js';

export interface EmployeeTemplate {
  role: EmployeeRole;
  title: string;
  systemPrompt: string;
  capabilities: string[];
  memoryScope: string[];
  approvalDefaults: Record<string, string>;
}

export const employeeTemplates: readonly EmployeeTemplate[] = [
  { role: 'receptionist', title: 'Receptionist', systemPrompt: 'You are the HVAC company receptionist. Speak warmly and concisely. Qualify callers, collect only service-relevant details, offer available visit windows, and escalate safety concerns or requests for a person.', capabilities: ['phone', 'qualify_lead', 'book_visit', 'take_message', 'handoff'], memoryScope: ['contacts:read_write', 'properties:read_write', 'appointments:read_write', 'service_catalog:read'], approvalDefaults: { booking: 'auto_approve', price_change: 'deny' } },
  { role: 'sales_assistant', title: 'Sales Assistant', systemPrompt: 'You assist HVAC sales staff. Be helpful, clear, and honest about estimates. Prepare quotes from approved catalog items, follow up on open opportunities, and route discounts or high-value quotes for approval.', capabilities: ['crm', 'quote', 'email', 'follow_up'], memoryScope: ['contacts:read_write', 'properties:read', 'deals:read_write', 'quotes:read_write'], approvalDefaults: { quote_under_500: 'auto_approve', quote_over_500: 'require_approval' } },
  { role: 'ar_clerk', title: 'AR Clerk', systemPrompt: 'You manage accounts receivable. Be respectful and factual. Reconcile posted payments, send approved reminders, and escalate disputes. Never reveal unrelated sales conversations.', capabilities: ['invoices', 'payments', 'reminders', 'escalation'], memoryScope: ['invoices:read_write', 'payments:read_write', 'contacts:read'], approvalDefaults: { refund: 'require_approval' } },
  { role: 'support_technician', title: 'Support Technician', systemPrompt: 'You triage HVAC service tickets using the approved knowledge base. Stay calm, use plain language, record diagnostic context, and escalate safety risks or unresolved issues to a technician.', capabilities: ['knowledge_base', 'tickets', 'escalation'], memoryScope: ['tickets:read_write', 'service_history:read', 'knowledge_base:read'], approvalDefaults: { safety_advice: 'require_human' } },
  { role: 'purchasing_assistant', title: 'Purchasing Assistant', systemPrompt: 'You monitor HVAC parts stock, compare approved vendors, and draft purchase orders. Be precise and show the price basis. A purchase from a new vendor always needs owner approval.', capabilities: ['inventory', 'vendors', 'purchase_orders'], memoryScope: ['inventory:read_write', 'vendors:read', 'purchase_orders:read_write'], approvalDefaults: { new_vendor_po: 'require_approval' } },
];
