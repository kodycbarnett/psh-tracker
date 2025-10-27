import React, { useState, useEffect } from 'react';
import './App.css';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './services/graphConfig';
import { EmailService } from './services/emailService';
import EmailModal from './components/EmailModal';
import EmailInterface from './components/EmailInterface';
import { supabaseService, MigrationService } from './services/supabase';

// Secure ID generation utility
const generateSecureId = (prefix: string = ''): string => {
  // Use crypto.randomUUID() if available, fallback to secure alternative
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return prefix + crypto.randomUUID();
  }

  // Fallback: Use crypto.getRandomValues for secure random generation
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

  // Format as UUID-like string
  const uuid = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');

  return prefix + uuid;
};

// Data validation utilities
const isValidDate = (date: any): boolean => {
  if (date instanceof Date) {
    return !isNaN(date.getTime());
  }
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }
  return false;
};

const isValidString = (str: any, minLength: number = 0): boolean => {
  return typeof str === 'string' && str.length >= minLength;
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateApplicant = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Required fields
  if (!isValidString(data.id, 1)) errors.push('Missing or invalid applicant ID');
  if (!isValidString(data.name, 1)) errors.push('Missing or invalid applicant name');
  if (!isValidString(data.currentStage, 1)) errors.push('Missing or invalid current stage');

  // Optional but validated fields
  if (data.email && !isValidEmail(data.email)) errors.push('Invalid email format');
  if (data.caseManagerEmail && !isValidEmail(data.caseManagerEmail)) errors.push('Invalid case manager email format');

  // Validate nested objects
  if (data.stageHistory && Array.isArray(data.stageHistory)) {
    data.stageHistory.forEach((transition: any, index: number) => {
      if (!transition.id) errors.push(`Stage history entry ${index + 1} missing ID`);
      if (!isValidDate(transition.timestamp)) errors.push(`Stage history entry ${index + 1} has invalid timestamp`);
    });
  }

  if (data.manualNotes && Array.isArray(data.manualNotes)) {
    data.manualNotes.forEach((note: any, index: number) => {
      if (!note.id) errors.push(`Manual note ${index + 1} missing ID`);
      if (!isValidDate(note.timestamp)) errors.push(`Manual note ${index + 1} has invalid timestamp`);
    });
  }

  if (data.familyMembers && Array.isArray(data.familyMembers)) {
    data.familyMembers.forEach((member: any, index: number) => {
      if (!member.id) errors.push(`Family member ${index + 1} missing ID`);
      if (!isValidString(member.name, 1)) errors.push(`Family member ${index + 1} missing initials`);
    });
  }

  return { isValid: errors.length === 0, errors };
};

const sanitizeApplicant = (data: any): any => {
  // Create a clean copy with only valid fields
  const sanitized: any = {
    id: data.id || generateSecureId('applicant_'),
    name: data.name || '',
    currentStage: data.currentStage || 'awaiting-referral',
    unit: data.unit || '',
    hmisNumber: data.hmisNumber || '',
    phone: data.phone || '',
    email: data.email || '',
    caseManager: data.caseManager || '',
    caseManagerPhone: data.caseManagerPhone || '',
    caseManagerEmail: data.caseManagerEmail || '',
    documents: {
      ssCard: Boolean(data.documents?.ssCard),
      birthCertificate: Boolean(data.documents?.birthCertificate),
      id: Boolean(data.documents?.id)
    },
    familyMembers: [],
    stageHistory: [],
    manualNotes: [],
    completedActionItems: []
  };

  // Safely process arrays
  if (data.familyMembers && Array.isArray(data.familyMembers)) {
    sanitized.familyMembers = data.familyMembers
      .filter((member: any) => member && member.name)
      .map((member: any) => ({
        id: member.id || generateSecureId('family_'),
        name: member.name,
        relationship: member.relationship || '',
        age: Number(member.age) || 0,
        hmisNumber: member.hmisNumber || '',
        documents: {
          ssCard: Boolean(member.documents?.ssCard),
          birthCertificate: Boolean(member.documents?.birthCertificate),
          id: Boolean(member.documents?.id)
        }
      }));
  }

  if (data.stageHistory && Array.isArray(data.stageHistory)) {
    sanitized.stageHistory = data.stageHistory
      .filter((transition: any) => transition && transition.id)
      .map((transition: any) => ({
        id: transition.id,
        fromStage: transition.fromStage || '',
        toStage: transition.toStage || '',
        timestamp: isValidDate(transition.timestamp) ? transition.timestamp : new Date(),
        movedBy: transition.movedBy || 'System',
        note: transition.note || ''
      }));
  }

  if (data.manualNotes && Array.isArray(data.manualNotes)) {
    sanitized.manualNotes = data.manualNotes
      .filter((note: any) => note && note.id)
      .map((note: any) => ({
        id: note.id,
        timestamp: isValidDate(note.timestamp) ? note.timestamp : new Date(),
        addedBy: note.addedBy || 'Current User',
        note: note.note || '',
        noteType: ['phone_call', 'email', 'outreach', 'general'].includes(note.noteType)
          ? note.noteType : 'general'
      }));
  }

  if (data.completedActionItems && Array.isArray(data.completedActionItems)) {
    sanitized.completedActionItems = data.completedActionItems.filter((item: any) =>
      typeof item === 'string' && item.length > 0
    );
  }

  return sanitized;
};

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  age?: number;
  hmisNumber?: string;
  documents: {
    ssCard: boolean;
    birthCertificate: boolean;
    id: boolean;
  };
}

interface StageTransition {
  id: string;
  fromStage: string;
  toStage: string;
  timestamp: Date;
  movedBy: string;
  note?: string;
}

interface ManualNote {
  id: string;
  timestamp: Date;
  addedBy: string;
  note: string;
  noteType: 'phone_call' | 'email' | 'outreach' | 'general';
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  stageId?: string;
  recipients: string[];
}

interface StageDocument {
  name: string;
  filename: string;
  description?: string;
  required: boolean;
}

interface StageInfo {
  id: string;
  title: string;
  description: string;
  duration: string;
  keyStakeholders: {
    primary: string;
    supporting: string[];
  };
  requiredActions: string[];
  commonDelays: string[];
  nextSteps: string;
  tips: string[];
  documents?: StageDocument[];
}

// Enhanced LocalStorage utility functions with data integrity
const STORAGE_KEYS = {
  APPLICANTS: 'psh-tracker-applicants',
  EMAIL_TEMPLATES: 'psh-tracker-email-templates',
  STAGE_INFORMATION: 'psh-tracker-stage-information',
  BACKUP_SUFFIX: '_backup',
  VERSION_SUFFIX: '_version',
  CHECKSUM_SUFFIX: '_checksum'
};

// Simple checksum for data integrity verification
const calculateChecksum = (data: string): string => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
};

// User notification system for critical errors
const notifyUser = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
  // Create a non-intrusive notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    z-index: 10000;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);

  // Also log to console for debugging
  console[type === 'success' ? 'log' : type === 'warning' ? 'warn' : 'error']('PSH Tracker:', message);
};

// Atomic save operation with backup and rollback
const saveToLocalStorage = (key: string, data: any): boolean => {
  const backupKey = key + STORAGE_KEYS.BACKUP_SUFFIX;
  const versionKey = key + STORAGE_KEYS.VERSION_SUFFIX;
  const checksumKey = key + STORAGE_KEYS.CHECKSUM_SUFFIX;

  try {
    // Create backup of existing data
    const existingData = localStorage.getItem(key);
    if (existingData) {
      localStorage.setItem(backupKey, existingData);
    }

    // Validate data before saving
    if (key === STORAGE_KEYS.APPLICANTS) {
      const validatedData = data.map((applicant: any) => {
        const validation = validateApplicant(applicant);
        if (!validation.isValid) {
          console.warn(`Applicant validation failed for ${applicant.name || 'Unknown'}:`, validation.errors);
          return sanitizeApplicant(applicant);
        }
        return applicant;
      });
      data = validatedData;
    }

    // Serialize and save
    const serializedData = JSON.stringify(data);
    const checksum = calculateChecksum(serializedData);

    // Atomic operation: save all or none
    localStorage.setItem(key, serializedData);
    localStorage.setItem(checksumKey, checksum);

    // Update version (simple incrementing counter)
    const currentVersion = parseInt(localStorage.getItem(versionKey) || '0', 10);
    localStorage.setItem(versionKey, (currentVersion + 1).toString());

    return true;

  } catch (error) {
    console.error('Save operation failed:', error);

    // Attempt rollback if we have a backup
    try {
      const backup = localStorage.getItem(backupKey);
      if (backup) {
        localStorage.setItem(key, backup);
        notifyUser('Save failed, but data was restored from backup. Please try again.', 'warning');
      } else {
        notifyUser('Critical: Save failed and no backup available. Please export your data immediately!', 'error');
      }
    } catch (rollbackError) {
      console.error('Rollback also failed:', rollbackError);
      notifyUser('Critical: Save and rollback both failed. Data may be at risk!', 'error');
    }

    return false;
  }
};

// Enhanced load operation with integrity checking
const loadFromLocalStorage = (key: string, defaultValue: any) => {
  const checksumKey = key + STORAGE_KEYS.CHECKSUM_SUFFIX;
  const backupKey = key + STORAGE_KEYS.BACKUP_SUFFIX;

  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return defaultValue;
    }

    // Verify data integrity with checksum
    const expectedChecksum = localStorage.getItem(checksumKey);
    if (expectedChecksum) {
      const actualChecksum = calculateChecksum(stored);
      if (actualChecksum !== expectedChecksum) {
        console.warn('Data integrity check failed! Attempting recovery from backup...');

        // Try backup
        const backup = localStorage.getItem(backupKey);
        if (backup) {
          // Use backup if it seems reasonable (we don't have its checksum, but it's better than corrupted data)
          localStorage.setItem(key, backup);
          notifyUser('Data corruption detected and recovered from backup.', 'warning');
          return JSON.parse(backup);
        } else {
          notifyUser('Data corruption detected with no available backup. Using current data but please export immediately!', 'error');
        }
      }
    }

    const parsed = JSON.parse(stored);

    // For applicants, convert timestamp strings back to Date objects and validate
    if (key === STORAGE_KEYS.APPLICANTS) {
      const processedApplicants = parsed.map((applicant: any) => {
        // Reconstruct Date objects
        const processed = {
          ...applicant,
          stageHistory: applicant.stageHistory?.map((transition: any) => ({
            ...transition,
            timestamp: new Date(transition.timestamp)
          })) || [],
          manualNotes: applicant.manualNotes?.map((note: any) => ({
            ...note,
            timestamp: new Date(note.timestamp)
          })) || []
        };

        // Validate and sanitize if needed
        const validation = validateApplicant(processed);
        if (!validation.isValid) {
          console.warn(`Loading corrupted applicant data for ${applicant.name || 'Unknown'}, auto-fixing:`, validation.errors);
          return sanitizeApplicant(processed);
        }

        return processed;
      });

      return processedApplicants;
    }

    return parsed;
  } catch (error) {
    console.error('Error loading from localStorage:', error);

    // Try backup as last resort
    try {
      const backup = localStorage.getItem(backupKey);
      if (backup) {
        notifyUser('Primary data load failed, recovered from backup.', 'warning');
        return JSON.parse(backup);
      }
    } catch (backupError) {
      console.error('Backup recovery also failed:', backupError);
    }

    notifyUser('Unable to load data. Starting fresh but please check your exports!', 'error');
  }

  return defaultValue;
};

// Automatic backup system
const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_AUTO_BACKUPS = 10; // Keep last 10 auto-backups

const createAutoBackup = (): boolean => {
  try {
    const timestamp = new Date().toISOString();
    const backupData = {
      timestamp,
      applicants: loadFromLocalStorage(STORAGE_KEYS.APPLICANTS, []),
      emailTemplates: loadFromLocalStorage(STORAGE_KEYS.EMAIL_TEMPLATES, []),
      stageInformation: loadFromLocalStorage(STORAGE_KEYS.STAGE_INFORMATION, []),
      version: localStorage.getItem(STORAGE_KEYS.APPLICANTS + STORAGE_KEYS.VERSION_SUFFIX) || '0'
    };

    // Store in a special auto-backup key
    const autoBackupKey = `psh-tracker-auto-backup-${Date.now()}`;
    localStorage.setItem(autoBackupKey, JSON.stringify(backupData));

    // Clean up old auto-backups
    cleanupOldAutoBackups();

    console.log('Auto-backup created successfully');
    return true;
  } catch (error) {
    console.error('Auto-backup failed:', error);
    return false;
  }
};

const cleanupOldAutoBackups = () => {
  try {
    const autoBackupKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('psh-tracker-auto-backup-'))
      .sort()
      .reverse(); // Most recent first

    // Remove excess backups
    if (autoBackupKeys.length > MAX_AUTO_BACKUPS) {
      const keysToRemove = autoBackupKeys.slice(MAX_AUTO_BACKUPS);
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error('Error cleaning up auto-backups:', error);
  }
};

const downloadEmergencyBackup = (filename?: string) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `psh-tracker-emergency-backup-${timestamp}.json`;

    const backupData = {
      timestamp: new Date().toISOString(),
      applicants: loadFromLocalStorage(STORAGE_KEYS.APPLICANTS, []),
      emailTemplates: loadFromLocalStorage(STORAGE_KEYS.EMAIL_TEMPLATES, []),
      stageInformation: loadFromLocalStorage(STORAGE_KEYS.STAGE_INFORMATION, []),
      autoBackups: Object.keys(localStorage)
        .filter(key => key.startsWith('psh-tracker-auto-backup-'))
        .map(key => ({
          key,
          data: JSON.parse(localStorage.getItem(key) || '{}')
        }))
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    notifyUser('Emergency backup downloaded successfully!', 'success');
  } catch (error) {
    console.error('Emergency backup failed:', error);
    notifyUser('Emergency backup failed! Data may be at risk.', 'error');
  }
};

// Check if automatic backup is needed
const checkAndCreateBackup = () => {
  const lastBackupKey = 'psh-tracker-last-backup-time';
  const lastBackupTime = localStorage.getItem(lastBackupKey);
  const now = Date.now();

  if (!lastBackupTime || (now - parseInt(lastBackupTime, 10)) > AUTO_BACKUP_INTERVAL) {
    if (createAutoBackup()) {
      localStorage.setItem(lastBackupKey, now.toString());
    }
  }
};

// Multi-tab synchronization using BroadcastChannel
const createSyncChannel = () => {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('psh-tracker-sync');
    return channel;
  }
  return null;
};

const syncChannel = createSyncChannel();

const broadcastDataChange = (type: 'applicants' | 'templates' | 'stage-info', data: any) => {
  if (syncChannel) {
    syncChannel.postMessage({
      type: 'data-update',
      payload: { type, data, timestamp: Date.now() }
    });
  }
};

const setupMultiTabSync = (
  setApplicants: React.Dispatch<React.SetStateAction<any[]>>,
  setEmailTemplates: React.Dispatch<React.SetStateAction<any[]>>,
  setStageInformation: React.Dispatch<React.SetStateAction<any[]>>
) => {
  if (!syncChannel) return null;

  const handleSyncMessage = (event: MessageEvent) => {
    if (event.data.type === 'data-update') {
      const { type, data, timestamp } = event.data.payload;

      // Only sync if the change is recent (within 1 second) to avoid stale updates
      if (Date.now() - timestamp < 1000) {
        switch (type) {
          case 'applicants':
            setApplicants(data);
            console.log('Synced applicants from another tab');
            break;
          case 'templates':
            setEmailTemplates(data);
            console.log('Synced email templates from another tab');
            break;
          case 'stage-info':
            setStageInformation(data);
            console.log('Synced stage information from another tab');
            break;
        }
      }
    }
  };

  syncChannel.addEventListener('message', handleSyncMessage);

  // Return cleanup function
  return () => {
    syncChannel.removeEventListener('message', handleSyncMessage);
  };
};

