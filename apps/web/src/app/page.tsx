'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Activity, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, Clock3, Download,
  FileText, Filter, Headphones, Home, Inbox, LayoutDashboard, MoreHorizontal, Phone, Play, Plus,
  Search, Settings2, ShieldCheck, Sparkles, Users,
} from 'lucide-react';

type Dashboard = {
  employees: { id: string; name: string; role: string; state: string; avatar: string; memory_scope: string[]; working_hours: Record<string, unknown>; escalation_contact?: string; approval_defaults: Record<string, string> }[];
  tasks: { id: string; title: string; state: string; priority: string; created_at: string }[];
  appointments: { id: string; service_code: string; starts_at: string; first_name: string; last_name: string; address_line1?: string; city?: string }[];
  quotes: { id: string; quote_number: string; amount_cents: number; state: string; created_at: string }[];
  interactions: { id: string; channel: string; direction: string; outcome: string; created_at: string; trace_id: string }[];
  audit: { id: string; action: string; target: string; actor_type: string; trace_id: string; occurred_at: string; entry_hash: string }[];
  contacts: { id: string; first_name: string; last_name: string; email?: string; phone?: string; customer_tier: string; created_at: string }[];
  approvals: { id: string; action_type: string; decision: string; policy_name: string; quote_number?: string; amount_cents?: number; first_name?: string; last_name?: string; created_at: string }[];
  totals: { inbound_calls: number; contacts: number; quote_count: number; quote_value_cents: number };
  auditIntegrity: boolean;
};
type Workflow = { run: { id: string; state: string; trace_id: string; input: { transcript?: string; caller?: { name: string } } }; steps: { step_key: string; state: string; attempts: number; last_error?: string }[]; events: { event_type: string; step_key?: string; created_at: string }[] };
type Section = 'Overview' | 'Task inbox' | 'Customers' | 'Schedule' | 'Employees' | 'Audit log';

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';
const VOICE = process.env.NEXT_PUBLIC_VOICE_ORIGIN ?? '';
const nav: { label: Section; icon: typeof Home }[] = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'Task inbox', icon: Inbox }, { label: 'Customers', icon: Users },
  { label: 'Schedule', icon: CalendarDays }, { label: 'Employees', icon: Sparkles }, { label: 'Audit log', icon: ShieldCheck },
];
const roleNames: Record<string, string> = { receptionist: 'Receptionist', sales_assistant: 'Sales assistant', ar_clerk: 'AR clerk', support_technician: 'Support technician', purchasing_assistant: 'Purchasing' };
const roleArt: Record<string, string> = {
  receptionist: '/product/roles/receptionist.png',
  sales_assistant: '/product/roles/sales-assistant.png',
  ar_clerk: '/product/roles/ar-clerk.png',
  support_technician: '/product/roles/support-technician.png',
  purchasing_assistant: '/product/roles/purchasing-assistant.png',
};
const steps = ['Qualify caller', 'Create contact', 'Book service visit', 'Handoff to sales', 'Draft quote', 'Check approval', 'Email quote', 'Schedule follow-up', 'Alert salesperson'];
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(cents) / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

