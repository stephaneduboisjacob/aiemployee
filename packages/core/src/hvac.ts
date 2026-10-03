export interface HvacCallerDetails {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  issue: string;
  preferredWindow?: string;
}

export interface HvacQualification {
  safetyEscalation: boolean;
  safetyReason?: string;
  qualification: string[];
  nextAction: 'book_visit' | 'human_safety_escalation';
}

export function qualifyHvacCaller(caller: HvacCallerDetails): HvacQualification {
  const safetyReason = /carbon monoxide|\bco alarm|gas odor|gas leak|smell(?:ing)? gas|smoke|electrical burning/i.exec(caller.issue)?.[0];
  return {
    safetyEscalation: Boolean(safetyReason),
    ...(safetyReason ? { safetyReason } : {}),
    qualification: ['caller_name','callback_number','service_address','equipment_issue','preferred_window'],
    nextAction: safetyReason ? 'human_safety_escalation' : 'book_visit',
  };
}