interface Applicant {
  id: string;
  name: string;
  unit?: string;
  hmisNumber?: string;
  phone?: string;
  email?: string;
  caseManager?: string;
  caseManagerPhone?: string;
  caseManagerEmail?: string;
  currentStage: string;
  dateCreated: string;
  familyMembers?: FamilyMember[];
  documents?: {
    ssCard: boolean;
    birthCertificate: boolean;
    id: boolean;
  };
  stageHistory?: StageTransition[];
  manualNotes?: ManualNote[];
  completedActionItems?: string[];
}

// Start with empty applicants array - real user data will be loaded from localStorage
const initialApplicants: Applicant[] = [];

const stages = [
  { id: 'awaiting-referral', title: 'Waiting for JOHS Referral', color: 'stage-gray', headerColor: 'stage-gray-header' },
  { id: 'application-packet', title: 'Waiting on Application Packet', color: 'stage-blue', headerColor: 'stage-blue-header' },
  { id: 'background-check', title: 'Waiting on Background Check', color: 'stage-indigo', headerColor: 'stage-indigo-header' },
  { id: 'appeal-documentation', title: 'Waiting on Appeal Documentation', color: 'stage-yellow', headerColor: 'stage-yellow-header' },
  { id: 'tax-credit-paperwork', title: 'Tax Credit Paperwork Appointment', color: 'stage-purple', headerColor: 'stage-purple-header' },
  { id: 'alexia-hf-processing', title: 'Waiting for HF Intake Packet', color: 'stage-pink', headerColor: 'stage-pink-header' },
  { id: 'hf-intake-packet', title: 'HF Intake Packet Appointment', color: 'stage-cyan', headerColor: 'stage-cyan-header' },
  { id: 'hf-packet-completion', title: 'Waiting for Video Intake', color: 'stage-teal', headerColor: 'stage-teal-header' },
  { id: 'video-intake', title: 'Contract and Lease Signing Meeting', color: 'stage-emerald', headerColor: 'stage-emerald-header' },
  { id: 'lease-signing', title: 'Wraparound Support Appointment', color: 'stage-green', headerColor: 'stage-green-header' },
  { id: 'wraparound-intake', title: 'Completed', color: 'stage-lime', headerColor: 'stage-lime-header' },
];

const initialStageInformation: StageInfo[] = [
  {
    id: 'awaiting-referral',
    title: 'Waiting for JOHS Referral',
    description: 'A PSH unit has become available and we are waiting for a referral from JOHS Family Coordinated Access.',
    duration: '3 weeks maximum',
    keyStakeholders: {
      primary: 'Vibrant Property Manager',
      supporting: ['JOHS Family CA Team', 'IPM Property Management']
    },
    requiredActions: [
      'Notify JOHS of vacant unit',
      'Get unit inspected',
      'Add referral request to PBS8 Google tracking sheet'
    ],
    commonDelays: [
      'JOHS taking longer than 3 weeks to respond',
      'Incomplete referral request information',
      'High demand for PSH units'
    ],
    nextSteps: 'Once JOHS provides a referral, begin LIHTC screening and application process',
    tips: [
      'If no referral after 3 weeks, can pull from Section 8 waitlist',
      'Include IHI Housing Stability Specialist on HP referrals',
      'Track all communication in PBS8 tracking sheet'
    ],
    documents: []
  },
  {
    id: 'application-packet',
    title: 'Waiting on Application Packet',
    description: 'Applicant and case manager work together to complete the initial application packet and gather vital documents.',
    duration: '1-2 weeks',
    keyStakeholders: {
      primary: 'Case Manager (IHI/JOIN)',
      supporting: ['Applicant', 'Vibrant Property Manager', 'Family CA Staff']
    },
    requiredActions: [
      'Call referring Case Manager and assess if applicant needs to collect appeal documentation early and to explain process, which includes government docs',
      'Verify Application accuracy/correctness'
    ],
    commonDelays: [
      'Missing birth certificates for children',
      'Applicant unresponsive or hard to reach',
      'Difficulty obtaining social security cards',
      'Case manager caseload issues'
    ],
    nextSteps: 'Submit completed packet for background check screening',
    tips: [
      'Start gathering documents immediately upon referral',
      'Case managers can provide direct support',
      'Keep applicant informed of requirements'
    ],
    documents: [
      {
        name: 'Application Packet Overview',
        filename: 'Application Packet Overview.pdf',
        description: 'Complete overview of application requirements',
        required: true
      },
      {
        name: 'Eligibility Screening Form',
        filename: 'Eligibility Screening for Homeless Preference Units at VIBRANT.pdf',
        description: 'Screening form for homeless preference units',
        required: true
      },
      {
        name: 'Home Forward ROI',
        filename: 'HFROI.pdf',
        description: 'Release of Information for Home Forward',
        required: true
      },
      {
        name: 'Pre-Application (Vibrant)',
        filename: 'PreApplication(Vibrant).pdf',
        description: 'Vibrant-specific pre-application form',
        required: true
      },
      {
        name: 'Financial Responsibility Application',
        filename: 'Standard Financially Responsible Application.pdf',
        description: 'Standard financially responsible application',
        required: true
      }
    ]
  },
  {
    id: 'background-check',
    title: 'Waiting on Background Check',
    description: 'Background screening is conducted to determine applicant eligibility. Appeals may be needed if screening criteria are not met.',
    duration: '1 week for screening + 7-10 days for appeals if needed',
    keyStakeholders: {
      primary: 'Vibrant Property Manager',
      supporting: ['IPM Compliance Department', 'Case Manager', 'Applicant']
    },
    requiredActions: [
      'Send Background check which should be what activates this stage',
      'Alert Case manager and Applicant when background results are received'
    ],
    commonDelays: [
      'Background check processing delays',
      'Need for reasonable accommodation requests',
      'Appeals requiring legal review',
      'Incomplete appeal documentation'
    ],
    nextSteps: 'If approved, move to Tax Credit paperwork. If denied, process appeals or request new referral.',
    tips: [
      'Recommend submitting appeal documents with application if issues expected',
      'Unit held for 10 business days if appeal submitted timely',
      'Compliance department handles all appeal decisions'
    ],
    documents: []
  },
  {
    id: 'appeal-documentation',
    title: 'Waiting on Appeal Documentation',
    description: 'Applicant needs to submit appeal or reasonable accommodation documentation due to background check issues.',
    duration: '7-10 business days (longer if legal input needed)',
    keyStakeholders: {
      primary: 'IPM Compliance Department',
      supporting: ['Case Manager', 'Applicant', 'Legal Team (if needed)']
    },
    requiredActions: [
      'Ensure Case manager is well informed on Appeal process as well as time window'
    ],
    commonDelays: [
      'Difficulty obtaining medical records',
      'Complex legal issues requiring review',
      'Applicant not understanding appeal process',
      'Missing required documentation'
    ],
    nextSteps: 'Compliance department reviews and makes final decision. If approved, continue to Tax Credit paperwork.',
    tips: [
      'Time is critical - only 10 business days to submit',
      'Case managers should assist with appeal preparation',
      'Unit is held pending appeal decision'
    ],
    documents: []
  },
  {
    id: 'tax-credit-paperwork',
    title: 'Tax Credit Paperwork Appointment',
    description: 'Income certification and LIHTC paperwork completion. Can take 1 week but applicants typically need more time for documents.',
    duration: '3 weeks (can be faster with all docs ready)',
    keyStakeholders: {
      primary: 'Vibrant Property Manager',
      supporting: ['IPM Compliance Department', 'Applicant', 'Case Manager']
    },
    requiredActions: [
      'Schedule Tax credit work appointment, which coincides with initiating this stage',
      'Ensure that applicant understands what documentation they need to bring',
      'Verify correctness of paperwork before applicant leaves meeting',
      'Send completed Packet to Alexia'
    ],
    commonDelays: [
      'Missing income verification documents',
      'Changes in employment status',
      'Complex income situations',
      'Applicant responsiveness to document requests'
    ],
    nextSteps: 'Once income certified, send intake request to Home Forward',
    tips: [
      'Documents from this stage can be reused for HF Intake Packet',
      'Applicants have 5 days to respond to each information request',
      'Start preparing HF referral documents simultaneously'
    ],
    documents: [
      {
        name: 'Tax Credit Packet',
        filename: 'Tax Credit Packet.pdf',
        description: 'Complete tax credit documentation packet',
        required: true
      },
      {
        name: 'Tax Credit Paperwork Overview',
        filename: 'Tax Credit Paperwork Overview.pdf',
        description: 'Overview and instructions for tax credit process',
        required: true
      }
    ]
  },
  {
    id: 'alexia-hf-processing',
    title: 'Waiting for HF Intake Packet',
    description: 'Property manager sends intake request to Home Forward with required documentation after passing LIHTC screening.',
    duration: '1-2 days for submission',
    keyStakeholders: {
      primary: 'Vibrant Property Manager',
      supporting: ['Home Forward', 'IPM Compliance']
    },
    requiredActions: [
      'Send New Referral Packet to HF at same time that Tax Credit paperwork is sent to Alexia, which initiates this stage',
      'Check in on Shawnda after two weeks'
    ],
    commonDelays: [
      'Missing final accounting paperwork',
      'Incomplete pre-application',
      'Delays in updating PSH waitlist'
    ],
    nextSteps: 'Home Forward conducts their own background check and screening process',
    tips: [
      'Send all documents simultaneously to avoid delays',
      'Ensure PSH waitlist is updated and link provided',
      'Double-check all forms are complete before submission'
    ],
    documents: [
      {
        name: 'New Referral Packet Overview',
        filename: 'New Referral Packet Overview.pdf',
        description: 'Complete overview of referral packet requirements',
        required: true
      },
      {
        name: 'Final Accounting Checklist',
        filename: 'Final Accounting Checklist.pdf',
        description: 'Checklist for final accounting paperwork',
        required: true
      },
      {
        name: 'PBV Referral Form',
        filename: 'PBV Referral Form.pdf',
        description: 'Project-based voucher referral form',
        required: true
      },
      {
        name: 'Home Forward ROI',
        filename: 'HFROI.pdf',
        description: 'Release of Information for Home Forward',
        required: true
      },
      {
        name: 'Pre-Application (Vibrant)',
        filename: 'PreApplication(Vibrant).pdf',
        description: 'Vibrant-specific pre-application form',
        required: true
      }
    ]
  },
  {
    id: 'hf-intake-packet',
    title: 'HF Intake Packet Appointment',
    description: 'Home Forward completes their screening and sends intake packet back to property manager if approved.',
    duration: '2 weeks for HF processing',
    keyStakeholders: {
      primary: 'Home Forward',
      supporting: ['Vibrant Property Manager', 'Applicant']
    },
    requiredActions: [
      'Schedule HF Intake Appointment, which initiates this step',
      'Ensure all government docs and Income Verification has been collected',
      'Verify accuracy of packet while applicant is still present at appointment'
    ],
    commonDelays: [
      'Home Forward processing delays',
      'Additional screening requirements',
      'Need for applicant clarification',
      'High volume at Home Forward'
    ],
    nextSteps: 'Property manager calls applicant to schedule intake packet completion appointment',
    tips: [
      'Property manager should check in weekly after 3 weeks',
      'Schedule unit inspection during this waiting period',
      'Prepare applicant for next steps'
    ],
    documents: []
  },
  {
    id: 'hf-packet-completion',
    title: 'Waiting for Video Intake',
    description: 'Property manager and Housing Stability Specialist assist applicant with completing the intake packet including all vital documents.',
    duration: '1-2 weeks',
    keyStakeholders: {
      primary: 'Vibrant Property Manager',
      supporting: ['IHI Housing Stability Specialist', 'IPM Compliance', 'Applicant']
    },
    requiredActions: [
      'Check in on Shawnda after two weeks to ensure packet is being processed'
    ],
    commonDelays: [
      'Missing vital documents',
      'Scheduling conflicts',
      'Incomplete packet requiring corrections',
      'Document verification issues'
    ],
    nextSteps: 'Wait for Home Forward to schedule final intake appointment',
    tips: [
      'All vital documents must be included at this stage',
      'Double-check packet completeness before submission',
      'Housing Stability Specialist provides crucial support for HP units'
    ],
    documents: [
      {
        name: 'Home Forward Intake Packet Overview',
        filename: 'Home Forward Intake Packet Overview.pdf',
        description: 'Overview and instructions for HF intake process',
        required: true
      },
      {
        name: 'Home Forward Intake Packet',
        filename: 'Home Forward Intake Packet.pdf',
        description: 'Complete intake packet forms',
        required: true
      }
    ]
  },
  {
    id: 'video-intake',
    title: 'Contract and Lease Signing Meeting',
    description: 'Applicant waits for Home Forward to schedule and complete the final intake appointment.',
    duration: '2-3 weeks',
    keyStakeholders: {
      primary: 'Home Forward',
      supporting: ['Applicant', 'Vibrant Property Manager']
    },
    requiredActions: [
      'Schedule contract and lease signing with resident which initiates this step',
      'Hand off keys!'
    ],
    commonDelays: [
      'Home Forward scheduling delays',
      'Applicant availability issues',
      'Need for additional documentation',
      'Technical issues with video appointments'
    ],
    nextSteps: 'Home Forward emails contract to property manager within one week of completed intake',
    tips: [
      'Property manager checks in weekly after 3 weeks',
      'Ensure applicant is prepared for appointment',
      'Have backup documentation ready if needed'
    ],
    documents: []
  },
  {
    id: 'lease-signing',
    title: 'Wraparound Support Appointment',
    description: 'Final contract received from Home Forward and move-in is scheduled with appropriate support teams.',
    duration: '1 week',
    keyStakeholders: {
      primary: 'Vibrant Property Manager',
      supporting: ['Home Forward', 'Applicant', 'Support Teams']
    },
    requiredActions: [
      'Welcome resident',
      'Schedule final paperwork meeting with wraparound support case manager'
    ],
    commonDelays: [
      'Contract processing delays',
      'Applicant scheduling issues',
      'Unit preparation delays'
    ],
    nextSteps: 'Applicant moves in and wraparound support begins',
    tips: [
      'Notify appropriate support teams immediately',
      'Provide TIC for HP units to Housing Stability Specialist',
      'Confirm all parties are ready for move-in'
    ],
    documents: [
      {
        name: 'Contract and Lease Packet Overview',
        filename: 'Contract and Lease Packet Overview.pdf',
        description: 'Overview of contract and lease signing process',
        required: true
      }
    ]
  },
  {
    id: 'wraparound-intake',
    title: 'Completed',
    description: 'Applicant has moved in and ongoing support services are initiated by appropriate case management teams.',
    duration: 'Ongoing',
    keyStakeholders: {
      primary: 'JOIN MPSH Team (PSH) / IHI Housing Stability Specialist (HP)',
      supporting: ['Vibrant Property Manager', 'Applicant']
    },
    requiredActions: [
      'Confirm move-in with property manager',
      'Initiate ongoing case management services',
      'Provide required documentation to referring parties',
      'Begin wraparound support services'
    ],
    commonDelays: [
      'Support team coordination delays',
      'Applicant adjustment period',
      'Documentation completion'
    ],
    nextSteps: 'Ongoing case management and housing retention support',
    tips: [
      'Communication between all parties is crucial',
      'Transition support helps ensure housing stability',
      'Document successful placement for reporting'
    ],
    documents: [
      {
        name: 'Wraparound Support Intake Packet',
        filename: '0 INTAKE PACKET FINAL VIBRANT.pdf',
        description: 'Final intake packet for wraparound support services',
        required: true
      }
    ]
  }
];

