-- PSH Tracker Database Schema
-- Run this in your Supabase SQL Editor

-- Create buildings table
CREATE TABLE IF NOT EXISTS buildings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create applicants table
CREATE TABLE IF NOT EXISTS applicants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  hmis_number TEXT,
  phone TEXT,
  email TEXT,
  case_manager TEXT,
  case_manager_phone TEXT,
  case_manager_email TEXT,
  current_stage TEXT NOT NULL DEFAULT 'awaiting-referral',
  documents JSONB DEFAULT '{}',
  family_members JSONB DEFAULT '[]',
  stage_history JSONB DEFAULT '[]',
  manual_notes JSONB DEFAULT '[]',
  completed_action_items JSONB DEFAULT '[]',
  date_created TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  stage_id TEXT,
  recipients JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stage_information table
CREATE TABLE IF NOT EXISTS stage_information (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL, -- This is the actual stage identifier like 'awaiting-referral'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  duration TEXT NOT NULL,
  key_stakeholders JSONB DEFAULT '{}',
  required_actions JSONB DEFAULT '[]',
  common_delays JSONB DEFAULT '[]',
  next_steps TEXT,
  tips JSONB DEFAULT '[]',
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create allowed_emails table for access control
CREATE TABLE IF NOT EXISTS allowed_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'case_manager' CHECK (role IN ('admin', 'property_manager', 'case_manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_applicants_building_id ON applicants(building_id);
CREATE INDEX IF NOT EXISTS idx_applicants_current_stage ON applicants(current_stage);
CREATE INDEX IF NOT EXISTS idx_email_templates_building_id ON email_templates(building_id);
CREATE INDEX IF NOT EXISTS idx_stage_information_building_id ON stage_information(building_id);
CREATE INDEX IF NOT EXISTS idx_allowed_emails_email ON allowed_emails(email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add missing columns to existing tables (if they don't exist)
DO $$
BEGIN
    -- Add date_created to applicants table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'applicants' AND column_name = 'date_created') THEN
        ALTER TABLE applicants ADD COLUMN date_created TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- Add stage_id to stage_information table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stage_information' AND column_name = 'stage_id') THEN
        ALTER TABLE stage_information ADD COLUMN stage_id TEXT;
    END IF;
END $$;

-- Create triggers for updated_at (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_applicants_updated_at') THEN
        CREATE TRIGGER update_applicants_updated_at BEFORE UPDATE ON applicants
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_templates_updated_at') THEN
        CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stage_information_updated_at') THEN
        CREATE TRIGGER update_stage_information_updated_at BEFORE UPDATE ON stage_information
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (for now, allow all access - we'll tighten this later)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to buildings' AND tablename = 'buildings') THEN
        CREATE POLICY "Allow all access to buildings" ON buildings FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to applicants' AND tablename = 'applicants') THEN
        CREATE POLICY "Allow all access to applicants" ON applicants FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to email_templates' AND tablename = 'email_templates') THEN
        CREATE POLICY "Allow all access to email_templates" ON email_templates FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to stage_information' AND tablename = 'stage_information') THEN
        CREATE POLICY "Allow all access to stage_information" ON stage_information FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to allowed_emails' AND tablename = 'allowed_emails') THEN
        CREATE POLICY "Allow all access to allowed_emails" ON allowed_emails FOR ALL USING (true);
    END IF;
END $$;

-- Insert default building (you can modify this)
INSERT INTO buildings (id, name, address) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Vibrant Apartments', '123 Main St, Portland, OR')
ON CONFLICT (id) DO NOTHING;

-- Insert default allowed emails (replace with your actual emails)
INSERT INTO allowed_emails (email, building_id, role) VALUES 
  ('your-email@domain.com', '00000000-0000-0000-0000-000000000001', 'admin'),
  ('property-manager@domain.com', '00000000-0000-0000-0000-000000000001', 'property_manager'),
  ('case-manager@domain.com', '00000000-0000-0000-0000-000000000001', 'case_manager')
ON CONFLICT (email) DO NOTHING;

-- Insert default stage information for the building
INSERT INTO stage_information (id, building_id, stage_id, title, description, duration, key_stakeholders, required_actions, common_delays, next_steps, tips) VALUES 
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'awaiting-referral', 'Waiting for JOHS Referral', 'A PSH unit has become available and we are waiting for a referral from JOHS Family Coordinated Access.', '3 weeks maximum', '{"primary": "Vibrant Property Manager", "supporting": ["JOHS Family CA Team", "IPM Property Management"]}', '["Notify JOHS of vacant unit", "Get unit inspected", "Add referral request to PBS8 Google tracking sheet"]', '["JOHS taking longer than 3 weeks to respond", "Incomplete referral request information", "High demand for PSH units"]', 'Once JOHS provides a referral, begin LIHTC screening and application process', '["If no referral after 3 weeks, can pull from Section 8 waitlist", "Include IHI Housing Stability Specialist on HP referrals", "Track all communication in PBS8 tracking sheet"]'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'application-packet', 'Waiting on Application Packet', 'Applicant and case manager work together to complete the initial application packet and gather vital documents.', '1-2 weeks', '{"primary": "Case Manager (IHI/JOIN)", "supporting": ["Applicant", "Vibrant Property Manager", "Family CA Staff"]}', '["Call referring Case Manager and assess if applicant needs to collect appeal documentation early and to explain process, which includes government docs", "Verify Application accuracy/correctness"]', '["Missing birth certificates for children", "Applicant unresponsive or hard to reach", "Difficulty obtaining social security cards", "Case manager caseload issues"]', 'Submit completed packet for background check screening', '["Start gathering documents immediately upon referral", "Case managers can provide direct support", "Keep applicant informed of requirements"]')
ON CONFLICT (id) DO NOTHING;

-- Insert default email templates
INSERT INTO email_templates (id, building_id, name, subject, body, stage_id, recipients) VALUES 
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'New Referral Request', 'PSH Unit Available - Referral Request for {{unit}}', 'Hi JOHS Team,\n\nWe have a PSH unit available at Vibrant and are requesting a referral.\n\nUnit Details:\n- Unit Number: {{unit}}\n- Property: Vibrant Apartments\n\nPlease provide a referral at your earliest convenience.\n\nThank you,\nVibrant Property Management', 'awaiting-referral', '["johs-team@domain.com"]')
ON CONFLICT (id) DO NOTHING;
