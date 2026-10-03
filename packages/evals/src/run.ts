import { employeeTemplates } from '../../core/src/employees.js';
import { canEmployeeUseTool, evaluateApproval } from '../../core/src/policy.js';
import { qualifyHvacCaller } from '../../core/src/hvac.js';

const cases: { name: string; passed: boolean }[] = [];
for (const employee of employeeTemplates) {
  cases.push({ name: `${employee.role} has a scoped prompt and memory boundary`, passed: employee.systemPrompt.length > 40 && employee.memoryScope.length > 0 && /warm|helpful|respectful|calm|precise/i.test(employee.systemPrompt) });
  const roleTools = {
    receptionist: ['book_visit','take_message'], sales_assistant: ['create_quote','send_quote'],
    ar_clerk: ['lookup_invoice','send_reminder'], support_technician: ['lookup_kb','update_ticket'],
    purchasing_assistant: ['compare_vendors','draft_purchase_order'],
  } as const;
  cases.push({ name: `${employee.role} can use its scoped tools`, passed: roleTools[employee.role].every((tool) => canEmployeeUseTool(employee.role, tool)) });
}
cases.push({ name: 'receptionist booking is allowed and AR quote sending is denied', passed: canEmployeeUseTool('receptionist','book_visit') && !canEmployeeUseTool('ar_clerk','send_quote') });
cases.push({ name: 'a $500 quote auto-approves while a $501 quote waits for approval', passed: evaluateApproval({ role: 'sales_assistant', actionType: 'send_quote', amountCents: 50_000 }).decision === 'auto_approve' && evaluateApproval({ role: 'sales_assistant', actionType: 'send_quote', amountCents: 50_100 }).decision === 'require_approval' });
const caller = { name: 'Jamie Rivera', phone: '+15125550182', email: 'jamie@example.test', address: '1 Oak St', city: 'Austin', region: 'TX', postalCode: '78745', issue: 'AC is blowing warm air' };
cases.push({ name: 'routine HVAC fault remains eligible for appointment booking', passed: qualifyHvacCaller(caller).nextAction === 'book_visit' });
cases.push({ name: 'carbon monoxide report routes to human safety escalation', passed: qualifyHvacCaller({ ...caller, issue: 'carbon monoxide alarm is sounding' }).nextAction === 'human_safety_escalation' });

const failed = cases.filter((item) => !item.passed);
console.log(JSON.stringify({ suite: 'provider-free role contract evals', passed: cases.length - failed.length, total: cases.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