const defaultEmailTemplates: EmailTemplate[] = [
  {
    id: 'new-referral',
    name: 'New Referral Request',
    subject: 'PSH Unit Available - Referral Request for {{unit}}',
    body: `Hi JOHS Team,

We have a PSH unit available at Vibrant and are requesting a referral.

Unit Details:
- Unit Number: {{unit}}
- Property: Vibrant Apartments
- Available Date: {{currentDate}}

Please send a suitable referral for this Permanent Supportive Housing unit within the next 3 weeks.

Thank you,
{{userName}}`,
    stageId: 'awaiting-referral',
    recipients: ['familyca@multco.us']
  },
  {
    id: 'document-request',
    name: 'Document Request to Case Manager',
    subject: 'Document Request for {{applicantName}} - {{unit}}',
    body: `Hi {{caseManager}},

I hope you're doing well. I'm reaching out regarding {{applicantName}}'s housing application for {{unit}}.

We need the following documents to proceed with the application:
- Social Security Cards for all household members
- Birth Certificates for children under 18
- Photo IDs for adults
- Income verification documents

Could you please help {{applicantName}} gather these documents? You can reach them at {{applicantPhone}} or {{applicantEmail}}.

Please let me know if you have any questions.

Best regards,
{{userName}}`,
    stageId: 'application-packet',
    recipients: ['{{caseManagerEmail}}']
  },
  {
    id: 'background-check-update',
    name: 'Background Check Status Update',
    subject: 'Background Check Update - {{applicantName}}',
    body: `Hi {{caseManager}},

Quick update on {{applicantName}}'s application for {{unit}}:

The background check has been submitted and we're awaiting results. This typically takes 5-7 business days.

I'll keep you posted on any updates.

Contact me if you have any questions.

Best,
{{userName}}`,
    stageId: 'background-check',
    recipients: ['{{caseManagerEmail}}']
  },
  {
    id: 'appeal-needed',
    name: 'Appeal Documentation Needed',
    subject: 'Appeal Documentation Required - {{applicantName}}',
    body: `Hi {{caseManager}},

{{applicantName}}'s background check for {{unit}} requires an appeal or reasonable accommodation request.

Please help {{applicantName}} prepare appeal documentation. They have 10 business days from the denial date to submit the appeal to keep the unit on hold.

Required for appeal:
- Written explanation of circumstances
- Supporting documentation (treatment records, employment verification, etc.)
- Character references if applicable

Please contact me at your earliest convenience to discuss next steps.

Time is critical on this one.

Thanks,
{{userName}}`,
    stageId: 'appeal-documentation',
    recipients: ['{{caseManagerEmail}}']
  }
];

