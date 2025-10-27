import { createClient } from '@supabase/supabase-js'

// Supabase configuration
// TODO: Move these to environment variables once Vite loads them properly
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zjhpiabxwixkfndcvmoh.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqaHBpYWJ4d2l4a2ZuZGN2bW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNTE3MDQsImV4cCI6MjA3NjgyNzcwNH0.2TEP7vE1jA88BLc9sBRQA0ySGmmyUMhcp0x-8CQFsos'

// Debug: Log what we're getting
console.log('🔍 Environment check:', {
  hasUrl: !!supabaseUrl && supabaseUrl !== 'your_supabase_url_here',
  hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key_here',
  urlPrefix: supabaseUrl?.substring(0, 20),
  keyPrefix: supabaseAnonKey?.substring(0, 20)
});

// Validate environment variables
if (!supabaseUrl || supabaseUrl === 'your_supabase_url_here') {
  console.warn('⚠️ VITE_SUPABASE_URL is not set in environment variables')
}

if (!supabaseAnonKey || supabaseAnonKey === 'your_supabase_anon_key_here') {
  console.warn('⚠️ VITE_SUPABASE_ANON_KEY is not set in environment variables')
}

// Only create Supabase client if we have valid credentials
let supabase: any = null;
if (supabaseUrl && supabaseUrl !== 'your_supabase_url_here' && supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key_here') {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase client initialized');
} else {
  console.warn('⚠️ Supabase not configured - using localStorage fallback');
}

export { supabase }

