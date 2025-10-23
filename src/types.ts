// Core types for the PSH Tracking Platform

export interface Applicant {
  id: string;
  name: string;
  unit?: string;
  phone?: string;
  email?: string;
  caseManager?: string;
  currentStage: string;
  stageEnteredAt: Date;
  documents: DocumentStatus[];
  priority: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface DocumentStatus {
  name: string;
  required: boolean;
  completed: boolean;
  uploadedAt?: Date;
}

export interface Stage {
  id: string;
  name: string;
  description: string;
  typicalDays: number;
  responsibleParty: string;
  requiredDocuments: string[];
  recommendedActions: string[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  applicants: Applicant[];
}