export default function HomePage() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [section, setSection] = useState<Section>('Overview');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async (auth: string) => {
    const response = await fetch(`${API}/api/v1/dashboard`, { headers: { Authorization: `Bearer ${auth}` }, cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the workspace');
    setData(await response.json());
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/v1/demo/session`, { cache: 'no-store' }).then((r) => r.json()).then(async (session) => {
      if (!alive || !session.token) return;
      setToken(session.token);
      await load(session.token);
    }).catch(() => setNotice('API is starting. Refresh when health is green.'));
    return () => { alive = false; };
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => void load(token).catch(() => {}), 3000);
    return () => window.clearInterval(timer);
  }, [token, load]);

  useEffect(() => {
    if (!workflow || ['completed', 'failed'].includes(workflow.run.state)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${API}/api/v1/workflows/${workflow.run.id}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (response.ok) setWorkflow(await response.json());
      } catch { /* status recovers on the next poll */ }
    }, 900);
    return () => window.clearInterval(timer);
  }, [workflow, token]);

  const runDemo = async () => {
    if (!token || starting) return;
    setStarting(true);
    setNotice('Opening a call with the receptionist…');
    try {
      const response = await fetch(`${VOICE}/voice/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller: { name: 'Jamie Rivera', phone: '+15125550182', email: 'jamie.rivera@example.test', address: '4408 Cedar Bend Dr', city: 'Austin', region: 'TX', postalCode: '78745', issue: 'The AC is running but blowing warm air', preferredWindow: 'weekday morning' },
          transcript: 'Hi, this is Jamie Rivera. Our air conditioner is running but blowing warm air. I am at 4408 Cedar Bend Drive in Austin. Can someone come tomorrow morning? My email is jamie.rivera@example.test.',
        }),
      });
      if (!response.ok) throw new Error('Call could not be started');
      const started = await response.json();
      setWorkflow({ run: { id: started.id, state: 'queued', trace_id: started.traceId, input: {} }, steps: [], events: [] });
      setSection('Overview');
      setNotice('Call qualified. Receptionist is booking the visit and handing the quote to Sales.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to start the demo call.');
    } finally { setStarting(false); }
  };

  const decideApproval = async (id: string, decision: 'approve' | 'deny') => {
    if (decision === 'deny' && !window.confirm('Deny this quote? A reason is required.')) return;
    const reason = decision === 'deny' ? window.prompt('Reason for denial')?.trim() : undefined;
    if (decision === 'deny' && !reason) return;
    const response = await fetch(`${API}/api/v1/approvals/${id}/decision`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, reason }) });
    if (response.ok) { await load(token); setNotice(`Quote ${decision === 'approve' ? 'approved' : 'denied'}. The workflow has been updated.`); }
    else setNotice('Could not record that approval decision.');
  };

  const changeEmployeeState = async (employeeId: string, state: 'active' | 'paused' | 'fired') => {
    const response = await fetch(`${API}/api/v1/employees/${employeeId}/state`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
    if (response.ok) await load(token);
    else setNotice('Could not update the employee.');
  };

  const hireRole = async (role: string) => {
    const response = await fetch(`${API}/api/v1/employees`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    if (response.ok) { await load(token); setNotice(`${roleNames[role]} is hired and active.`); }
    else setNotice('Could not hire this employee.');
  };

  const completedSteps = useMemo(() => workflow?.steps.filter((item) => item.state === 'completed').length ?? 0, [workflow]);
  const pendingTasks = (data?.tasks.filter((task) => !['completed', 'cancelled', 'waiting_approval'].includes(task.state)).length ?? 0) + (data?.approvals.length ?? 0);
  const bookedVisits = data?.appointments.length ?? 0;
  const revenue = data?.totals.quote_value_cents ?? 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Image src="/brand/ai-employee-os-mark.svg" alt="" width={28} height={28} priority /></div><div><b>AI Employee OS</b><span>HVAC FIELD SERVICE</span></div></div>
        <div className="org-switch"><div className="org-avatar">C</div><div className="org-copy"><strong>CoolAir HVAC</strong><span>Residential · Austin, TX</span></div><ChevronDown size={15} /></div>
        <div className="side-caption">WORKSPACE</div>
        <nav className="primary-nav">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${section === label ? 'active' : ''}`} onClick={() => setSection(label)}><Icon size={17} /><span>{label}</span>{label === 'Task inbox' && pendingTasks > 0 && <em>{pendingTasks}</em>}</button>)}</nav>
        <div className="side-caption tools-caption">CHANNELS</div>
        <button className="nav-item channel-item"><Image src="/product/channels/phone.png" alt="" width={25} height={25} /><span>Phone</span><span className="live-dot" /></button>
        <button className="nav-item channel-item"><Image src="/product/channels/email.png" alt="" width={25} height={25} /><span>Email</span><span className="connected-dot" /></button>
        <button className="nav-item channel-item"><Image src="/product/channels/calendar.png" alt="" width={25} height={25} /><span>Calendar</span><span className="connected-dot" /></button>
        <div className="sidebar-spacer" />
        <div className="plan-card"><div className="plan-top"><span>PLANS FROM</span><span className="plan-pill">HVAC</span></div><strong>$300 / location</strong><div className="plan-bar"><i /></div><span className="plan-meta">Seats, minutes, and workflows scale by plan.</span><button onClick={() => setNotice('Stripe billing is not connected in this demo tenant.')}>Billing details <ArrowRight size={13} /></button></div>
        <button className="nav-item settings-item"><Settings2 size={17} /><span>Settings</span></button>
        <div className="user-profile"><div className="user-avatar">MO</div><div><strong>Morgan Owner</strong><span>Owner</span></div><MoreHorizontal size={18} /></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="crumbs"><span>CoolAir HVAC</span><span className="slash">/</span><strong>{section}</strong></div><div className="top-actions"><div className="health-indicator"><span className={data ? '' : 'unhealthy'} /> {data ? 'API connected' : 'Connecting to API'}</div><button className="icon-button" aria-label="Search"><Search size={17} /></button><button className="icon-button notification" aria-label="Notifications"><Bell size={17} /><i /></button><div className="user-avatar small">MO</div></div></header>

        <div className="content">
          <div className={`welcome-row ${section === 'Overview' ? 'overview-welcome' : ''}`}><div><div className="eyebrow"><span className="eyebrow-dot" /> {section === 'Overview' ? 'HVAC OPERATIONS · LIVE WORKSPACE' : new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()}</div><h1>{section === 'Overview' ? 'Good morning, Morgan' : section}</h1><p>{section === 'Overview' ? 'Your digital team is keeping service work moving, from first call to follow-up.' : section === 'Task inbox' ? 'Approvals, handoffs, and work that needs a human.' : `A clear view of ${section.toLowerCase()} across your service team.`}</p>{section === 'Overview' && <div className="hero-trust"><span><i /> Secure by design</span><span>·</span><span>Every action audited</span></div>}</div><button className={`demo-button ${starting ? 'loading' : ''}`} onClick={runDemo} disabled={starting || !token}><Play size={15} fill="currentColor" />{starting ? 'Starting workflow…' : 'Run inbound demo'}</button></div>

          {notice && <div className="notice"><Sparkles size={16} /><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}

          {section === 'Overview' ? <>
          <div className="stat-grid">
            <Stat icon={Inbox} label="Open tasks" value={String(pendingTasks).padStart(2, '0')} change={`${data?.approvals.length ?? 0} approvals waiting`} tone="violet" />
            <Stat icon={CalendarDays} label="Visits booked" value={String(bookedVisits).padStart(2, '0')} change="Upcoming service visits" tone="blue" />
            <Stat icon={FileText} label="Quotes approved" value={String(data?.totals.quote_count ?? 0).padStart(2, '0')} change={`${money(revenue)} approved value`} tone="amber" />
            <Stat icon={Activity} label="Inbound calls" value={String(data?.totals.inbound_calls ?? 0).padStart(2, '0')} change={`${data?.totals.contacts ?? 0} contacts in CRM`} tone="green" />
          </div>

          <div className="section-heading"><div><h2>Team activity</h2><p>Your digital employees, working alongside your people.</p></div><button className="text-action" onClick={() => setSection('Employees')}>View team <ArrowRight size={14} /></button></div>
          <div className="employee-grid">
            {(data?.employees ?? []).map((employee, index) => <EmployeeCard key={employee.id} employee={employee} active={index === 0 && Boolean(workflow && !['completed', 'failed'].includes(workflow.run.state))} />)}
            <button className="hire-card" onClick={() => setSection('Employees')}><span><Plus size={18} /></span><strong>Hire an employee</strong><small>Add the next role to your team</small></button>
          </div>

          <div className="lower-grid">
            <section className="panel workflow-panel">
              <div className="panel-header"><div><div className="panel-title"><h2>{workflow ? 'Inbound call workflow' : 'Workflow activity'}</h2>{workflow && <span className={`status-pill ${workflow.run.state}`}>{workflow.run.state.replace('_', ' ')}</span>}</div><p>{workflow ? `Trace ${workflow.run.trace_id.slice(0, 8)} · Receptionist → Sales assistant` : 'A live view of work moving between employees.'}</p></div><button className="icon-button small-icon" aria-label="More"><MoreHorizontal size={17} /></button></div>
              {workflow ? <div className="workflow-body">{workflow.run.input.transcript && <div className="transcript-box"><span>CALL TRANSCRIPT · RETAINED BY DEMO SETTING</span><p>{workflow.run.input.transcript}</p></div>}<div className="workflow-progress"><div><span>{completedSteps} of {steps.length} steps complete</span><b>{Math.round(completedSteps / steps.length * 100)}%</b></div><div className="progress-track"><i style={{ width: `${completedSteps / steps.length * 100}%` }} /></div></div><div className="workflow-steps">{steps.map((label, index) => { const step = workflow.steps[index]; const done = step?.state === 'completed'; const active = step?.state === 'running' || (!step && index === completedSteps && !['completed', 'failed', 'waiting_approval'].includes(workflow.run.state)); return <div className={`workflow-step ${done ? 'done' : active ? 'active' : ''}`} key={label}><span className="step-icon">{done ? <Check size={13} /> : active ? <span className="mini-spinner" /> : <span>{String(index + 1).padStart(2, '0')}</span>}</span><div className="step-copy"><strong>{label}</strong>{step?.last_error && <small className="error-copy">Retrying: {step.last_error}</small>}{step?.attempts > 1 && <small>Resumed · attempt {step.attempts}</small>}</div><span className="step-status">{done ? 'Complete' : step?.state === 'waiting_approval' ? 'Approval needed' : active ? 'In progress' : 'Queued'}</span></div>; })}</div>{workflow.run.state === 'completed' && <div className="success-banner"><Check size={15} /> Contact created · visit booked · quote emailed · salesperson alerted</div>}</div> : <EmptyWorkflow onRun={runDemo} />}
            </section>

            <section className="panel inbox-panel">
              <div className="panel-header"><div><h2>Needs your attention</h2><p>Work that’s ready for a human decision.</p></div><button className="filter-button"><Filter size={14} /> Filter</button></div>
              <div className="attention-list">{data?.approvals.slice(0, 2).map((approval) => <div className="attention-item" key={approval.id}><span className="attention-icon high"><ShieldCheck size={15} /></span><div className="attention-copy"><strong>{approval.quote_number ?? approval.action_type} · {money(approval.amount_cents ?? 0)}</strong><span>{approval.policy_name} · {dateTime(approval.created_at)}</span></div><button className="mini-approve" onClick={() => void decideApproval(approval.id, 'approve')}>Approve</button></div>)}{(data?.tasks.filter((task) => !['completed', 'cancelled'].includes(task.state)).slice(0, 4) ?? []).length ? data?.tasks.filter((task) => !['completed', 'cancelled','waiting_approval'].includes(task.state)).slice(0, 4).map((task) => <div className="attention-item" key={task.id}><span className={`attention-icon ${task.priority}`}><Bell size={15} /></span><div className="attention-copy"><strong>{task.title}</strong><span>{task.state.replace('_', ' ')} · {dateTime(task.created_at)}</span></div><ArrowRight size={15} className="attention-arrow" /></div>) : !data?.approvals.length && <div className="empty-attention"><div className="empty-check"><Check size={18} /></div><strong>You’re all caught up</strong><span>Approvals and escalations will show up here.</span></div>}</div>
              <button className="panel-footer" onClick={() => setSection('Task inbox')}>Open task inbox <ArrowRight size={14} /></button>
            </section>
          </div>

          <div className="lower-grid second-row">
            <section className="panel appointments-panel"><div className="panel-header"><div><h2>Upcoming visits</h2><p>Booked by the receptionist, ready for your team.</p></div><button className="text-action" onClick={() => setSection('Schedule')}>Full calendar <ArrowRight size={14} /></button></div>{data?.appointments.length ? <div className="visit-list">{data.appointments.slice(0, 4).map((visit) => <div className="visit-item" key={visit.id}><div className="visit-date"><strong>{new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(new Date(visit.starts_at))}</strong><span>{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(visit.starts_at)).toUpperCase()}</span></div><div className="visit-main"><strong>{visit.first_name} {visit.last_name}</strong><span>{visit.service_code.replace('_', ' ')} · {visit.address_line1 ?? 'Service location'}, {visit.city ?? 'Austin'}</span></div><div className="visit-time"><Clock3 size={13} />{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(visit.starts_at))}</div></div>)}</div> : <div className="empty-inline"><CalendarDays size={19} /><span>No visits booked yet. Run a demo call to see the booking flow.</span></div>}</section>
            <section className="panel audit-panel"><div className="panel-header"><div><h2>Audit trail</h2><p>Every action has a traceable history.</p></div><button className="text-action" onClick={() => setSection('Audit log')}>Explore <ArrowRight size={14} /></button></div><div className="audit-list">{(data?.audit ?? []).slice(0, 4).map((entry) => <div className="audit-item" key={entry.id}><span className="audit-mark"><ShieldCheck size={13} /></span><div><strong>{entry.action.replaceAll('_', ' ')}</strong><span>{entry.target} · {dateTime(entry.occurred_at)}</span></div><span className="hash-mark" title={entry.entry_hash}>#</span></div>)}</div><div className={`audit-integrity ${data?.auditIntegrity ? '' : 'invalid'}`}><ShieldCheck size={14} /><span>{data?.auditIntegrity ? 'Hash chain verified' : 'Hash chain invalid'}</span><i /></div></section>
          </div>
          </> : <SectionView section={section} data={data} onApproval={decideApproval} onEmployeeState={changeEmployeeState} onHire={hireRole} />}
          <footer className="page-footer"><span>AI Employee OS <b>·</b> HVAC Field Service</span><span><span className="footer-live" /> Local demo environment <b>·</b> Data stays in your workspace</span></footer>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, change, tone }: { icon: typeof Home; label: string; value: string; change: string; tone: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={16} /></span></div><strong className="stat-value">{value}</strong><div className="stat-change">{change.startsWith('↑') ? <ArrowUpRight size={13} className="change-up" /> : null}{change}</div></div>;
}

function EmployeeCard({ employee, active }: { employee: Dashboard['employees'][number]; active: boolean }) {
  const styleIndex = ['receptionist','sales_assistant','ar_clerk','support_technician','purchasing_assistant'].indexOf(employee.role);
  return <div className={`employee-card e${styleIndex}`}><div className="employee-card-top"><div className="employee-avatar">{roleArt[employee.role] ? <Image src={roleArt[employee.role]} alt="" width={48} height={48} /> : employee.avatar}</div><button className="icon-button employee-more" aria-label={`More about ${employee.name}`}><MoreHorizontal size={16} /></button></div><div className="employee-info"><strong>{employee.name}</strong><span>{roleNames[employee.role] ?? employee.role}</span></div><div className="employee-card-bottom"><span className={`employee-state ${employee.state}`}>{active && employee.state === 'active' ? <><i className="working-pulse" /> Working now</> : <><i /> {employee.state === 'active' ? 'Ready' : employee.state}</>}</span><span className="employee-hours">Mon–Fri · 8–5</span></div></div>;
}

function SectionView({ section, data, onApproval, onEmployeeState, onHire }: { section: Section; data: Dashboard | null; onApproval: (id: string, decision: 'approve' | 'deny') => void; onEmployeeState: (id: string, state: 'active' | 'paused' | 'fired') => void; onHire: (role: string) => void }) {
  const [filter, setFilter] = useState('');
  const exportAudit = (format: 'json' | 'csv') => {
    const entries = data?.audit ?? [];
    const body = format === 'json' ? JSON.stringify(entries, null, 2) : ['id,actor,action,target,trace_id,occurred_at,entry_hash', ...entries.map((row) => [row.id,row.actor_type,row.action,row.target,row.trace_id,row.occurred_at,row.entry_hash].map((value) => `"${String(value).replaceAll('"','""')}"`).join(','))].join('\n');
    const blob = new Blob([body], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `aios-audit.${format}`; link.click(); URL.revokeObjectURL(url);
  };
  if (!data) return <div className="panel section-panel"><div className="empty-inline">Connecting to the workspace…</div></div>;
  if (section === 'Task inbox') return <div className="section-stack">
    <section className="panel section-panel"><div className="section-panel-head"><div><h2>Pending approvals</h2><p>Each decision is recorded with the policy version and approver.</p></div></div>
      {data.approvals.length ? data.approvals.map((approval) => <div className="queue-row" key={approval.id}><div className="queue-icon approval"><ShieldCheck size={17} /></div><div className="queue-copy"><strong>{approval.quote_number ?? approval.action_type} · {money(approval.amount_cents ?? 0)}</strong><span>{approval.policy_name} · {approval.first_name ?? ''} {approval.last_name ?? ''} · {dateTime(approval.created_at)}</span></div><button className="button-approve" onClick={() => onApproval(approval.id, 'approve')}>Approve</button><button className="button-deny" onClick={() => onApproval(approval.id, 'deny')}>Deny</button></div>) : <div className="section-empty illustrated-empty"><Image src="/product/empty/task-inbox.webp" alt="" width={180} height={120} /><span>No approvals are waiting.</span></div>}
    </section>
    <section className="panel section-panel"><div className="section-panel-head"><div><h2>Tasks and handoffs</h2><p>Work owned by a digital employee or assigned to a person.</p></div><button className="filter-button"><Filter size={14} /> Status</button></div>
      {data.tasks.length ? data.tasks.map((task) => <div className="queue-row" key={task.id}><div className={`queue-icon ${task.priority}`}><Inbox size={16} /></div><div className="queue-copy"><strong>{task.title}</strong><span>{task.state.replaceAll('_',' ')} · {dateTime(task.created_at)}</span></div><span className={`status-pill ${task.state}`}>{task.state.replaceAll('_',' ')}</span></div>) : <div className="section-empty illustrated-empty"><Image src="/product/empty/task-inbox.webp" alt="" width={180} height={120} /><span>No open tasks.</span></div>}
    </section>
  </div>;
  if (section === 'Customers') {
    const contacts = data.contacts.filter((contact) => `${contact.first_name} ${contact.last_name} ${contact.email ?? ''} ${contact.phone ?? ''}`.toLowerCase().includes(filter.toLowerCase()));
    return <section className="panel section-panel"><div className="section-panel-head"><div><h2>Customer memory</h2><p>Contacts created from calls, messages, and team activity.</p></div><label className="table-search"><Search size={14} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search customers" /></label></div>{contacts.length ? <div className="data-table"><div className="table-head customer-cols"><span>Customer</span><span>Phone / email</span><span>Tier</span><span>Added</span></div>{contacts.map((contact) => <div className="table-row customer-cols" key={contact.id}><strong>{contact.first_name} {contact.last_name}</strong><span>{contact.phone}<small>{contact.email}</small></span><span className="tier-chip">{contact.customer_tier}</span><span>{dateTime(contact.created_at)}</span></div>)}</div> : <div className="section-empty illustrated-empty"><Image src="/product/empty/customer-list.webp" alt="" width={220} height={146} /><span>{filter ? 'No customers match that search.' : 'No customer contacts yet. They will appear here as calls come in.'}</span></div>}</section>;
  }
  if (section === 'Schedule') return <section className="panel section-panel"><div className="section-panel-head"><div><h2>Service calendar</h2><p>Upcoming visits scheduled for the HVAC team.</p></div><button className="filter-button"><CalendarDays size={14} /> Upcoming</button></div>{data.appointments.length ? data.appointments.map((visit) => <div className="queue-row" key={visit.id}><div className="visit-date"><strong>{new Intl.DateTimeFormat('en-US', { day:'2-digit' }).format(new Date(visit.starts_at))}</strong><span>{new Intl.DateTimeFormat('en-US', { month:'short' }).format(new Date(visit.starts_at)).toUpperCase()}</span></div><div className="queue-copy"><strong>{visit.first_name} {visit.last_name} · {visit.service_code.replaceAll('_',' ')}</strong><span>{visit.address_line1}, {visit.city} · {dateTime(visit.starts_at)}</span></div><span className="status-pill completed">Booked</span></div>) : <div className="section-empty illustrated-empty"><Image src="/product/empty/schedule.webp" alt="" width={220} height={146} /><span>No visits yet. A receptionist can book the first one from an inbound call.</span></div>}</section>;
  if (section === 'Employees') return <div className="employee-page-grid">{data.employees.map((employee) => <section className="panel employee-detail" key={employee.id}><EmployeeCard employee={employee} active={false} /><div className="detail-lines"><div><span>Owner</span><strong>Morgan Owner</strong></div><div><span>Memory scope</span><strong>{(employee.memory_scope ?? []).join(', ')}</strong></div><div><span>Escalation</span><strong>{employee.escalation_contact ?? 'Company owner'}</strong></div><div><span>Approval defaults</span><strong>{Object.entries(employee.approval_defaults ?? {}).map(([key,value]) => `${key}: ${value}`).join(' · ') || 'Uses organization policy'}</strong></div></div><div className="employee-actions">{employee.state === 'fired' ? <button className="button-approve" onClick={() => onHire(employee.role)}>Hire again</button> : <><button className="filter-button" onClick={() => onEmployeeState(employee.id, employee.state === 'paused' ? 'active' : 'paused')}>{employee.state === 'paused' ? 'Resume' : 'Pause'}</button><button className="button-deny" onClick={() => onEmployeeState(employee.id, 'fired')}>Fire</button></>}</div></section>)}<div className="panel hire-role-panel"><span className="hire-mark"><Plus size={19} /></span><h2>Hire from the HVAC team</h2><p>Choose a role template with a defined prompt, tool allowlist, memory scope, and approval defaults.</p>{['receptionist','sales_assistant','ar_clerk','support_technician','purchasing_assistant'].map((role) => <button key={role} onClick={() => onHire(role)}><span>{roleNames[role]}</span><ArrowRight size={14} /></button>)}</div></div>;
  const filteredAudit = data.audit.filter((entry) => `${entry.action} ${entry.target} ${entry.actor_type}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="panel section-panel"><div className="section-panel-head"><div><h2>Immutable audit history</h2><p>{data.auditIntegrity ? 'Hash chain verified for the visible tenant.' : 'Hash chain verification failed.'}</p></div><div className="audit-tools"><label className="table-search"><Search size={14} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by action or target" /></label><button className="filter-button" onClick={() => exportAudit('json')}><Download size={13} /> JSON</button><button className="filter-button" onClick={() => exportAudit('csv')}><Download size={13} /> CSV</button></div></div>{filteredAudit.length ? <div className="data-table"><div className="table-head audit-cols"><span>Action / target</span><span>Actor</span><span>Trace ID</span><span>Time</span><span>Entry hash</span></div>{filteredAudit.map((entry) => <div className="table-row audit-cols" key={entry.id}><strong>{entry.action.replaceAll('_',' ')}<small>{entry.target}</small></strong><span>{entry.actor_type}</span><span className="mono">{entry.entry_hash.slice(0,12)}…</span><span>{dateTime(entry.occurred_at)}</span><span className="mono" title={entry.entry_hash}>{entry.entry_hash.slice(0,12)}…</span></div>)}</div> : <div className="section-empty illustrated-empty"><Image src="/product/empty/audit-history-verified.webp" alt="" width={240} height={160} /><span>{filter ? 'No audit events match that filter.' : 'Audit events will appear here as your team works.'}</span></div>}<div className={`audit-integrity ${data.auditIntegrity ? '' : 'invalid'}`}><ShieldCheck size={14} /><span>{data.auditIntegrity ? 'Hash chain verified' : 'Hash chain invalid'}</span></div></section>;
}

function EmptyWorkflow({ onRun }: { onRun: () => void }) {
  return <div className="empty-workflow"><Image className="workflow-art" src="/product/empty/overview-workflow-idle.webp" alt="" width={400} height={280} /><strong>See the full workflow in action</strong><span>One call. Nine steps. The whole team in sync.</span><button onClick={onRun}><Play size={13} fill="currentColor" /> Start a sample call</button><div className="workflow-flow"><span><Phone size={12} /> Call</span><i /><span><CalendarDays size={12} /> Visit</span><i /><span><FileText size={12} /> Quote</span><i /><span><Bell size={12} /> Alert</span></div></div>;
}