// Database types
export interface Database {
  public: {
    Tables: {
      buildings: {
        Row: {
          id: string
          name: string
          address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          created_at?: string
        }
      }
      applicants: {
        Row: {
          id: string
          building_id: string
          name: string
          unit: string | null
          hmis_number: string | null
          phone: string | null
          email: string | null
          case_manager: string | null
          case_manager_phone: string | null
          case_manager_email: string | null
          current_stage: string
          documents: any | null
          family_members: any | null
          stage_history: any | null
          manual_notes: any | null
          completed_action_items: any | null
          date_created: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          building_id: string
          name: string
          unit?: string | null
          hmis_number?: string | null
          phone?: string | null
          email?: string | null
          case_manager?: string | null
          case_manager_phone?: string | null
          case_manager_email?: string | null
          current_stage: string
          documents?: any | null
          family_members?: any | null
          stage_history?: any | null
          manual_notes?: any | null
          completed_action_items?: any | null
          date_created?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          building_id?: string
          name?: string
          unit?: string | null
          hmis_number?: string | null
          phone?: string | null
          email?: string | null
          case_manager?: string | null
          case_manager_phone?: string | null
          case_manager_email?: string | null
          current_stage?: string
          documents?: any | null
          family_members?: any | null
          stage_history?: any | null
          manual_notes?: any | null
          completed_action_items?: any | null
          date_created?: string
          created_at?: string
          updated_at?: string
        }
      }
      email_templates: {
        Row: {
          id: string
          building_id: string
          name: string
          subject: string
          body: string
          stage_id: string | null
          recipients: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          building_id: string
          name: string
          subject: string
          body: string
          stage_id?: string | null
          recipients?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          building_id?: string
          name?: string
          subject?: string
          body?: string
          stage_id?: string | null
          recipients?: any | null
          created_at?: string
          updated_at?: string
        }
      }
      stage_information: {
        Row: {
          id: string
          building_id: string
          stage_id: string
          title: string
          description: string
          duration: string
          key_stakeholders: any | null
          required_actions: any | null
          common_delays: any | null
          next_steps: string | null
          tips: any | null
          documents: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          building_id: string
          stage_id: string
          title: string
          description: string
          duration: string
          key_stakeholders?: any | null
          required_actions?: any | null
          common_delays?: any | null
          next_steps?: string | null
          tips?: any | null
          documents?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          building_id?: string
          stage_id?: string
          title?: string
          description?: string
          duration?: string
          key_stakeholders?: any | null
          required_actions?: any | null
          common_delays?: any | null
          next_steps?: string | null
          tips?: any | null
          documents?: any | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Helper functions for Supabase operations
export const supabaseService = {
  // Buildings
  async getBuildings() {
    if (!supabase) {
      throw new Error('Supabase is not configured');
    }
    
    const { data, error } = await supabase
      .from('buildings')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data
  },

  // Applicants
  async getApplicants(buildingId: string) {
    const { data, error } = await supabase
      .from('applicants')
      .select('*')
      .eq('building_id', buildingId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  async createApplicant(applicant: any) {
    const { data, error } = await supabase
      .from('applicants')
      .insert(applicant)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateApplicant(id: string, updates: any) {
    if (!supabase) {
      throw new Error('Supabase is not configured');
    }
    
    const { data, error } = await supabase
      .from('applicants')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async deleteApplicant(id: string) {
    const { error } = await supabase
      .from('applicants')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  async createOrUpdateApplicant(applicantData: any) {
    if (!supabase) {
      throw new Error('Supabase is not configured');
    }
    
    // Use upsert to insert or update
    const { data, error } = await supabase
      .from('applicants')
      .upsert(applicantData, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Email Templates
  async getEmailTemplates(buildingId: string) {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('building_id', buildingId)
      .order('name')
    
    if (error) throw error
    return data
  },

  async createEmailTemplate(template: any) {
    const { data, error } = await supabase
      .from('email_templates')
      .insert(template)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateEmailTemplate(id: string, updates: any) {
    const { data, error } = await supabase
      .from('email_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async deleteEmailTemplate(id: string) {
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Stage Information
  async getStageInformation(buildingId: string) {
    const { data, error } = await supabase
      .from('stage_information')
      .select('*')
      .eq('building_id', buildingId)
      .order('id')
    
    if (error) throw error
    return data
  },

  async createStageInformation(stageInfo: any) {
    const { data, error } = await supabase
      .from('stage_information')
      .insert(stageInfo)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateStageInformation(id: string, updates: any) {
    const { data, error } = await supabase
      .from('stage_information')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async deleteStageInformation(id: string) {
    const { error } = await supabase
      .from('stage_information')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Migration Service
export const MigrationService = {
  async checkMigrationStatus() {
    try {
      // Check if we have local data
      const hasLocalData = !!(
        localStorage.getItem('psh-tracker-applicants') ||
        localStorage.getItem('psh-tracker-email-templates') ||
        localStorage.getItem('psh-tracker-stage-information')
      );

      // Check if we have Supabase data
      let hasSupabaseData = false;
      if (supabase) {
        const { data: applicants } = await supabase
          .from('applicants')
          .select('id')
          .limit(1);
        
        hasSupabaseData = applicants && applicants.length > 0;
      }

      return {
        hasLocalData,
        hasSupabaseData,
        needsMigration: hasLocalData && !hasSupabaseData
      };
    } catch (error) {
      console.error('Error checking migration status:', error);
      return {
        hasLocalData: false,
        hasSupabaseData: false,
        needsMigration: false
      };
    }
  },

  async migrateToSupabase() {
    try {
      const buildingId = '00000000-0000-0000-0000-000000000001'; // Default building ID
      
      // Get local data
      const applicants = JSON.parse(localStorage.getItem('psh-tracker-applicants') || '[]');
      const emailTemplates = JSON.parse(localStorage.getItem('psh-tracker-email-templates') || '[]');
      const stageInformation = JSON.parse(localStorage.getItem('psh-tracker-stage-information') || '[]');

      // Migrate applicants
      for (const applicant of applicants) {
        await supabaseService.createApplicant({
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
          stage_history: applicant.stageHistory || [],
          manual_notes: applicant.manualNotes || [],
          completed_action_items: applicant.completedActionItems || [],
          date_created: applicant.dateCreated || new Date().toISOString()
        });
      }

      // Migrate email templates
      for (const template of emailTemplates) {
        await supabaseService.createEmailTemplate({
          building_id: buildingId,
          name: template.name,
          subject: template.subject,
          body: template.body,
          stage_id: template.stageId || null,
          recipients: template.recipients || []
        });
      }

      // Migrate stage information
      for (const stage of stageInformation) {
        await supabaseService.createStageInformation({
          building_id: buildingId,
          stage_id: stage.id,
          title: stage.title,
          description: stage.description,
          duration: stage.duration,
          key_stakeholders: stage.keyStakeholders || {},
          required_actions: stage.requiredActions || [],
          common_delays: stage.commonDelays || [],
          next_steps: stage.nextSteps || null,
          tips: stage.tips || [],
          documents: stage.documents || []
        });
      }

      return { success: true, message: 'Migration completed successfully' };
    } catch (error) {
      console.error('Migration error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  clearLocalStorageData() {
    localStorage.removeItem('psh-tracker-applicants');
    localStorage.removeItem('psh-tracker-email-templates');
    localStorage.removeItem('psh-tracker-stage-information');
    localStorage.removeItem('psh_email_archive');
    localStorage.removeItem('psh_email_threads');
    // Set a flag to force Supabase usage
    localStorage.setItem('psh_use_supabase', 'true');
  }
};
