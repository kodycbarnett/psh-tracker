import { supabaseService } from './supabase';

// Migration service to move data from localStorage to Supabase
export class MigrationService {
  // Migrate all data from localStorage to Supabase
  static async migrateToSupabase(buildingId: string = '00000000-0000-0000-0000-000000000001') {
    try {
      console.log('Starting migration to Supabase...');
      
      // Get data from localStorage
      const applicants = this.getLocalStorageData('psh-tracker-applicants', []);
      const emailTemplates = this.getLocalStorageData('psh-tracker-email-templates', []);
      const stageInformation = this.getLocalStorageData('psh-tracker-stage-information', []);
      
      console.log(`Found ${applicants.length} applicants, ${emailTemplates.length} email templates, ${stageInformation.length} stage info items`);
      
      // Migrate applicants
      if (applicants.length > 0) {
        console.log('Migrating applicants...');
        for (const applicant of applicants) {
          try {
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
          } catch (error) {
            console.error('Error migrating applicant:', applicant.name, error);
          }
        }
      }
      
      // Migrate email templates
      if (emailTemplates.length > 0) {
        console.log('Migrating email templates...');
        for (const template of emailTemplates) {
          try {
            await supabaseService.createEmailTemplate({
              building_id: buildingId,
              name: template.name,
              subject: template.subject,
              body: template.body,
              stage_id: template.stageId || null,
              recipients: template.recipients || []
            });
          } catch (error) {
            console.error('Error migrating email template:', template.name, error);
          }
        }
      }
      
      // Migrate stage information
      if (stageInformation.length > 0) {
        console.log('Migrating stage information...');
        for (const stage of stageInformation) {
          try {
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
          } catch (error) {
            console.error('Error migrating stage information:', stage.title, error);
          }
        }
      }
      
      console.log('Migration completed successfully!');
      return { success: true, message: 'Migration completed successfully!' };
      
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, message: `Migration failed: ${error.message}` };
    }
  }
  
  // Get data from localStorage with fallback
  private static getLocalStorageData(key: string, defaultValue: any) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  }
  
  // Check if migration is needed
  static async checkMigrationStatus(buildingId: string = '00000000-0000-0000-0000-000000000001') {
    try {
      // Check if we have data in localStorage
      const hasLocalData = this.hasLocalStorageData();
      
      // Check if we have data in Supabase
      const supabaseApplicants = await supabaseService.getApplicants(buildingId);
      const hasSupabaseData = supabaseApplicants.length > 0;
      
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
  }
  
  // Check if localStorage has data
  private static hasLocalStorageData(): boolean {
    const keys = ['psh-tracker-applicants', 'psh-tracker-email-templates', 'psh-tracker-stage-information'];
    return keys.some(key => {
      const data = localStorage.getItem(key);
      return data && JSON.parse(data).length > 0;
    });
  }
  
  // Clear localStorage data after successful migration
  static clearLocalStorageData() {
    const keys = ['psh-tracker-applicants', 'psh-tracker-email-templates', 'psh-tracker-stage-information'];
    keys.forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(key + '_backup');
      localStorage.removeItem(key + '_version');
      localStorage.removeItem(key + '_checksum');
    });
    console.log('LocalStorage data cleared after migration');
  }
}