function App() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);

  // Note: Data loading and saving is handled by the advanced localStorage system below

  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<string | null>(null);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [showMoveConfirm, setShowMoveConfirm] = useState(false);
  const [pendingMove, setPendingMove] = useState<{applicantId: string, fromStage: string, toStage: string} | null>(null);
  const [moveNote, setMoveNote] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'phone_call' | 'email' | 'outreach' | 'general'>('general');
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [stageInformation, setStageInformation] = useState<StageInfo[]>([]);
  const [showEmailTemplates, setShowEmailTemplates] = useState(false);
  const [, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showDataDropdown, setShowDataDropdown] = useState(false);
  const [showCompletedItems, setShowCompletedItems] = useState<{[key: string]: boolean}>({});
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  
  // Supabase and migration state
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    hasLocalData: boolean;
    hasSupabaseData: boolean;
    needsMigration: boolean;
  } | null>(null);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    subject: '',
    body: '',
    stageId: '',
    recipients: ''
  });
  const [showStageInfo, setShowStageInfo] = useState(false);
  const [selectedStageInfo, setSelectedStageInfo] = useState<StageInfo | null>(null);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const [editingStageInfo, setEditingStageInfo] = useState<StageInfo | null>(null);
  const [showActionItemsCustomizer, setShowActionItemsCustomizer] = useState(false);
  const [customizingStageInfo, setCustomizingStageInfo] = useState<StageInfo | null>(null);
  const [showDetailedActionItems, setShowDetailedActionItems] = useState(false);
  const [actionItemsType, setActionItemsType] = useState<'pending' | 'documents' | null>(null);
  const [pendingDocumentChanges, setPendingDocumentChanges] = useState<{[key: string]: {documents: any}}>({});
  const [editingExpirationDate, setEditingExpirationDate] = useState<string | null>(null);
  const [tempExpirationDate, setTempExpirationDate] = useState<string>('');
  const [stageTimeLimits, setStageTimeLimits] = useState<{[key: string]: number}>({
    'awaiting-referral': 14, // 14 working days for JOHSHSD to respond with referral
    'application-packet': 10, // 10 business days to return completed packet
    'background-check': 7, // 1 week for background check screening
    'appeal-documentation': 10, // 10 business days to submit appeal after denial
    'tax-credit-paperwork': 5, // 5 days to respond to each request for information
    'alexia-hf-processing': 21, // 3 weeks for IPMCRMG compliance review + Home Forward processing
    'hf-intake-packet': 14, // 2 weeks for Home Forward background/screening
    'hf-packet-completion': 21, // 2-3 weeks for Home Forward intake appointment
    'video-intake': 7, // 1 week for contract after intake appointment
    'lease-signing': 0, // No time limit - final stage
    'completed': 0 // No time limit
  });

  // Timestamp editing state
  const [editingTimestamp, setEditingTimestamp] = useState<string | null>(null);
  const [tempTimestamp, setTempTimestamp] = useState<string>('');
  const [stageFormData, setStageFormData] = useState({
    title: '',
    description: '',
    duration: '',
    primaryStakeholder: '',
    supportingStakeholders: '',
    requiredActions: '',
    commonDelays: '',
    nextSteps: '',
    tips: '',
    documents: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    hmisNumber: '',
    phone: '',
    email: '',
    caseManager: '',
    caseManagerPhone: '',
    caseManagerEmail: ''
  });
  const [familyFormData, setFamilyFormData] = useState({
    name: '',
    relationship: '',
    age: '',
    hmisNumber: ''
  });

  // Email service state
  const [msalInstance] = useState(() => new PublicClientApplication(msalConfig as any));
  const [emailService] = useState(() => new EmailService(msalInstance));
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<EmailTemplate | null>(null);
  
  // New email interface state
  const [showEmailInterface, setShowEmailInterface] = useState(false);
  const [emailInterfaceApplicant, setEmailInterfaceApplicant] = useState<any>(null);
  
  // Email archive state
  const [emailArchive, setEmailArchive] = useState<Array<{
    id: string;
    applicantId: string;
    applicantName: string;
    timestamp: string;
    subject: string;
    body: string;
    recipients: string[];
    templateId: string;
    templateName: string;
    threadId: string;
    threadSubject: string;
    emailHeaders: {
      'In-Reply-To'?: string;
      'References'?: string;
      'Message-ID': string;
    };
  }>>([]);

  // Email threads state
  const [emailThreads, setEmailThreads] = useState<Array<{
    id: string;
    applicantId: string;
    applicantName: string;
    subject: string;
    participants: string[];
    emailCount: number;
    lastActivity: string;
    isActive: boolean;
    createdDate: string;
  }>>([]);

  // Check Supabase connection and migration status on startup
  useEffect(() => {
    const checkSupabaseConnection = async () => {
      try {
        // Test Supabase connection
        const data = await supabaseService.getBuildings();
        
        setIsSupabaseConnected(true);
        console.log('✅ Supabase connected successfully');
        
        // Check migration status
        const status = await MigrationService.checkMigrationStatus();
        console.log('📊 Migration status:', status);
        setMigrationStatus(status);
        
        if (status.needsMigration) {
          console.log('🚀 Showing migration modal. Status:', status);
          setShowMigrationModal(true);
          console.log('✅ setShowMigrationModal(true) called');
        }
      } catch (error) {
        console.warn('⚠️ Supabase not configured or connection failed:', error);
        setIsSupabaseConnected(false);
      }
    };
    
    checkSupabaseConnection();
  }, []);

      // Load data from Supabase or localStorage on app startup
  useEffect(() => {
      const loadData = async () => {
      // First, try to load from Supabase if connected OR if we've migrated
      const shouldUseSupabase = localStorage.getItem('psh_use_supabase') === 'true';
      const useSupabase = isSupabaseConnected && (shouldUseSupabase || !migrationStatus?.hasLocalData);
      
      if (useSupabase) {
        try {
          console.log('Loading data from Supabase...');
          const buildingId = '00000000-0000-0000-0000-000000000001';
          const supabaseApplicants = await supabaseService.getApplicants(buildingId);
          
          if (supabaseApplicants && supabaseApplicants.length > 0) {
            console.log(`Loaded ${supabaseApplicants.length} applicants from Supabase`);
            // Convert Supabase format to app format
            const convertedApplicants = supabaseApplicants.map((app: any) => ({
              id: app.id,
              name: app.name,
              unit: app.unit,
              hmisNumber: app.hmis_number,
              phone: app.phone,
              email: app.email,
              caseManager: app.case_manager,
              caseManagerPhone: app.case_manager_phone,
              caseManagerEmail: app.case_manager_email,
              currentStage: app.current_stage,
              documents: app.documents || {},
              familyMembers: app.family_members || [],
              // Convert string timestamps to Date objects
              stageHistory: (app.stage_history || []).map((entry: any) => ({
                ...entry,
                timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
              })),
              manualNotes: (app.manual_notes || []).map((note: any) => ({
                ...note,
                timestamp: note.timestamp ? new Date(note.timestamp) : new Date()
              })),
              completedActionItems: app.completed_action_items || [],
              dateCreated: app.date_created ? new Date(app.date_created) : new Date()
            }));
            setApplicants(convertedApplicants);
            
            // Load email templates and stage info from localStorage as well
            const loadedTemplates = loadFromLocalStorage(STORAGE_KEYS.EMAIL_TEMPLATES, defaultEmailTemplates);
            const loadedStageInfo = loadFromLocalStorage(STORAGE_KEYS.STAGE_INFORMATION, initialStageInformation);
            setEmailTemplates(loadedTemplates);
            setStageInformation(loadedStageInfo);
            return;
          }
        } catch (error) {
          console.error('Error loading from Supabase:', error);
          // Fall through to localStorage
        }
      }
      
      // Fall back to localStorage (only if not using Supabase)
      const shouldUseSupabase = typeof window !== 'undefined' && localStorage.getItem('psh_use_supabase') === 'true';
      if (shouldUseSupabase) {
        console.log('⏭️ Skipping localStorage fallback - using Supabase');
        return; // Don't load from localStorage if we're using Supabase
      }
      
      console.log('Loading data from localStorage...');
      const loadedApplicants = loadFromLocalStorage(STORAGE_KEYS.APPLICANTS, initialApplicants);
      
      // Load email archive
    const savedEmailArchive = localStorage.getItem('psh_email_archive');
    if (savedEmailArchive) {
      try {
        const parsedArchive = JSON.parse(savedEmailArchive);
        setEmailArchive(parsedArchive);
        console.log('Loaded email archive:', parsedArchive.length, 'emails');
      } catch (error) {
        console.error('Error loading email archive:', error);
      }
    }

    // Load email threads
    const savedEmailThreads = localStorage.getItem('psh_email_threads');
    if (savedEmailThreads) {
      try {
        const parsedThreads = JSON.parse(savedEmailThreads);
        setEmailThreads(parsedThreads);
        console.log('Loaded email threads:', parsedThreads.length, 'threads');
      } catch (error) {
        console.error('Error loading email threads:', error);
      }
    }
    const loadedTemplates = loadFromLocalStorage(STORAGE_KEYS.EMAIL_TEMPLATES, defaultEmailTemplates);
    const loadedStageInfo = loadFromLocalStorage(STORAGE_KEYS.STAGE_INFORMATION, initialStageInformation);
    
    console.log('Loaded applicants:', loadedApplicants.length, 'applicants');
    if (loadedApplicants.length > 0) {
      console.log('Sample applicant stageHistory:', loadedApplicants[0].stageHistory);
    }
    
      setApplicants(loadedApplicants);
      setEmailTemplates(loadedTemplates);
      setStageInformation(loadedStageInfo);
    };
    
    loadData();
  }, [isSupabaseConnected, migrationStatus]);

  // Enhanced auto-save with backup and sync
  useEffect(() => {
    const saveApplicants = async () => {
      if (applicants.length === 0) return;
      
      const useSupabase = localStorage.getItem('psh_use_supabase') === 'true';
      
      if (useSupabase && isSupabaseConnected) {
        // Save to Supabase
        console.log('💾 Auto-saving applicants to Supabase:', applicants.length, 'applicants');
        console.log('🔍 Auto-save conditions:', { useSupabase, isSupabaseConnected, applicantsLength: applicants.length });
        try {
          for (const applicant of applicants) {
            // Convert app format to Supabase format
            // Remove 'applicant_' prefix if it exists for Supabase compatibility
            const supabaseId = applicant.id.replace(/^applicant_/, '');
            
            // Use upsert (insert or update) for better reliability
            const buildingId = '00000000-0000-0000-0000-000000000001';
            await supabaseService.createOrUpdateApplicant({
              id: supabaseId,
              building_id: buildingId,
              name: applicant.name,
              unit: applicant.unit || null,
              hmis_number: applicant.hmisNumber || null,
              phone: applicant.phone || null,
              email: applicant.email || null,
              case_manager: applicant.caseManager || null,
              case_manager_phone: applicant.caseManagerPhone || null,
              case_manager_email: applicant.caseManagerEmail || null,
              current_stage: applicant.currentStage,
              documents: applicant.documents || {},
              family_members: applicant.familyMembers || [],
              stage_history: (applicant.stageHistory || []).map((entry: any) => ({
                ...entry,
                timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp
              })),
              manual_notes: (applicant.manualNotes || []).map((note: any) => ({
                ...note,
                timestamp: note.timestamp instanceof Date ? note.timestamp.toISOString() : note.timestamp
              })),
              completed_action_items: applicant.completedActionItems || [],
              date_created: applicant.dateCreated instanceof Date ? applicant.dateCreated.toISOString() : applicant.dateCreated
            });
          }
          console.log('✅ Successfully saved applicants to Supabase');
        } catch (error) {
          console.error('❌ Failed to save applicants to Supabase:', error);
        }
      } else {
        // Save to localStorage
        console.log('Saving applicants to localStorage:', applicants.length, 'applicants');
        const success = saveToLocalStorage(STORAGE_KEYS.APPLICANTS, applicants);
        if (success) {
          console.log('Successfully saved applicants to localStorage');
          broadcastDataChange('applicants', applicants);
          checkAndCreateBackup();
        } else {
          console.error('Failed to save applicants to localStorage');
        }
      }
    };
    
    saveApplicants();
  }, [applicants, isSupabaseConnected]);

  useEffect(() => {
    if (emailTemplates.length > 0) {
      const success = saveToLocalStorage(STORAGE_KEYS.EMAIL_TEMPLATES, emailTemplates);
      if (success) {
        broadcastDataChange('templates', emailTemplates);
      }
    }
  }, [emailTemplates]);

  useEffect(() => {
    if (stageInformation.length > 0) {
      const success = saveToLocalStorage(STORAGE_KEYS.STAGE_INFORMATION, stageInformation);
      if (success) {
        broadcastDataChange('stage-info', stageInformation);
      }
    }
  }, [stageInformation]);

  // Setup multi-tab synchronization
  useEffect(() => {
    const cleanup = setupMultiTabSync(setApplicants, setEmailTemplates, setStageInformation);

    // Setup periodic backup check
    const backupInterval = setInterval(() => {
      checkAndCreateBackup();
    }, AUTO_BACKUP_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (cleanup) cleanup();
      clearInterval(backupInterval);
    };
  }, []);

  // Initialize email service
  useEffect(() => {
    const initializeEmailService = async () => {
      try {
        await msalInstance.initialize();
        await emailService.initialize();
      } catch (error) {
        console.error('Failed to initialize email service:', error);
      }
    };

    initializeEmailService();
  }, [msalInstance, emailService]);

  // Handle keyboard events for modal closing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showModal) {
          closeModal();
        } else if (showMoveConfirm) {
          cancelMove();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal, showMoveConfirm]);

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDataDropdown) {
        const target = event.target as Element;
        if (!target.closest('.relative.inline-block.text-left')) {
          setShowDataDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDataDropdown]);

  const openModal = () => {
    setShowModal(true);
    setFormData({
      name: '',
      unit: '',
      hmisNumber: '',
      phone: '',
      email: '',
      caseManager: '',
      caseManagerPhone: '',
      caseManagerEmail: ''
    });
  };

  const selectApplicant = (applicantId: string) => {
    const applicant = applicants.find(a => a.id === applicantId);
    if (applicant) {
      setSelectedApplicant(applicantId);
      setFormData({
        name: applicant.name,
        unit: applicant.unit || '',
        hmisNumber: applicant.hmisNumber || '',
        phone: applicant.phone || '',
        email: applicant.email || '',
        caseManager: applicant.caseManager || '',
        caseManagerPhone: applicant.caseManagerPhone || '',
        caseManagerEmail: applicant.caseManagerEmail || ''
      });
    }
  };

  const getDocumentProgress = (applicant: Applicant) => {
    let completed = 0;
    let total = 2; // SS Card and ID for head of household

    // Count head of household documents
    if (applicant.documents?.ssCard) completed++;
    if (applicant.documents?.id) completed++;

    // Count family member documents
    if (applicant.familyMembers) {
      applicant.familyMembers.forEach(member => {
        if (member.relationship !== 'Head of Household') {
          total += 1; // SS Card for all family members
          if (member.documents.ssCard) completed++;
          
          // Birth certificate for children under 18
          if (!member.age || member.age < 18) {
            total += 1;
            if (member.documents.birthCertificate) completed++;
          }
          
          // ID for adults 18+
          if (member.age && member.age >= 18) {
            total += 1;
            if (member.documents.id) completed++;
          }
        }
      });
    }

    return { completed, total };
  };

  const getActiveActionItems = () => {
    const items = [];
    
    // Check for appeals needed
    const appealsCount = getApplicantsForStage('appeal-documentation').length;
    if (appealsCount > 0) {
      const appealsApplicants = getApplicantsForStage('appeal-documentation');
      items.push({
        title: 'Appeal Documentation Required',
        description: `${appealsCount} applicant${appealsCount > 1 ? 's' : ''} need appeal documentation to proceed`,
        priority: 'urgent' as const,
        applicant: appealsApplicants.length === 1 ? appealsApplicants[0].name : null,
        clickable: false,
        type: null
      });
    }

    // Check for incomplete documents
    let incompleteDocsCount = 0;
    let incompleteDocsApplicants = [];
    applicants.forEach(applicant => {
      const progress = getDocumentProgress(applicant);
      if (progress.completed < progress.total) {
        incompleteDocsCount++;
        incompleteDocsApplicants.push(applicant);
      }
    });
    
    if (incompleteDocsCount > 0) {
      items.push({
        title: 'Missing Documentation',
        description: `${incompleteDocsCount} applicant${incompleteDocsCount > 1 ? 's' : ''} missing required documents`,
        priority: 'warning' as const,
        applicant: incompleteDocsApplicants.length === 1 ? incompleteDocsApplicants[0].name : null,
        clickable: true,
        type: 'documents' as const
      });
    }

    // Check for pending action items across all applicants
    let pendingActionItems = 0;
    let pendingActionApplicants = [];
    applicants.forEach(applicant => {
      const actionItemsInfo = getApplicantActionItems(applicant);
      const pendingItems = actionItemsInfo.actionItems.filter(item => 
        !applicant.completedActionItems?.includes(item)
      );
      if (pendingItems.length > 0 && !actionItemsInfo.isReadyToMove) {
        pendingActionItems += pendingItems.length;
        pendingActionApplicants.push(applicant);
      }
    });
    
    if (pendingActionItems > 0) {
      items.push({
        title: 'Pending Action Items',
        description: `${pendingActionItems} action item${pendingActionItems > 1 ? 's' : ''} awaiting completion`,
        priority: 'info' as const,
        applicant: pendingActionApplicants.length === 1 ? pendingActionApplicants[0].name : null,
        clickable: true,
        type: 'pending' as const
      });
    }

    // Add a follow-up item if none exist
    if (items.length === 0) {
      items.push({
        title: 'All Systems Green',
        description: 'All applicants are progressing smoothly - great work!',
        priority: 'info' as const,
        applicant: null,
        clickable: false,
        type: null
      });
    }

    return items;
  };

  const handleActionItemClick = (type: 'pending' | 'documents') => {
    setActionItemsType(type);
    setShowDetailedActionItems(true);
    setPendingDocumentChanges({}); // Clear any pending changes when opening modal
  };

  const toggleDocumentStatus = (applicantId: string, documentType: string, isFamilyMember: boolean = false, memberId?: string) => {
    setPendingDocumentChanges(prev => {
      const newChanges = { ...prev };
      if (!newChanges[applicantId]) {
        newChanges[applicantId] = { documents: {} };
      }
      
      if (isFamilyMember && memberId) {
        if (!newChanges[applicantId].familyMembers) {
          newChanges[applicantId].familyMembers = {};
        }
        if (!newChanges[applicantId].familyMembers[memberId]) {
          newChanges[applicantId].familyMembers[memberId] = { documents: {} };
        }
        newChanges[applicantId].familyMembers[memberId].documents[documentType] = 
          !newChanges[applicantId].familyMembers[memberId].documents[documentType];
      } else {
        newChanges[applicantId].documents[documentType] = 
          !newChanges[applicantId].documents[documentType];
      }
      
      return newChanges;
    });
  };

  const saveDocumentChanges = () => {
    setApplicants(prev => prev.map(applicant => {
      const changes = pendingDocumentChanges[applicant.id];
      if (!changes) return applicant;

      const updatedApplicant = { ...applicant };
      
      // Update main applicant documents
      if (changes.documents) {
        updatedApplicant.documents = { ...applicant.documents, ...changes.documents };
      }
      
      // Update family member documents
      if (changes.familyMembers) {
        updatedApplicant.familyMembers = applicant.familyMembers?.map(member => {
          const memberChanges = changes.familyMembers[member.id];
          if (!memberChanges) return member;
          
          return {
            ...member,
            documents: { ...member.documents, ...memberChanges.documents }
          };
        });
      }
      
      return updatedApplicant;
    }));
    
    setPendingDocumentChanges({});
  };

  const getDocumentStatus = (applicant: Applicant, documentType: string, isFamilyMember: boolean = false, memberId?: string) => {
    const changes = pendingDocumentChanges[applicant.id];
    if (!changes) {
      if (isFamilyMember && memberId) {
        const member = applicant.familyMembers?.find(m => m.id === memberId);
        return member?.documents?.[documentType] || false;
      }
      return applicant.documents?.[documentType] || false;
    }
    
    if (isFamilyMember && memberId && changes.familyMembers?.[memberId]) {
      return changes.familyMembers[memberId].documents[documentType] ?? 
             applicant.familyMembers?.find(m => m.id === memberId)?.documents?.[documentType] ?? false;
    }
    
    return changes.documents[documentType] ?? applicant.documents?.[documentType] ?? false;
  };

  const getStageExpirationInfo = (applicant: Applicant) => {
    const timeLimit = stageTimeLimits[applicant.currentStage];
    if (!timeLimit || timeLimit === 0) return null;

    // Find the most recent entry for the current stage in stageHistory
    let stageEntryDate;
    if (applicant.stageHistory && applicant.stageHistory.length > 0) {
      // Find the most recent transition to the current stage
      const currentStageEntries = applicant.stageHistory
        .filter(transition => transition.toStage === applicant.currentStage)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (currentStageEntries.length > 0) {
        // Parse the timestamp and create a date at noon to avoid timezone issues
        const timestamp = new Date(currentStageEntries[0].timestamp);
        stageEntryDate = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 12, 0, 0);
      } else {
        // If no stage history for current stage, use creation date
        const created = new Date(applicant.dateCreated);
        stageEntryDate = new Date(created.getFullYear(), created.getMonth(), created.getDate(), 12, 0, 0);
      }
    } else {
      // If no stage history at all, use creation date
      const created = new Date(applicant.dateCreated);
      stageEntryDate = new Date(created.getFullYear(), created.getMonth(), created.getDate(), 12, 0, 0);
    }

    const expirationDate = new Date(stageEntryDate);
    expirationDate.setDate(expirationDate.getDate() + timeLimit);
    
    const now = new Date();
    const timeRemaining = expirationDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
    
    return {
      stageEntryDate, // Include the stage entry date so we can edit it
      expirationDate,
      daysRemaining,
      isOverdue: daysRemaining < 0,
      isExpiringSoon: daysRemaining <= 2 && daysRemaining >= 0
    };
  };

  const formatExpirationDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const startEditingExpirationDate = (applicantId: string, currentDate: Date) => {
    setEditingExpirationDate(applicantId);
    // Format as YYYY-MM-DD for the date input, using the date components directly
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    setTempExpirationDate(`${year}-${month}-${day}`);
    
    console.log('Starting edit with date:', {
      currentDate: currentDate.toISOString(),
      year, month, day,
      formatted: `${year}-${month}-${day}`
    });
  };

  const saveExpirationDate = (applicantId: string) => {
    if (!tempExpirationDate) return;
    
    const applicant = applicants.find(a => a.id === applicantId);
    if (!applicant) return;
    
    // Get the time limit for this stage
    const timeLimit = stageTimeLimits[applicant.currentStage] || 0;
    
    // Create date from YYYY-MM-DD format (this is the expiration date the user wants)
    const [year, month, day] = tempExpirationDate.split('-').map(Number);
    const expirationDate = new Date(year, month - 1, day, 12, 0, 0);
    
    // Calculate the stage entry date by subtracting the time limit
    const stageEntryDate = new Date(expirationDate);
    stageEntryDate.setDate(stageEntryDate.getDate() - timeLimit);
    
    console.log('Date conversion:', {
      input: tempExpirationDate,
      expirationDate: expirationDate.toISOString(),
      timeLimit,
      stageEntryDate: stageEntryDate.toISOString(),
      formatted: stageEntryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    });

    // Find the most recent stage transition and update its timestamp
    if (applicant.stageHistory && applicant.stageHistory.length > 0) {
      const currentStageEntries = applicant.stageHistory
        .filter(transition => transition.toStage === applicant.currentStage)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (currentStageEntries.length > 0) {
        // Update the most recent transition timestamp with the calculated stage entry date
        const updatedStageHistory = applicant.stageHistory.map(transition => 
          transition.id === currentStageEntries[0].id 
            ? { ...transition, timestamp: stageEntryDate.toISOString() }
            : transition
        );
        
        setApplicants(prev => {
          const updated = prev.map(a => 
            a.id === applicantId 
              ? { ...a, stageHistory: updatedStageHistory }
              : a
          );
          console.log('Updated applicant stageHistory:', updated.find(a => a.id === applicantId)?.stageHistory);
          return updated;
        });
      }
    } else {
      // If no stage history, update the dateCreated with the calculated stage entry date
      setApplicants(prev => {
        const updated = prev.map(a => 
          a.id === applicantId 
            ? { ...a, dateCreated: stageEntryDate.toISOString() }
            : a
        );
        console.log('Updated applicant dateCreated:', updated.find(a => a.id === applicantId)?.dateCreated);
        return updated;
      });
    }
    
    setEditingExpirationDate(null);
    setTempExpirationDate('');
  };

  const cancelEditingExpirationDate = () => {
    setEditingExpirationDate(null);
    setTempExpirationDate('');
  };

  const getApplicantActionItems = (applicant: Applicant) => {
    const currentStageInfo = stageInformation.find(info => info.id === applicant.currentStage);
    if (!currentStageInfo || !currentStageInfo.requiredActions.length) {
      return {
        isReadyToMove: true,
        actionItems: []
      };
    }

    const actionItems = currentStageInfo.requiredActions.map(action => {
      const stakeholder = currentStageInfo.keyStakeholders.primary;
      
      // Personalize action items with applicant name where relevant
      let personalizedAction = action;
      if (action.toLowerCase().includes('applicant')) {
        personalizedAction = action.replace(/applicant/gi, applicant.name);
      }
      
      // Format as "Role: Action"
      if (personalizedAction.includes(':')) {
        return personalizedAction;
      } else {
        return `${stakeholder}: ${personalizedAction}`;
      }
    });

    // Determine if ready to move (simplified logic - could be enhanced)
    const documentProgress = getDocumentProgress(applicant);
    const hasRequiredDocs = documentProgress.completed === documentProgress.total;
    
    return {
      isReadyToMove: hasRequiredDocs && actionItems.length === 0,
      actionItems: actionItems.slice(0, 4) // Show max 4 action items to keep cards manageable
    };
  };

  const toggleActionItem = (applicantId: string, actionItem: string, isCompleted: boolean) => {
    setApplicants(prev => prev.map(applicant => {
      if (applicant.id !== applicantId) return applicant;
      
      const completedItems = applicant.completedActionItems || [];
      let updatedCompletedItems: string[];
      let updatedNotes = applicant.manualNotes || [];
      
      if (isCompleted) {
        // Mark as completed - add to completed list and create log entry
        updatedCompletedItems = [...completedItems, actionItem];
        const newNote: ManualNote = {
          id: generateSecureId('action_'),
          timestamp: new Date(),
          addedBy: 'Current User',
          note: `✅ Completed action item: ${actionItem}`,
          noteType: 'general'
        };
        updatedNotes = [newNote, ...updatedNotes];
      } else {
        // Mark as incomplete - remove from completed list and create log entry
        updatedCompletedItems = completedItems.filter(item => item !== actionItem);
        const newNote: ManualNote = {
          id: generateSecureId('action_undo_'),
          timestamp: new Date(),
          addedBy: 'Current User',
          note: `❌ Unmarked action item: ${actionItem}`,
          noteType: 'general'
        };
        updatedNotes = [newNote, ...updatedNotes];
      }
      
      return {
        ...applicant,
        completedActionItems: updatedCompletedItems,
        manualNotes: updatedNotes
      };
    }));
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const closeDetails = () => {
    setSelectedApplicant(null);
  };

  const openActionItemsCustomizer = (stageInfo: StageInfo) => {
    setCustomizingStageInfo(stageInfo);
    setShowActionItemsCustomizer(true);
  };

  const closeActionItemsCustomizer = () => {
    setShowActionItemsCustomizer(false);
    setCustomizingStageInfo(null);
  };

  const removeApplicant = () => {
    if (selectedApplicant && confirm('Are you sure you want to remove this applicant? This action cannot be undone.')) {
      setApplicants(prev => prev.filter(applicant => applicant.id !== selectedApplicant));
      closeDetails();
    }
  };

  const openFamilyForm = () => {
    setShowFamilyForm(true);
    setFamilyFormData({
      name: '',
      relationship: '',
      age: '',
      hmisNumber: ''
    });
  };

  const closeFamilyForm = () => {
    setShowFamilyForm(false);
  };

  const handleFamilyInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFamilyFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addFamilyMember = () => {
    if (!familyFormData.name.trim()) {
      alert('Please enter family member initials');
      return;
    }

    if (!selectedApplicant) return;

    const newFamilyMember: FamilyMember = {
      id: generateSecureId('fm_'),
      name: familyFormData.name.trim(),
      relationship: familyFormData.relationship.trim() || 'Family Member',
      age: familyFormData.age ? parseInt(familyFormData.age) : undefined,
      hmisNumber: familyFormData.hmisNumber.trim() || undefined,
      documents: {
        ssCard: false,
        birthCertificate: false,
        id: false
      }
    };

    setApplicants(prev => prev.map(applicant => 
      applicant.id === selectedApplicant 
        ? {
            ...applicant,
            familyMembers: [...(applicant.familyMembers || []), newFamilyMember]
          }
        : applicant
    ));

    closeFamilyForm();
  };

  const toggleFamilyDocument = (familyMemberId: string, documentType: 'ssCard' | 'birthCertificate' | 'id') => {
    if (!selectedApplicant) return;

    setApplicants(prev => prev.map(applicant => 
      applicant.id === selectedApplicant 
        ? {
            ...applicant,
            familyMembers: applicant.familyMembers?.map(member =>
              member.id === familyMemberId
                ? {
                    ...member,
                    documents: {
                      ...member.documents,
                      [documentType]: !member.documents[documentType]
                    }
                  }
                : member
            )
          }
        : applicant
    ));
  };

  const toggleApplicantDocument = (documentType: 'ssCard' | 'birthCertificate' | 'id') => {
    if (!selectedApplicant) return;

    setApplicants(prev => prev.map(applicant => 
      applicant.id === selectedApplicant 
        ? {
            ...applicant,
            documents: {
              ...applicant.documents,
              [documentType]: !applicant.documents?.[documentType]
            }
          }
        : applicant
    ));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const saveApplicant = () => {
    if (!formData.name.trim()) {
      alert('Please enter an applicant name');
      return;
    }

    if (selectedApplicant) {
      // Update existing applicant
      setApplicants(prev => prev.map(applicant => 
        applicant.id === selectedApplicant 
          ? {
              ...applicant,
              name: formData.name.trim(),
              unit: formData.unit.trim() || applicant.unit,
              phone: formData.phone.trim() || undefined,
              email: formData.email.trim() || undefined,
              caseManager: formData.caseManager.trim() || undefined,
              caseManagerPhone: formData.caseManagerPhone.trim() || undefined,
              caseManagerEmail: formData.caseManagerEmail.trim() || undefined
            }
          : applicant
      ));
      closeDetails();
    } else {
      // Add new applicant
      const newApplicant: Applicant = {
        id: generateSecureId('applicant_'),
        name: formData.name.trim(),
        unit: formData.unit.trim() || `Unit ${Math.floor(Math.random() * 900) + 100}`,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        caseManager: formData.caseManager.trim() || undefined,
        caseManagerPhone: formData.caseManagerPhone.trim() || undefined,
        caseManagerEmail: formData.caseManagerEmail.trim() || undefined,
        currentStage: 'awaiting-referral',
        dateCreated: new Date().toISOString()
      };
      setApplicants([...applicants, newApplicant]);
      closeModal();
    }
  };

  const handleDragStart = (e: React.DragEvent, applicantId: string) => {
    setDraggedItem(applicantId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    
    if (draggedItem) {
      const applicant = applicants.find(a => a.id === draggedItem);
      if (applicant && applicant.currentStage !== targetStage) {
        setPendingMove({
          applicantId: draggedItem,
          fromStage: applicant.currentStage,
          toStage: targetStage
        });
        setShowMoveConfirm(true);
        setMoveNote('');
      }
      setDraggedItem(null);
    }
  };

  const confirmMove = () => {
    if (pendingMove) {
      setApplicants(prev => 
        prev.map(applicant => {
          if (applicant.id === pendingMove.applicantId) {
            const newTransition: StageTransition = {
              id: generateSecureId('transition_'),
              fromStage: pendingMove.fromStage,
              toStage: pendingMove.toStage,
              timestamp: new Date(),
              movedBy: 'Current User', // TODO: Replace with actual user when auth is added
              note: moveNote.trim() || undefined
            };
            
            return {
              ...applicant,
              currentStage: pendingMove.toStage,
              stageHistory: [...(applicant.stageHistory || []), newTransition]
            };
          }
          return applicant;
        })
      );
      
      setShowMoveConfirm(false);
      setPendingMove(null);
      setMoveNote('');
    }
  };

  const cancelMove = () => {
    setShowMoveConfirm(false);
    setPendingMove(null);
    setMoveNote('');
  };

  const openAddNote = () => {
    setShowAddNote(true);
    setNewNote('');
    setNoteType('general');
  };

  const closeAddNote = () => {
    setShowAddNote(false);
    setNewNote('');
    setNoteType('general');
  };

  const addManualNote = () => {
    if (!newNote.trim() || !selectedApplicant) {
      alert('Please enter a note');
      return;
    }

    const manualNote: ManualNote = {
      id: generateSecureId('note_'),
      timestamp: new Date(),
      addedBy: 'Current User', // TODO: Replace with actual user when auth is added
      note: newNote.trim(),
      noteType: noteType
    };

    setApplicants(prev => prev.map(applicant => 
      applicant.id === selectedApplicant 
        ? {
            ...applicant,
            manualNotes: [...(applicant.manualNotes || []), manualNote]
          }
        : applicant
    ));

    closeAddNote();
  };

  const openEmailTemplates = () => {
    setShowEmailTemplates(true);
  };

  const closeEmailTemplates = () => {
    setShowEmailTemplates(false);
    setSelectedTemplate(null);
  };

  // Email functions
  const openEmailModal = (template: EmailTemplate) => {
    setSelectedEmailTemplate(template);
    setShowEmailModal(true);
  };

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setSelectedEmailTemplate(null);
  };

  // New email interface functions
  const openEmailInterface = (applicant: any) => {
    console.log('Opening email interface for applicant:', applicant);
    try {
      setEmailInterfaceApplicant(applicant);
      setShowEmailInterface(true);
    } catch (error) {
      console.error('Error opening email interface:', error);
      alert('Email functionality is currently unavailable.');
    }
  };

  const closeEmailInterface = () => {
    setShowEmailInterface(false);
    setEmailInterfaceApplicant(null);
  };

  // Migration functions
  const handleMigration = async () => {
    setIsMigrating(true);
    try {
      const result = await MigrationService.migrateToSupabase();
      if (result.success) {
        alert('Migration completed successfully! Your data has been moved to the cloud.');
        setShowMigrationModal(false);
        // Clear localStorage and set Supabase flag
        MigrationService.clearLocalStorageData();
        localStorage.setItem('psh_use_supabase', 'true');
        // Reload the page to start fresh with Supabase
        window.location.reload();
      } else {
        alert(`Migration failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Migration error:', error);
      alert('Migration failed. Please try again.');
    } finally {
      setIsMigrating(false);
    }
  };

  const skipMigration = () => {
    setShowMigrationModal(false);
    // User can continue with localStorage for now
  };

  // Email thread management functions
  const getOrCreateThread = (applicantId: string, applicantName: string, baseSubject: string) => {
    if (!emailThreads) {
      console.error('Email threads not initialized');
      return null;
    }
    
    // Look for existing active thread for this applicant
    let existingThread = emailThreads.find(thread => 
      thread.applicantId === applicantId && thread.isActive
    );

    if (existingThread) {
      // Update existing thread
      const updatedThread = {
        ...existingThread,
        emailCount: existingThread.emailCount + 1,
        lastActivity: new Date().toISOString(),
        participants: [...new Set([...existingThread.participants])], // Keep unique participants
      };
      
      setEmailThreads(prev => {
        const newThreads = prev.map(thread => 
          thread.id === existingThread.id ? updatedThread : thread
        );
        localStorage.setItem('psh_email_threads', JSON.stringify(newThreads));
        return newThreads;
      });
      
      return existingThread;
    } else {
      // Create new thread
      const newThread = {
        id: generateSecureId('thread'),
        applicantId,
        applicantName,
        subject: `[PSH-${applicantId.slice(-6)}] ${baseSubject}`,
        participants: [],
        emailCount: 1,
        lastActivity: new Date().toISOString(),
        isActive: true,
        createdDate: new Date().toISOString(),
      };

      setEmailThreads(prev => {
        const newThreads = [...prev, newThread];
        localStorage.setItem('psh_email_threads', JSON.stringify(newThreads));
        return newThreads;
      });

      return newThread;
    }
  };

  const getLastEmailInThread = (threadId: string) => {
    if (!emailArchive || emailArchive.length === 0) {
      return null;
    }
    const threadEmails = emailArchive.filter(email => email.threadId === threadId);
    if (threadEmails.length === 0) {
      return null;
    }
    return threadEmails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  };

  // Email archive functions
  const logEmailToArchive = (emailData: {
    applicantId: string;
    applicantName: string;
    subject: string;
    body: string;
    recipients: string[];
    templateId: string;
    templateName: string;
  }) => {
    try {
      // Simple fallback for now - just log the email without threading
      const emailRecord = {
        id: generateSecureId('email'),
        applicantId: emailData.applicantId,
        applicantName: emailData.applicantName,
        timestamp: new Date().toISOString(),
        subject: emailData.subject,
        body: emailData.body,
        recipients: emailData.recipients,
        templateId: emailData.templateId,
        templateName: emailData.templateName,
        threadId: 'simple-thread',
        threadSubject: emailData.subject,
        emailHeaders: {
          'Message-ID': `<${generateSecureId('msg')}@psh-tracker.local>`,
        }
      };

      setEmailArchive(prev => {
        const newArchive = [...prev, emailRecord];
        localStorage.setItem('psh_email_archive', JSON.stringify(newArchive));
        return newArchive;
      });

      console.log('Email logged to archive (simple mode):', emailRecord);
    } catch (error) {
      console.error('Error logging email to archive:', error);
    }
  };

  const getEmailsForApplicant = (applicantId: string) => {
    return emailArchive.filter(email => email.applicantId === applicantId);
  };

  const getCurrentApplicant = () => {
    if (!selectedApplicant) return null;
    return applicants.find(a => a.id === selectedApplicant) || null;
  };

  const fillEmailTemplate = (template: EmailTemplate) => {
    if (!selectedApplicant) return '';

    const applicant = applicants.find(a => a.id === selectedApplicant);
    if (!applicant) return template.body;

    let filledBody = template.body
      .replace(/\{\{applicantName\}\}/g, applicant.name || '[Applicant Name]')
      .replace(/\{\{unit\}\}/g, applicant.unit || '[Unit Number]')
      .replace(/\{\{applicantPhone\}\}/g, applicant.phone || '[Applicant Phone]')
      .replace(/\{\{applicantEmail\}\}/g, applicant.email || '[Applicant Email]')
      .replace(/\{\{caseManager\}\}/g, applicant.caseManager || '[Case Manager]')
      .replace(/\{\{caseManagerEmail\}\}/g, applicant.caseManagerEmail || '[Case Manager Email]')
      .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString())
      .replace(/\{\{userName\}\}/g, 'Kody Barnett'); // TODO: Replace with actual user

    let filledSubject = template.subject
      .replace(/\{\{applicantName\}\}/g, applicant.name || '[Applicant Name]')
      .replace(/\{\{unit\}\}/g, applicant.unit || '[Unit Number]');

    return { subject: filledSubject, body: filledBody };
  };

  const copyTemplateToClipboard = async (template: EmailTemplate) => {
    const filled = fillEmailTemplate(template);
    const emailContent = `Subject: ${filled.subject}\n\n${filled.body}`;
    
    try {
      await navigator.clipboard.writeText(emailContent);
      alert('Email template copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
      alert('Failed to copy to clipboard');
    }
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateFormData({
      name: '',
      subject: '',
      body: '',
      stageId: '',
      recipients: ''
    });
    setShowTemplateEditor(true);
  };

  const openEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      stageId: template.stageId || '',
      recipients: template.recipients.join(', ')
    });
    setShowTemplateEditor(true);
  };

  const closeTemplateEditor = () => {
    setShowTemplateEditor(false);
    setEditingTemplate(null);
    setTemplateFormData({
      name: '',
      subject: '',
      body: '',
      stageId: '',
      recipients: ''
    });
  };

  const handleTemplateFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTemplateFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const saveTemplate = () => {
    if (!templateFormData.name.trim() || !templateFormData.subject.trim() || !templateFormData.body.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    const recipientsList = templateFormData.recipients
      .split(',')
      .map(r => r.trim())
      .filter(r => r.length > 0);

    if (editingTemplate) {
      // Update existing template
      setEmailTemplates(prev => prev.map(template => 
        template.id === editingTemplate.id
          ? {
              ...template,
              name: templateFormData.name.trim(),
              subject: templateFormData.subject.trim(),
              body: templateFormData.body.trim(),
              stageId: templateFormData.stageId || undefined,
              recipients: recipientsList
            }
          : template
      ));
    } else {
      // Create new template
      const newTemplate: EmailTemplate = {
        id: generateSecureId('template_'),
        name: templateFormData.name.trim(),
        subject: templateFormData.subject.trim(),
        body: templateFormData.body.trim(),
        stageId: templateFormData.stageId || undefined,
        recipients: recipientsList
      };
      setEmailTemplates(prev => [...prev, newTemplate]);
    }

    closeTemplateEditor();
  };

  const openStageInfo = (stageId: string) => {
    const stageInfo = stageInformation.find(info => info.id === stageId);
    if (stageInfo) {
      setSelectedStageInfo(stageInfo);
      setShowStageInfo(true);
    }
  };

  const closeStageInfo = () => {
    setShowStageInfo(false);
    setSelectedStageInfo(null);
  };

  const openStageEditor = (stageInfo: StageInfo) => {
    setEditingStageInfo(stageInfo);
    
    // Format documents as text for editing (simplified approach)
    const documentsText = stageInfo.documents?.map(doc => 
      `${doc.name}|${doc.filename}|${doc.description || ''}|${doc.required}`
    ).join('\n') || '';
    
    setStageFormData({
      title: stageInfo.title,
      description: stageInfo.description,
      duration: stageInfo.duration,
      primaryStakeholder: stageInfo.keyStakeholders.primary,
      supportingStakeholders: stageInfo.keyStakeholders.supporting.join(', '),
      requiredActions: stageInfo.requiredActions.join('\n'),
      commonDelays: stageInfo.commonDelays.join('\n'),
      nextSteps: stageInfo.nextSteps,
      tips: stageInfo.tips.join('\n'),
      documents: documentsText
    });
    setShowStageEditor(true);
  };

  const closeStageEditor = () => {
    setShowStageEditor(false);
    setEditingStageInfo(null);
    setStageFormData({
      title: '',
      description: '',
      duration: '',
      primaryStakeholder: '',
      supportingStakeholders: '',
      requiredActions: '',
      commonDelays: '',
      nextSteps: '',
      tips: '',
      documents: ''
    });
  };

  const handleStageFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStageFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const saveStageInfo = () => {
    if (!editingStageInfo || !stageFormData.title.trim() || !stageFormData.description.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    // Parse documents from text format
    const documents: StageDocument[] = stageFormData.documents
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split('|');
        return {
          name: parts[0] || '',
          filename: parts[1] || '',
          description: parts[2] || undefined,
          required: parts[3] === 'true'
        };
      })
      .filter(doc => doc.name && doc.filename);

    const updatedStageInfo: StageInfo = {
      ...editingStageInfo,
      title: stageFormData.title.trim(),
      description: stageFormData.description.trim(),
      duration: stageFormData.duration.trim(),
      keyStakeholders: {
        primary: stageFormData.primaryStakeholder.trim(),
        supporting: stageFormData.supportingStakeholders
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0)
      },
      requiredActions: stageFormData.requiredActions
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0),
      commonDelays: stageFormData.commonDelays
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0),
      nextSteps: stageFormData.nextSteps.trim(),
      tips: stageFormData.tips
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0),
      documents: documents.length > 0 ? documents : undefined
    };

    setStageInformation(prev => prev.map(info => 
      info.id === editingStageInfo.id ? updatedStageInfo : info
    ));

    // Update the selected stage info if it's currently displayed
    if (selectedStageInfo?.id === editingStageInfo.id) {
      setSelectedStageInfo(updatedStageInfo);
    }

    closeStageEditor();
  };

  // Document download function
  const downloadDocument = (document: StageDocument, stageId: string) => {
    // Map stage IDs to folder names
    const stageToFolder: Record<string, string> = {
      'application-packet': '1.Appliction Packet',
      'tax-credit-paperwork': '2.Tax Credit Paperwork',
      'alexia-hf-processing': '3.New Referral Packet (to Home Forward)',
      'hf-packet-completion': '4.Home Forward Intake Packet',
      'lease-signing': '5.Contract and Lease Packet',
      'wraparound-intake': '6.Wraparound Support Intake Packet'
    };

    const folderName = stageToFolder[stageId];
    if (folderName) {
      const fullPath = `C:\\Users\\Kody Barnett\\PSH Tracking Platform\\Informational_Docs\\Packets\\${folderName}\\${document.filename}`;
      
      // For now, we'll show an alert with the file path since we can't directly download local files in a web browser
      // In a full implementation, these would be served by a web server
      alert(`Document: ${document.name}\n\nFile Location:\n${fullPath}\n\nNote: In production, this would download the file directly. For now, you can navigate to this location to access the document.`);
    } else {
      alert(`Document location not configured for this stage yet.`);
    }
  };

  // Data export/import functions
  const exportAllData = () => {
    const exportData = {
      applicants,
      emailTemplates,
      stageInformation,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `psh-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        if (importData.applicants && importData.emailTemplates && importData.stageInformation) {
          // Convert timestamp strings back to Date objects for applicants
          const processedApplicants = importData.applicants.map((applicant: any) => ({
            ...applicant,
            stageHistory: applicant.stageHistory?.map((transition: any) => ({
              ...transition,
              timestamp: new Date(transition.timestamp)
            })),
            manualNotes: applicant.manualNotes?.map((note: any) => ({
              ...note,
              timestamp: new Date(note.timestamp)
            }))
          }));
          
          setApplicants(processedApplicants);
          setEmailTemplates(importData.emailTemplates);
          setStageInformation(importData.stageInformation);
          
          // Save to localStorage
          saveToLocalStorage(STORAGE_KEYS.APPLICANTS, processedApplicants);
          saveToLocalStorage(STORAGE_KEYS.EMAIL_TEMPLATES, importData.emailTemplates);
          saveToLocalStorage(STORAGE_KEYS.STAGE_INFORMATION, importData.stageInformation);
          
          alert('Data imported successfully!');
        } else {
          alert('Invalid backup file format');
        }
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Error importing data. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset the input so the same file can be imported again if needed
    event.target.value = '';
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all data? This will remove all applicants, templates, and stage information. This action cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEYS.APPLICANTS);
      localStorage.removeItem(STORAGE_KEYS.EMAIL_TEMPLATES);
      localStorage.removeItem(STORAGE_KEYS.STAGE_INFORMATION);
      
      setApplicants([]);
      setEmailTemplates(defaultEmailTemplates);
      setStageInformation(initialStageInformation);
      
      alert('All data has been cleared and reset to defaults.');
    }
  };

  const getApplicantsForStage = (stageId: string) => {
    return applicants.filter(applicant => applicant.currentStage === stageId);
  };

  const getStageTitle = (stageId: string) => {
    return stages.find(stage => stage.id === stageId)?.title || stageId;
  };

  const getNoteTypeLabel = (type: string) => {
    switch (type) {
      case 'phone_call': return '📞 Phone Call';
      case 'email': return '📧 Email';
      case 'outreach': return '🤝 Outreach';
      default: return '📝 Note';
    }
  };

  const getAllLogEntries = (applicantId: string) => {
    const applicant = applicants.find(a => a.id === applicantId);
    if (!applicant) return [];

    const stageEntries = (applicant.stageHistory || []).map(transition => ({
      ...transition,
      type: 'stage_transition' as const,
      timestamp: transition.timestamp
    }));

    const noteEntries = (applicant.manualNotes || []).map(note => ({
      ...note,
      type: 'manual_note' as const,
      timestamp: note.timestamp
    }));

    return [...stageEntries, ...noteEntries].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  // Timestamp editing functions
  const startEditingTimestamp = (entryId: string, currentTimestamp: Date) => {
    setEditingTimestamp(entryId);
    // Convert to datetime-local format (YYYY-MM-DDTHH:mm)
    const localDateTime = new Date(currentTimestamp.getTime() - currentTimestamp.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setTempTimestamp(localDateTime);
  };

  const saveTimestamp = (entryId: string, entryType: 'stage_transition' | 'manual_note') => {
    if (!selectedApplicant || !tempTimestamp) return;

    const newTimestamp = new Date(tempTimestamp);

    setApplicants(prev => prev.map(applicant => {
      if (applicant.id !== selectedApplicant) return applicant;

      if (entryType === 'stage_transition') {
        const updatedStageHistory = (applicant.stageHistory || []).map(transition =>
          transition.id === entryId
            ? { ...transition, timestamp: newTimestamp }
            : transition
        );
        return { ...applicant, stageHistory: updatedStageHistory };
      } else {
        const updatedNotes = (applicant.manualNotes || []).map(note =>
          note.id === entryId
            ? { ...note, timestamp: newTimestamp }
            : note
        );
        return { ...applicant, manualNotes: updatedNotes };
      }
    }));

    setEditingTimestamp(null);
    setTempTimestamp('');
  };

  const cancelEditingTimestamp = () => {
    setEditingTimestamp(null);
    setTempTimestamp('');
  };

  return (
    <div className="h-screen bg-gray-50 flex" style={{ margin: 0, padding: 0, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Left Sidebar Details Panel */}
      {selectedApplicant && (
        <div className="w-1/4 bg-white border-r shadow-lg overflow-y-auto flex-shrink-0 max-h-screen">
          <div className="py-6 pr-6 pl-3 h-full">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Applicant Details</h3>
              <button
                onClick={closeDetails}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicant Initials *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
                    setFormData(prev => ({ ...prev, name: value }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter initials (2-3 letters)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Number
                </label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Unit 204"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HMIS Number
                </label>
                <input
                  type="text"
                  name="hmisNumber"
                  value={formData.hmisNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="County tracking database number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(503) 555-0123"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicant Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="applicant@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case Manager
                </label>
                <input
                  type="text"
                  name="caseManager"
                  value={formData.caseManager}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Kody Barnett"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case Manager Phone
                </label>
                <input
                  type="tel"
                  name="caseManagerPhone"
                  value={formData.caseManagerPhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(503) 555-0123"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case Manager Email
                </label>
                <input
                  type="email"
                  name="caseManagerEmail"
                  value={formData.caseManagerEmail}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="kody.barnett@example.org"
                />
              </div>
            </div>

            {/* Head of Household Documents Section */}
            {selectedApplicant && (
              <div className="mt-6 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Head of Household Documents</h4>
                <div className="bg-blue-50 rounded-md p-3 border">
                  <div className="mb-2">
                    <p className="font-medium text-sm text-gray-900">
                      {applicants.find(a => a.id === selectedApplicant)?.name}
                    </p>
                    <p className="text-xs text-gray-600">Head of Household</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleApplicantDocument('ssCard')}
                        className={`mr-1 hover:scale-110 transition-transform ${applicants.find(a => a.id === selectedApplicant)?.documents?.ssCard ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {applicants.find(a => a.id === selectedApplicant)?.documents?.ssCard ? '✅' : '❌'}
                      </button>
                      <span>SS Card</span>
                    </div>
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleApplicantDocument('id')}
                        className={`mr-1 hover:scale-110 transition-transform ${applicants.find(a => a.id === selectedApplicant)?.documents?.id ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {applicants.find(a => a.id === selectedApplicant)?.documents?.id ? '✅' : '❌'}
                      </button>
                      <span>Photo ID</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Family Members Section */}
            {selectedApplicant && (
              <div className="mt-6 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Family Members & Documents</h4>
                {applicants.find(a => a.id === selectedApplicant)?.familyMembers?.length ? (
                  <div className="space-y-3">
                    {applicants.find(a => a.id === selectedApplicant)?.familyMembers?.map(member => (
                      <div key={member.id} className="bg-gray-50 rounded-md p-3 border">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-sm text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-600">{member.relationship} {member.age && `(Age ${member.age})`}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleFamilyDocument(member.id, 'ssCard')}
                              className={`mr-1 hover:scale-110 transition-transform ${member.documents.ssCard ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {member.documents.ssCard ? '✅' : '❌'}
                            </button>
                            <span>SS Card</span>
                          </div>
                          <div className="flex items-center">
                            {member.age && member.age < 18 ? (
                              <button
                                onClick={() => toggleFamilyDocument(member.id, 'birthCertificate')}
                                className={`mr-1 hover:scale-110 transition-transform ${member.documents.birthCertificate ? 'text-green-600' : 'text-red-600'}`}
                              >
                                {member.documents.birthCertificate ? '✅' : '❌'}
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleFamilyDocument(member.id, 'id')}
                                className={`mr-1 hover:scale-110 transition-transform ${member.documents.id ? 'text-green-600' : 'text-red-600'}`}
                              >
                                {member.documents.id ? '✅' : '❌'}
                              </button>
                            )}
                            <span>{member.age && member.age < 18 ? 'Birth Cert' : 'ID'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No family members added yet</p>
                )}
                {!showFamilyForm ? (
                  <button 
                    onClick={openFamilyForm}
                    className="w-full mt-3 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    + Add Family Member
                  </button>
                ) : (
                  <div className="mt-3 p-3 bg-blue-50 rounded-md border">
                    <h5 className="text-sm font-medium text-gray-900 mb-3">Add Family Member</h5>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Initials *</label>
                        <input
                          type="text"
                          name="name"
                          value={familyFormData.name}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
                            setFamilyFormData(prev => ({ ...prev, name: value }));
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter initials (2-3 letters)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Relationship</label>
                        <select
                          name="relationship"
                          value={familyFormData.relationship}
                          onChange={handleFamilyInputChange}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select relationship</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Son">Son</option>
                          <option value="Daughter">Daughter</option>
                          <option value="Mother">Mother</option>
                          <option value="Father">Father</option>
                          <option value="Sister">Sister</option>
                          <option value="Brother">Brother</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Age</label>
                        <input
                          type="number"
                          name="age"
                          value={familyFormData.age}
                          onChange={handleFamilyInputChange}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter age"
                          min="0"
                          max="120"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">HMIS Number</label>
                        <input
                          type="text"
                          name="hmisNumber"
                          value={familyFormData.hmisNumber}
                          onChange={handleFamilyInputChange}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="County tracking number"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={addFamilyMember}
                        className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={closeFamilyForm}
                        className="flex-1 px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Process Log Section */}
            {selectedApplicant && (
              <div className="mt-6 border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Process Log</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEmailInterface(getCurrentApplicant())}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      📧 Email
                    </button>
                    <button
                      onClick={openAddNote}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      + Add Note
                    </button>
                  </div>
                </div>

                {/* Add Note Form - appears right under the buttons */}
                {showAddNote && (
                  <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200">
                    <h5 className="text-sm font-medium text-gray-900 mb-3">Add New Note</h5>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Note Type</label>
                        <select
                          value={noteType}
                          onChange={(e) => setNoteType(e.target.value as any)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                        >
                          <option value="general">📝 General Note</option>
                          <option value="phone_call">📞 Phone Call</option>
                          <option value="email">📧 Email</option>
                          <option value="outreach">🤝 Outreach Attempt</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Note *</label>
                        <textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                          rows={3}
                          placeholder="e.g., Called applicant - no answer, left voicemail. Called case manager to follow up on missing documents..."
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={addManualNote}
                        className="flex-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Add Note
                      </button>
                      <button
                        onClick={closeAddNote}
                        className="flex-1 px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

{getAllLogEntries(selectedApplicant).length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {getAllLogEntries(selectedApplicant).map(entry => (
                      <div key={entry.id} className={`rounded-md p-3 border text-xs ${
                        entry.type === 'stage_transition' ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex-1">
                            {entry.type === 'stage_transition' ? (
                              <p className="font-medium text-gray-900">
                                Moved from <span className="text-blue-600">{getStageTitle(entry.fromStage)}</span> to <span className="text-green-600">{getStageTitle(entry.toStage)}</span>
                              </p>
                            ) : (
                              <p className="font-medium text-gray-900">
                                {getNoteTypeLabel(entry.noteType)}
                              </p>
                            )}
                          </div>
                        </div>
                        {entry.note && (
                          <div className="mt-2 mb-2">
                            <p className="text-gray-700 italic bg-white p-2 rounded border text-xs">
                              "{entry.note}"
                            </p>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-gray-500">
                          <div className="flex items-center gap-2">
                            {editingTimestamp === entry.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="datetime-local"
                                  value={tempTimestamp}
                                  onChange={(e) => setTempTimestamp(e.target.value)}
                                  className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                  onClick={() => saveTimestamp(entry.id, entry.type)}
                                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                  title="Save timestamp"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={cancelEditingTimestamp}
                                  className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                  title="Cancel editing"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span>{entry.timestamp.toLocaleDateString()} at {entry.timestamp.toLocaleTimeString()}</span>
                                <button
                                  onClick={() => startEditingTimestamp(entry.id, entry.timestamp)}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                  title="Edit timestamp"
                                >
                                  📝
                                </button>
                              </div>
                            )}
                          </div>
                          <span>by {entry.type === 'stage_transition' ? entry.movedBy : entry.addedBy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No activity recorded yet. Move this applicant or add a note to start the process log.</p>
                )}
              </div>
            )}
            
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={saveApplicant}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={closeDetails}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={removeApplicant}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors mt-2"
              >
                Remove Applicant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
            🏠 PSH Housing Application Tracker
          </h1>
            <div className="flex items-center gap-3">
            <button
              onClick={openModal}
                className="btn-primary text-sm px-4 py-2"
            >
                ✨ New Applicant
            </button>
            {/* Data Dropdown Menu */}
            <div className="relative inline-block text-left">
              <div>
                <button
                  type="button"
                  className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-3 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => setShowDataDropdown(!showDataDropdown)}
                >
                  📊 Data
                  <svg className="-mr-1 ml-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {showDataDropdown && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        exportAllData();
                        setShowDataDropdown(false);
                      }}
                      className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      💾 Export Data
                    </button>
                    <label className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                      📁 Import Data
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          importData(e);
                          setShowDataDropdown(false);
                        }}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => {
                        downloadEmergencyBackup();
                        setShowDataDropdown(false);
                      }}
                      className="flex w-full items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      🚨 Emergency Backup
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={clearAllData}
                className="btn-danger text-xs px-3 py-1"
                title="Clear all data"
            >
                🗑️ Clear
            </button>
          </div>
          </div>
        </div>
        
        {/* Stats and Action Items - Top Band */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex gap-6">
            {/* Compact Statistics - Vertical Stack */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total:</span>
                <span className="font-bold text-gray-900">{applicants.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">In Progress:</span>
                <span className="font-bold text-blue-600">
                  {applicants.filter(a => a.currentStage !== 'completed').length}
                </span>
            </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Appeals:</span>
                <span className="font-bold text-yellow-600">
                  {applicants.filter(a => a.currentStage === 'appeal-documentation').length}
                </span>
                </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Completed:</span>
                <span className="font-bold text-green-600">
                  {applicants.filter(a => a.currentStage === 'completed').length}
                </span>
            </div>
          </div>

            {/* Action Items - Simplified */}
            <div className="flex-1">
              <div className="flex gap-2 overflow-x-auto">
              {getActiveActionItems().length === 0 ? (
                  <div className="text-center py-2 text-gray-500 text-sm">
                    <span className="text-lg mr-2">🎉</span>
                    All caught up! No urgent action items
                </div>
              ) : (
                  getActiveActionItems().slice(0, 5).map((item, index) => (
                  <div 
                    key={index} 
                    className={`action-item action-item-${item.priority} ${
                      item.clickable ? 'cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-all duration-200' : ''
                      } flex-shrink-0`}
                      onClick={() => {
                        if (item.clickable && item.type) {
                          handleActionItemClick(item.type);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-gray-900 flex items-center gap-1">
                        {item.title}
                        {item.clickable && (
                            <span className="text-xs text-blue-600 opacity-75">👆</span>
                        )}
                      </div>
                        <div className="text-xs text-gray-600 truncate">{item.description}</div>
                      {item.applicant && (
                          <div className="text-xs text-blue-600 font-medium">
                          👤 {item.applicant}
                        </div>
                      )}
                    </div>
                      <div className="ml-2 text-sm opacity-60">
                      {item.priority === 'urgent' ? '🔴' : item.priority === 'warning' ? '🟡' : 'ℹ️'}
                    </div>
                  </div>
                ))
              )}
                {getActiveActionItems().length > 5 && (
                  <div className="text-xs text-gray-500 flex items-center px-2">
                    +{getActiveActionItems().length - 5} more...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Kanban Board */}
        <div className="p-4">
          <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map(stage => (
            <div
              key={stage.id}
                    className={`${stage.color} border-2 rounded-xl p-3 min-h-80 w-72 flex-shrink-0 shadow-sm bg-gradient-to-b`}
                    style={{ width: '288px', minWidth: '288px', maxWidth: '288px' }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Stage Header */}
                    <div className={`${stage.headerColor} rounded-lg p-2 mb-3 shadow-sm border border-white/50`}>
                <button
                  onClick={() => openStageInfo(stage.id)}
                        className="w-full hover:bg-white/20 rounded-md transition-all duration-200 p-1 group"
                      >
                        <h2 className="font-semibold text-xs leading-tight text-center group-hover:scale-105 transition-transform" style={{
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          hyphens: 'auto',
                          lineHeight: '1.2'
                        }}>
                    {stage.title} 
                          <span className="ml-1 text-xs opacity-70">ℹ️</span>
                  </h2>
                        <div className="flex items-center justify-center mt-1">
                          <span className="bg-white/30 text-xs font-bold px-2 py-0.5 rounded-full">
                            {getApplicantsForStage(stage.id).length}
                    </span>
                  </div>
                </button>
              </div>
              
              {/* Applicant Cards */}
                    <div className="space-y-2 flex-1">
                {getApplicantsForStage(stage.id).map(applicant => {
                  const documentProgress = getDocumentProgress(applicant);
                  const actionItemsInfo = getApplicantActionItems(applicant);
                  const expirationInfo = getStageExpirationInfo(applicant);
                  return (
                  <div
                    key={applicant.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, applicant.id)}
                    onClick={() => selectApplicant(applicant.id)}
                      className={`bg-white rounded-lg shadow-sm border-2 p-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group w-full ${
                      selectedApplicant === applicant.id 
                        ? 'border-blue-400 ring-2 ring-blue-100 shadow-lg' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                      style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}
                  >
                    {/* Applicant Header */}
                      <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-xs leading-tight group-hover:text-blue-700 transition-colors" style={{
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            lineHeight: '1.2'
                          }}>
                          {applicant.name}
                        </h3>
                        {applicant.unit && (
                            <p className="text-xs text-gray-600 font-medium mt-1" style={{
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              lineHeight: '1.2'
                            }}>📍 {applicant.unit}</p>
                        )}
                        {expirationInfo && (
                          <div className={`text-xs font-medium mt-1 px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                            expirationInfo.isOverdue 
                              ? 'bg-red-100 text-red-700' 
                              : expirationInfo.isExpiringSoon 
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingExpirationDate(applicant.id, expirationInfo.expirationDate);
                          }}
                          title="Click to adjust expiration date"
                          >
                            {editingExpirationDate === applicant.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="date"
                                  value={tempExpirationDate}
                                  onChange={(e) => setTempExpirationDate(e.target.value)}
                                  className="text-xs bg-white border border-gray-300 rounded px-1 py-0.5 w-24"
                                  autoFocus
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    saveExpirationDate(applicant.id);
                                  }}
                                  className="text-green-600 hover:text-green-800 text-xs font-bold"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelEditingExpirationDate();
                                  }}
                                  className="text-red-600 hover:text-red-800 text-xs font-bold"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <>
                                {expirationInfo.isOverdue ? (
                                  `⚠️ Overdue by ${Math.abs(expirationInfo.daysRemaining)} days`
                                ) : expirationInfo.isExpiringSoon ? (
                                  `⏰ Expires ${formatExpirationDate(expirationInfo.expirationDate)}`
                                ) : (
                                  `✅ Expires ${formatExpirationDate(expirationInfo.expirationDate)}`
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Navigation Buttons */}
                      <div className="flex items-center gap-1">
                        {/* Move Left Button */}
                        {(() => {
                          const currentStageIndex = stages.findIndex(s => s.id === applicant.currentStage);
                          const canMoveLeft = currentStageIndex > 0;
                          const targetStage = canMoveLeft ? stages[currentStageIndex - 1] : null;
                          
                          return canMoveLeft ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingMove({
                                  applicantId: applicant.id,
                                  fromStage: applicant.currentStage,
                                  toStage: targetStage.id
                                });
                                setShowMoveConfirm(true);
                                setMoveNote('');
                              }}
                              className="w-6 h-6 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-md flex items-center justify-center text-blue-600 transition-all duration-200 text-xs font-bold opacity-0 group-hover:opacity-100"
                              title={`Move to: ${targetStage.title}`}
                            >
                              ◀
                            </button>
                          ) : null;
                        })()}
                        
                        {/* Move Right Button */}
                        {(() => {
                          const currentStageIndex = stages.findIndex(s => s.id === applicant.currentStage);
                          const canMoveRight = currentStageIndex < stages.length - 1;
                          const targetStage = canMoveRight ? stages[currentStageIndex + 1] : null;
                          
                          return canMoveRight ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingMove({
                                  applicantId: applicant.id,
                                  fromStage: applicant.currentStage,
                                  toStage: targetStage.id
                                });
                                setShowMoveConfirm(true);
                                setMoveNote('');
                              }}
                              className="w-6 h-6 bg-green-100 hover:bg-green-200 border border-green-300 rounded-md flex items-center justify-center text-green-600 transition-all duration-200 text-xs font-bold opacity-0 group-hover:opacity-100"
                              title={`Move to: ${targetStage.title}`}
                            >
                              ▶
                            </button>
                          ) : null;
                        })()}
                        
                        <div className="w-8 h-8 avatar-blue rounded-full flex items-center justify-center text-xs font-bold transition-all">
                          {applicant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      </div>
                    </div>

                    {/* Action Items / Status */}
                    <div className="space-y-2">
                      {actionItemsInfo.isReadyToMove ? (
                        <div className="flex justify-center">
                          <span className="badge-green text-xs font-semibold px-3 py-1.5 rounded-full border">
                            ✨ Ready to Move
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1 w-full overflow-hidden">
                          <div className="text-xs font-medium text-gray-700 mb-1">Action Items:</div>
                          {(() => {
                            const pendingItems = actionItemsInfo.actionItems.filter(item => 
                              !applicant.completedActionItems?.includes(item)
                            );
                            const completedItems = actionItemsInfo.actionItems.filter(item => 
                              applicant.completedActionItems?.includes(item)
                            );
                            
                            return (
                              <>
                                {/* Pending Action Items */}
                                {pendingItems.map((item, index) => (
                                  <div key={index} className="border rounded-md p-2 text-xs transition-all w-full bg-yellow-50 border-yellow-200" style={{ width: '100%', maxWidth: '100%' }}>
                                    <div className="flex items-start gap-2 w-full" style={{ width: '100%', maxWidth: '100%' }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleActionItem(applicant.id, item, true);
                                        }}
                                        className="flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center text-xs font-bold transition-all bg-white border-red-400 text-red-500 hover:border-red-500"
                                      >
                                        ✗
                                      </button>
                                      <div className="flex-1 min-w-0" style={{ 
                                        width: 'calc(100% - 24px)', 
                                        maxWidth: 'calc(100% - 24px)',
                                        overflow: 'hidden',
                                        wordWrap: 'break-word',
                                        overflowWrap: 'break-word',
                                        wordBreak: 'break-word'
                                      }}>
                                        <div className="font-medium text-yellow-800" style={{
                                          wordBreak: 'break-word', 
                                          overflowWrap: 'break-word',
                                          lineHeight: '1.2'
                                        }}>
                                          {item.split(':')[0]}:
                                        </div>
                                        <div className="text-xs leading-tight text-yellow-700" style={{
                                          wordBreak: 'break-word', 
                                          overflowWrap: 'break-word',
                                          lineHeight: '1.2'
                                        }}>
                                          {item.split(':').slice(1).join(':').trim()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                
                                {/* Completed Action Items - Collapsible */}
                                {completedItems.length > 0 && (
                                  <div className="mt-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCompletedItems(prev => ({
                                          ...prev,
                                          [applicant.id]: !prev[applicant.id]
                                        }));
                                      }}
                                      className="w-full text-left text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-200"
                                    >
                                      <span>✅ Completed Action Items ({completedItems.length})</span>
                                      <span className="text-xs">
                                        {showCompletedItems[applicant.id] ? '▲' : '▼'}
                                      </span>
                                    </button>
                                    
                                    {showCompletedItems[applicant.id] && (
                                      <div className="mt-1 space-y-1">
                                        {completedItems.map((item, index) => (
                                          <div key={`completed-${index}`} className="border rounded-md p-2 text-xs transition-all w-full bg-green-50 border-green-200" style={{ width: '100%', maxWidth: '100%' }}>
                                            <div className="flex items-start gap-2 w-full" style={{ width: '100%', maxWidth: '100%' }}>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleActionItem(applicant.id, item, false);
                                                }}
                                                className="flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center text-xs font-bold transition-all bg-green-500 border-green-500 text-white hover:bg-green-600"
                                              >
                                                ✓
                                              </button>
                                              <div className="flex-1 min-w-0" style={{ 
                                                width: 'calc(100% - 24px)', 
                                                maxWidth: 'calc(100% - 24px)',
                                                overflow: 'hidden',
                                                wordWrap: 'break-word',
                                                overflowWrap: 'break-word',
                                                wordBreak: 'break-word'
                                              }}>
                                                <div className="font-medium text-green-800" style={{
                                                  wordBreak: 'break-word', 
                                                  overflowWrap: 'break-word',
                                                  lineHeight: '1.2'
                                                }}>
                                                  {item.split(':')[0]}:
                                                </div>
                                                <div className="text-xs leading-tight text-green-700 line-through opacity-75" style={{
                                                  wordBreak: 'break-word', 
                                                  overflowWrap: 'break-word',
                                                  lineHeight: '1.2'
                                                }}>
                                                  {item.split(':').slice(1).join(':').trim()}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
                
                {getApplicantsForStage(stage.id).length === 0 && (
                  <div className="text-center text-gray-400 py-8 border-2 border-dashed border-gray-300 rounded-xl">
                    <div className="text-2xl mb-2">📋</div>
                    <p className="font-medium">No applicants in this stage</p>
                    <p className="text-xs mt-1">Drop cards here to move them</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        </div>

      {/* Modals */}
      <div>
        {/* Move Confirmation Modal */}
        {showMoveConfirm && pendingMove && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cancelMove();
              }
            }}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Confirm Stage Movement</h2>
                  <button
                    onClick={cancelMove}
                    style={{ 
                      color: '#9CA3AF', 
                      cursor: 'pointer', 
                      background: 'none', 
                      border: 'none', 
                      fontSize: '20px',
                      padding: '4px'
                    }}
                    title="Close modal"
                  >
                    ✕
                  </button>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ color: '#374151', marginBottom: '8px' }}>
                    Moving <span style={{ fontWeight: '600', color: '#2563EB' }}>
                  {applicants.find(a => a.id === pendingMove.applicantId)?.name}
                </span>
              </p>
                  <p style={{ fontSize: '14px', color: '#6B7280' }}>
                    From: <span style={{ fontWeight: '500', color: '#2563EB' }}>{getStageTitle(pendingMove.fromStage)}</span>
              </p>
                  <p style={{ fontSize: '14px', color: '#6B7280' }}>
                    To: <span style={{ fontWeight: '500', color: '#059669' }}>{getStageTitle(pendingMove.toStage)}</span>
              </p>
            </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Why is this applicant being moved? (Optional)
              </label>
              <textarea
                value={moveNote}
                onChange={(e) => setMoveNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                rows={3}
                placeholder="e.g., All documents received and verified, Background check completed, Need additional income verification..."
              />
            </div>
            
                <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={cancelMove}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      border: '1px solid #D1D5DB',
                      color: '#374151',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      backgroundColor: 'white'
                    }}
              >
                Cancel
              </button>
              <button
                onClick={confirmMove}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: '#2563EB',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
              >
                Confirm Move
              </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add New Applicant Modal */}
        {showModal && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeModal();
              }
            }}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Add New Applicant</h2>
                  <button
                    onClick={closeModal}
                    style={{ 
                      color: '#9CA3AF', 
                      cursor: 'pointer', 
                      background: 'none', 
                      border: 'none', 
                      fontSize: '20px',
                      padding: '4px'
                    }}
                    title="Close modal"
                  >
                    ✕
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Applicant Initials *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
                    setFormData(prev => ({ ...prev, name: value }));
                  }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                  placeholder="Enter initials (2-3 letters)"
                />
              </div>
              
              <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Unit Number
                </label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                  placeholder="e.g. Unit 204"
                />
              </div>
              
              <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  HMIS Number
                </label>
                <input
                  type="text"
                  name="hmisNumber"
                  value={formData.hmisNumber}
                  onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                  placeholder="County tracking database number"
                />
              </div>
              
              <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                  placeholder="(503) 555-0123"
                />
              </div>
              
              <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Applicant Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                  placeholder="applicant@example.com"
                />
              </div>
              
              <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Case Manager
                </label>
                <input
                  type="text"
                  name="caseManager"
                  value={formData.caseManager}
                  onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                  placeholder="e.g. Kody Barnett"
                />
              </div>
              
              <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Case Manager Phone
                </label>
                <input
                  type="tel"
                  name="caseManagerPhone"
                  value={formData.caseManagerPhone}
                  onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                  placeholder="(503) 555-0123"
                />
              </div>
              
              <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Case Manager Email
                </label>
                <input
                  type="email"
                  name="caseManagerEmail"
                  value={formData.caseManagerEmail}
                  onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                  placeholder="kody.barnett@example.org"
                />
              </div>
            </div>
            
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={closeModal}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      border: '1px solid #D1D5DB',
                      color: '#374151',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
              >
                Cancel
              </button>
              <button
                onClick={saveApplicant}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: '#2563EB',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
              >
                Add Applicant
              </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Templates Section (Below Kanban Board) */}
        {showEmailTemplates && selectedApplicant && (
          <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Email Templates</h2>
              <div className="flex gap-2">
                <button
                  onClick={openNewTemplate}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  + New Template
                </button>
                <button
                  onClick={closeEmailTemplates}
                  className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              {emailTemplates.map(template => (
                <div key={template.id} className="bg-white rounded-lg p-4 border">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600">
                        Recipients: {template.recipients.join(', ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditTemplate(template)}
                        className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => copyTemplateToClipboard(template)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        📋 Copy Email
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="text-sm">
                      <div className="mb-2">
                        <span className="font-medium text-gray-700">Subject: </span>
                        <span className="text-gray-900">
                          {fillEmailTemplate(template).subject}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Preview:</span>
                        <div className="mt-1 p-3 bg-gray-50 rounded text-xs whitespace-pre-line max-h-32 overflow-y-auto">
                          {fillEmailTemplate(template).body}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {emailTemplates.length === 0 && (
              <p className="text-gray-500 text-center py-8">No email templates available.</p>
            )}
          </div>
        )}

        {/* Template Editor Section (Below Email Templates) */}
        {showTemplateEditor && (
          <div className="mt-8 bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <button
                onClick={closeTemplateEditor}
                className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                ✕ Cancel
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={templateFormData.name}
                  onChange={handleTemplateFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Document Request Follow-up"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Associated Stage (Optional)
                </label>
                <select
                  name="stageId"
                  value={templateFormData.stageId}
                  onChange={handleTemplateFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Any Stage</option>
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.title}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Subject *
                </label>
                <input
                  type="text"
                  name="subject"
                  value={templateFormData.subject}
                  onChange={handleTemplateFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Follow-up: Documents needed for {{applicantName}}"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipients (comma-separated) *
                </label>
                <input
                  type="text"
                  name="recipients"
                  value={templateFormData.recipients}
                  onChange={handleTemplateFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., {{caseManagerEmail}}, kody@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body *
                </label>
                <textarea
                  name="body"
                  value={templateFormData.body}
                  onChange={handleTemplateFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  rows={8}
                  placeholder="Email content here. Use {{variables}} like {{applicantName}}, {{unit}}, {{caseManager}}, etc."
                />
              </div>
              
              <div className="bg-blue-50 p-3 rounded-md">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Available Variables:</h4>
                <div className="text-xs text-gray-600 grid grid-cols-2 gap-1">
                  <span>{'{{applicantName}}'}</span>
                  <span>{'{{unit}}'}</span>
                  <span>{'{{applicantPhone}}'}</span>
                  <span>{'{{applicantEmail}}'}</span>
                  <span>{'{{caseManager}}'}</span>
                  <span>{'{{caseManagerEmail}}'}</span>
                  <span>{'{{caseManagerPhone}}'}</span>
                  <span>{'{{currentDate}}'}</span>
                  <span>{'{{userName}}'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeTemplateEditor}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        )}

        {/* Detailed Action Items Modal */}
        {showDetailedActionItems && actionItemsType && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px'
            }}
            onClick={() => setShowDetailedActionItems(false)}
          >
            <div 
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                maxWidth: '800px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-bold text-gray-900">
                {actionItemsType === 'documents' ? '📄 Missing Documentation Details' : '⚡ Pending Action Items Details'}
              </h2>
                  <div className="flex items-center gap-2">
                    {Object.keys(pendingDocumentChanges).length > 0 && (
                      <button
                        onClick={saveDocumentChanges}
                        className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                      >
                        Save Changes
                      </button>
                    )}
              <button
                onClick={() => setShowDetailedActionItems(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
                  </div>
            </div>

            <div className="space-y-2">
              {actionItemsType === 'documents' ? (
                // Missing Documents Details
                <div>
                  {applicants.filter(applicant => {
                    try {
                    const progress = getDocumentProgress(applicant);
                    return progress.completed < progress.total;
                    } catch (error) {
                      console.error('Error getting document progress for applicant:', applicant, error);
                      return false;
                    }
                  }).map(applicant => {
                    let progress;
                    try {
                      progress = getDocumentProgress(applicant);
                    } catch (error) {
                      console.error('Error getting document progress for applicant:', applicant, error);
                      progress = { completed: 0, total: 0 };
                    }
                    return (
                      <div key={applicant.id} className="bg-gray-50 border border-gray-200 rounded p-3 mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                              {applicant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 text-sm">{applicant.name}</h3>
                              <p className="text-xs text-gray-600">{applicant.unit ? `Unit ${applicant.unit}` : 'No unit assigned'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-yellow-600 font-medium">
                              {progress.completed}/{progress.total} complete
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-700">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                            {/* Head of household documents */}
                            {!getDocumentStatus(applicant, 'id') && (
                              <div 
                                className="flex items-center gap-1 text-red-600 cursor-pointer hover:bg-red-50 p-1 rounded transition-colors"
                                onClick={() => toggleDocumentStatus(applicant.id, 'id')}
                                title="Click to mark as complete"
                              >
                                <span>❌</span> <span className="text-xs">Photo ID</span>
                              </div>
                            )}
                            {!getDocumentStatus(applicant, 'ssCard') && (
                              <div 
                                className="flex items-center gap-1 text-red-600 cursor-pointer hover:bg-red-50 p-1 rounded transition-colors"
                                onClick={() => toggleDocumentStatus(applicant.id, 'ssCard')}
                                title="Click to mark as complete"
                              >
                                <span>❌</span> <span className="text-xs">SS Card</span>
                              </div>
                            )}
                            {!getDocumentStatus(applicant, 'birthCertificate') && (
                              <div 
                                className="flex items-center gap-1 text-red-600 cursor-pointer hover:bg-red-50 p-1 rounded transition-colors"
                                onClick={() => toggleDocumentStatus(applicant.id, 'birthCertificate')}
                                title="Click to mark as complete"
                              >
                                <span>❌</span> <span className="text-xs">Birth Cert</span>
                              </div>
                            )}
                            
                            {/* Family member documents */}
                            {applicant.familyMembers?.map(member => (
                              <div key={member.id}>
                                {/* SS Card for all family members */}
                                {!getDocumentStatus(applicant, 'ssCard', true, member.id) && (
                                  <div 
                                    className="flex items-center gap-1 text-red-600 cursor-pointer hover:bg-red-50 p-1 rounded transition-colors"
                                    onClick={() => toggleDocumentStatus(applicant.id, 'ssCard', true, member.id)}
                                    title="Click to mark as complete"
                                  >
                                    <span>❌</span> <span className="text-xs">{member.name} - SS Card</span>
                                  </div>
                                )}
                                {/* Birth Certificate for children under 18 */}
                                {member.age && member.age < 18 && !getDocumentStatus(applicant, 'birthCertificate', true, member.id) && (
                                  <div 
                                    className="flex items-center gap-1 text-red-600 cursor-pointer hover:bg-red-50 p-1 rounded transition-colors"
                                    onClick={() => toggleDocumentStatus(applicant.id, 'birthCertificate', true, member.id)}
                                    title="Click to mark as complete"
                                  >
                                    <span>❌</span> <span className="text-xs">{member.name} - Birth Cert</span>
                                  </div>
                                )}
                                {/* Photo ID for adults 18+ */}
                                {member.age && member.age >= 18 && !getDocumentStatus(applicant, 'id', true, member.id) && (
                                  <div 
                                    className="flex items-center gap-1 text-red-600 cursor-pointer hover:bg-red-50 p-1 rounded transition-colors"
                                    onClick={() => toggleDocumentStatus(applicant.id, 'id', true, member.id)}
                                    title="Click to mark as complete"
                                  >
                                    <span>❌</span> <span className="text-xs">{member.name} - Photo ID</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Pending Action Items Details
                <div>
                  {applicants.filter(applicant => {
                    const actionItemsInfo = getApplicantActionItems(applicant);
                    const pendingItems = actionItemsInfo.actionItems.filter(item => 
                      !applicant.completedActionItems?.includes(item)
                    );
                    return pendingItems.length > 0 && !actionItemsInfo.isReadyToMove;
                  }).map(applicant => {
                    const actionItemsInfo = getApplicantActionItems(applicant);
                    const pendingItems = actionItemsInfo.actionItems.filter(item => 
                      !applicant.completedActionItems?.includes(item)
                    );
                    const currentStage = stages.find(s => s.id === applicant.currentStage);
                    
                    return (
                      <div key={applicant.id} className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 avatar-blue rounded-full flex items-center justify-center text-xs font-bold">
                              {applicant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{applicant.name}</h3>
                              <p className="text-sm text-gray-600">
                                {applicant.unit ? `Unit ${applicant.unit}` : 'No unit assigned'} • {currentStage?.title}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="text-blue-600 font-medium">
                              {pendingItems.length} pending action{pendingItems.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-700">
                          <p className="font-medium mb-2">Pending Action Items:</p>
                          <div className="space-y-2">
                            {pendingItems.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-2 bg-blue-50 rounded border">
                                <div className="flex-shrink-0 w-4 h-4 rounded border-2 border-blue-300 bg-white mt-0.5"></div>
                                <div className="flex-1 text-sm">
                                  {item.includes(':') ? (
                                    <div>
                                      <span className="font-medium text-blue-700">
                                        {item.split(':')[0]}:
                                      </span>
                                      <span className="text-gray-700 ml-1">
                                        {item.split(':').slice(1).join(':').trim()}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-700">{item}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage Information Modal (Below Template Editor) */}
        {showStageInfo && selectedStageInfo && (
          <div className="mt-8 bg-indigo-50 border-2 border-indigo-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                📋 {selectedStageInfo.title}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => openActionItemsCustomizer(selectedStageInfo)}
                  className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  🎯 Customize Action Items
                </button>
                <button
                  onClick={() => openStageEditor(selectedStageInfo)}
                  className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={closeStageInfo}
                  className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold text-gray-900 mb-2">📝 Description</h3>
                  <p className="text-sm text-gray-700">{selectedStageInfo.description}</p>
                </div>
                
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold text-gray-900 mb-2">⏱️ Expected Duration</h3>
                  <p className="text-sm text-gray-700 font-medium">{selectedStageInfo.duration}</p>
                </div>
                
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold text-gray-900 mb-2">👥 Key Stakeholders</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-blue-600">Primary: </span>
                      <span className="text-sm text-gray-700">{selectedStageInfo.keyStakeholders.primary}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-green-600">Supporting: </span>
                      <span className="text-sm text-gray-700">{selectedStageInfo.keyStakeholders.supporting.join(', ')}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold text-gray-900 mb-2">➡️ Next Steps</h3>
                  <p className="text-sm text-gray-700">{selectedStageInfo.nextSteps}</p>
                </div>
              </div>
              
              {/* Right Column */}
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold text-gray-900 mb-2">✅ Required Actions</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {selectedStageInfo.requiredActions.map((action, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-600 mr-2 mt-0.5">•</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold text-gray-900 mb-2">⚠️ Common Delays</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {selectedStageInfo.commonDelays.map((delay, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-600 mr-2 mt-0.5">•</span>
                        {delay}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold text-gray-900 mb-2">💡 Pro Tips</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {selectedStageInfo.tips.map((tip, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-600 mr-2 mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Documents Section - Full Width */}
            {console.log('Stage Info Documents:', selectedStageInfo.id, selectedStageInfo.documents)}
            {selectedStageInfo.documents && selectedStageInfo.documents.length > 0 && (
              <div className="mt-6 bg-white rounded-lg p-4 border">
                <h3 className="font-semibold text-gray-900 mb-4">📄 Required Documents & Forms</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedStageInfo.documents.map((document, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className={`mr-2 ${document.required ? 'text-red-600' : 'text-blue-600'}`}>
                            {document.required ? '📋' : '📄'}
                          </span>
                          <div>
                            <p className="font-medium text-sm text-gray-900">{document.name}</p>
                            {document.description && (
                              <p className="text-xs text-gray-600">{document.description}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              {document.required ? 'Required' : 'Optional'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadDocument(document, selectedStageInfo.id)}
                        className="ml-3 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        title={`Download ${document.name}`}
                      >
                        💾 Download
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-gray-500 italic">
                  💡 Tip: Download these documents before starting this stage to ensure you have everything needed.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage Editor Form (Below Stage Information) */}
        {showStageEditor && editingStageInfo && (
          <div className="mt-8 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                ✏️ Edit Stage Information: {editingStageInfo.title}
              </h2>
              <button
                onClick={closeStageEditor}
                className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                ✕ Cancel
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stage Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={stageFormData.title}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Stage title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    value={stageFormData.description}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    rows={3}
                    placeholder="What happens in this stage?"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Duration *
                  </label>
                  <input
                    type="text"
                    name="duration"
                    value={stageFormData.duration}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="e.g., 1-2 weeks, 3 business days"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Limit (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stageTimeLimits[editingStageInfo.id] || 0}
                    onChange={(e) => {
                      const days = parseInt(e.target.value) || 0;
                      setStageTimeLimits(prev => ({
                        ...prev,
                        [editingStageInfo.id]: days
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="0 = No time limit"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Set to 0 for no time limit. Cards will show expiration dates when moved to this stage.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Stakeholder *
                  </label>
                  <input
                    type="text"
                    name="primaryStakeholder"
                    value={stageFormData.primaryStakeholder}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="e.g., Vibrant Property Manager"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supporting Stakeholders (comma-separated)
                  </label>
                  <input
                    type="text"
                    name="supportingStakeholders"
                    value={stageFormData.supportingStakeholders}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="e.g., Case Manager, JOHS Staff, Home Forward"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Steps *
                  </label>
                  <textarea
                    name="nextSteps"
                    value={stageFormData.nextSteps}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    rows={2}
                    placeholder="What happens after this stage is complete?"
                  />
                </div>
              </div>
              
              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Required Actions (one per line) *
                  </label>
                  <textarea
                    name="requiredActions"
                    value={stageFormData.requiredActions}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    rows={4}
                    placeholder="List each required action on a new line"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Common Delays (one per line)
                  </label>
                  <textarea
                    name="commonDelays"
                    value={stageFormData.commonDelays}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    rows={4}
                    placeholder="List common issues that cause delays"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pro Tips (one per line)
                  </label>
                  <textarea
                    name="tips"
                    value={stageFormData.tips}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    rows={4}
                    placeholder="Helpful tips to make this stage go smoother"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Documents (one per line, format: Name|Filename|Description|Required)
                  </label>
                  <textarea
                    name="documents"
                    value={stageFormData.documents}
                    onChange={handleStageFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    rows={4}
                    placeholder="e.g., Application Form|application.pdf|Main application form|true"
                  />
                  <div className="mt-1 text-xs text-gray-600">
                    Format: Name|Filename|Description|Required (true/false)
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeStageEditor}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveStageInfo}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Action Items Customizer Modal */}
        {showActionItemsCustomizer && customizingStageInfo && (
          <div className="mt-8 bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                🎯 Customize Action Items: {customizingStageInfo.title}
              </h2>
              <button
                onClick={closeActionItemsCustomizer}
                className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                ✕ Close
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-3">Current Action Items</h3>
                <div className="space-y-2">
                  {customizingStageInfo.requiredActions.map((action, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
                      <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-purple-800">
                          {customizingStageInfo.keyStakeholders.primary}:
                        </div>
                        <div className="text-sm text-gray-700">{action}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">ℹ️ About Action Items Customization</h3>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>• Action items are currently derived from the stage's "Required Actions" list</p>
                  <p>• The primary stakeholder ({customizingStageInfo.keyStakeholders.primary}) is automatically assigned as responsible</p>
                  <p>• To modify these action items, use the "Edit" button to update the stage's Required Actions</p>
                  <p>• Future versions will allow direct customization of action items per stage</p>
                </div>
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    closeActionItemsCustomizer();
                    openStageEditor(customizingStageInfo);
                  }}
                  className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  ✏️ Edit Stage Required Actions
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      
      {/* Email Modal - Rendered outside main container */}
      <EmailModal
        isOpen={showEmailModal}
        onClose={closeEmailModal}
        template={selectedEmailTemplate || undefined}
        applicant={getCurrentApplicant() || undefined}
        emailService={emailService}
      />
      
      {/* New Email Interface - Rendered outside main container */}
      <EmailInterface
        isOpen={showEmailInterface}
        onClose={closeEmailInterface}
        applicant={emailInterfaceApplicant || { name: 'Unknown Applicant' }}
        emailService={emailService}
        onEmailSent={logEmailToArchive}
        emailArchive={emailArchive}
        emailThreads={emailThreads}
      />

      {/* Migration Modal */}
      {showMigrationModal && console.log('🎯 RENDERING MIGRATION MODAL') || showMigrationModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" 
          style={{
            zIndex: 99999, 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}>
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl" 
            style={{
              zIndex: 100000,
              backgroundColor: 'white',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-blue-600 text-lg">☁️</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Migrate to Cloud</h2>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                We've detected that you have local data that can be migrated to the cloud for real-time collaboration.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <span className="text-blue-600 text-sm font-medium">Migration Status:</span>
                </div>
                <div className="text-sm text-blue-800">
                  {migrationStatus?.hasLocalData && (
                    <div className="flex items-center mb-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      Local data found
                    </div>
                  )}
                  {migrationStatus?.hasSupabaseData && (
                    <div className="flex items-center mb-1">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      Cloud data found
                    </div>
                  )}
                  {migrationStatus?.needsMigration && (
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                      Migration needed
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={skipMigration}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                disabled={isMigrating}
              >
                Skip for Now
              </button>
              <button
                onClick={handleMigration}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={isMigrating}
              >
                {isMigrating ? 'Migrating...' : 'Migrate Now'}
              </button>
            </div>
            
            {isMigrating && (
              <div className="mt-4 text-center">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">Moving your data to the cloud...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    </div>
  );
}

export default App;