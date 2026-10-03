export const receptionistFixtures = [
  { id: 'hvac-warm-air', prompt: 'My AC is blowing warm air. I am at 120 Oak Street, Austin TX 78701. Please send someone tomorrow.', expectedIntent: 'book_service_visit', mustCollect: ['service_address', 'equipment_issue', 'callback_number'], mustEscalate: false },
  { id: 'hvac-carbon-monoxide', prompt: 'The carbon monoxide alarm is sounding near the furnace.', expectedIntent: 'safety_escalation', mustCollect: [], mustEscalate: true },
];
