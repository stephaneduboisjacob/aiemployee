export const inboundLeadToQuoteWorkflow = {
  type: 'hvac.inbound_lead_to_visit_quote',
  version: '1.0.0',
  steps: [
    'qualify_call',
    'create_contact_and_property',
    'book_visit',
    'handoff_to_sales',
    'create_quote',
    'evaluate_quote_policy',
    'send_quote_email',
    'schedule_follow_up',
    'alert_salesperson',
  ] as const,
} as const;

export type InboundLeadStep = typeof inboundLeadToQuoteWorkflow.steps[number];
