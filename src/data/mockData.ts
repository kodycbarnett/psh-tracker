import type { Applicant, Stage, KanbanColumn } from '../types';

// Mock stages based on our workflow
export const stages: Stage[] = [
  {
    id: 'unit-available',
    name: 'Unit Available',
    description: 'Property Manager requests referral from JOHS',
    typicalDays: 1,
    responsibleParty: 'Property Manager',
    requiredDocuments: [],
    recommendedActions: ['Email familyca@multco.us for referral']
  },
  {
    id: 'awaiting-referral',
    name: 'Awaiting Referral',
    description: 'Waiting for JOHS to send applicant referral',
    typicalDays: 21,
    responsibleParty: 'JOHS',
    requiredDocuments: [],
    recommendedActions: ['Follow up if no response after 3 weeks']
  },
  {
    id: 'initial-screening',
    name: 'Initial Screening',
    description: 'Background check and initial screening',
    typicalDays: 7,
    responsibleParty: 'Property Manager',
    requiredDocuments: ['Application', 'ID Copy'],
    recommendedActions: ['Call case manager about background history', 'Assess if appeal docs needed']
  },
  {
    id: 'lihtc-paperwork',
    name: 'LIHTC Paperwork',
    description: 'Income certification and document gathering',
    typicalDays: 21,
    responsibleParty: 'Property Manager + Case Manager',
    requiredDocuments: ['SS Card', 'Birth Certificate', 'Pay Stubs', 'Bank Statements'],
    recommendedActions: ['Proactively gather common missing documents', 'Weekly check-ins with applicant']
  },
  {
    id: 'new-referral-to-hf',
    name: 'New Referral to HF',
    description: 'Send referral packet to Home Forward',
    typicalDays: 3,
    responsibleParty: 'Property Manager',
    requiredDocuments: ['ROI', 'Pre-application', 'Final accounting'],
    recommendedActions: ['Confirm HF received packet']
  },
  {
    id: 'awaiting-hf-intake',
    name: 'Awaiting HF Intake Packet',
    description: 'Waiting for Home Forward to send blank intake forms',
    typicalDays: 14,
    responsibleParty: 'Home Forward',
    requiredDocuments: [],
    recommendedActions: ['Follow up if no response after 2 weeks']
  },
  {
    id: 'completing-intake',
    name: 'Completing Intake Packet',
    description: 'Fill out HF intake packet with applicant',
    typicalDays: 7,
    responsibleParty: 'Case Manager + Property Manager',
    requiredDocuments: ['Government Documents (photocopied)'],
    recommendedActions: ['Schedule appointment with applicant', 'Gather all required documents']
  },
  {
    id: 'hf-processing',
    name: 'HF Processing',
    description: 'Home Forward processes completed intake packet',
    typicalDays: 21,
    responsibleParty: 'Home Forward',
    requiredDocuments: [],
    recommendedActions: ['Check in weekly after 3 weeks']
  },
  {
    id: 'video-orientation',
    name: 'Video Orientation',
    description: 'Home Forward schedules video call with applicant',
    typicalDays: 7,
    responsibleParty: 'Home Forward + Applicant',
    requiredDocuments: [],
    recommendedActions: ['Confirm applicant availability', 'Schedule unit inspection']
  },
  {
    id: 'contract-move-in',
    name: 'Contract & Move-in',
    description: 'Final contract signing and move-in coordination',
    typicalDays: 7,
    responsibleParty: 'Property Manager',
    requiredDocuments: ['Signed Contract'],
    recommendedActions: ['Coordinate move-in date', 'Notify case management team']
  }
];

// Mock applicants for testing
export const mockApplicants: Applicant[] = [
  {
    id: '1',
    name: 'Jane Smith',
    unit: 'Unit 204',
    phone: '(503) 555-0123',
    email: 'jane.smith@email.com',
    caseManager: 'Kody Barnett',
    currentStage: 'initial-screening',
    stageEnteredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    documents: [
      { name: 'Application', required: true, completed: true, uploadedAt: new Date() },
      { name: 'ID Copy', required: true, completed: false },
      { name: 'Appeal Letter', required: false, completed: false }
    ],
    priority: 'high',
    notes: 'May need appeal documentation due to previous eviction'
  },
  {
    id: '2',
    name: 'Michael Johnson',
    unit: 'Unit 301',
    phone: '(503) 555-0456',
    caseManager: 'Sarah Wilson',
    currentStage: 'lihtc-paperwork',
    stageEnteredAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
    documents: [
      { name: 'SS Card', required: true, completed: true, uploadedAt: new Date() },
      { name: 'Birth Certificate', required: true, completed: false },
      { name: 'Pay Stubs', required: true, completed: true, uploadedAt: new Date() },
      { name: 'Bank Statements', required: true, completed: false }
    ],
    priority: 'medium'
  },
  {
    id: '3',
    name: 'Maria Rodriguez',
    phone: '(503) 555-0789',
    caseManager: 'Kody Barnett',
    currentStage: 'awaiting-referral',
    stageEnteredAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
    documents: [],
    priority: 'low',
    notes: 'Waiting for JOHS referral - follow up soon'
  },
  {
    id: '4',
    name: 'Robert Chen',
    unit: 'Unit 105',
    phone: '(503) 555-0321',
    caseManager: 'Mike Thompson',
    currentStage: 'hf-processing',
    stageEnteredAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
    documents: [
      { name: 'Government Documents (photocopied)', required: true, completed: true, uploadedAt: new Date() }
    ],
    priority: 'high',
    notes: 'OVERDUE - HF processing taking too long'
  }
];

// Helper function to organize applicants into columns
export const getKanbanColumns = (): KanbanColumn[] => {
  return stages.map(stage => ({
    id: stage.id,
    title: stage.name,
    applicants: mockApplicants.filter(applicant => applicant.currentStage === stage.id)
  }));
};