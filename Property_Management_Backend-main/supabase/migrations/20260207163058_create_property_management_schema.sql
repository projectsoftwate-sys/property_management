/*
  # Property Management Platform Schema

  ## Overview
  Complete backend system for property management with user roles, properties, 
  maintenance tracking, and key management.

  ## New Tables

  ### 1. profiles
  Extends auth.users with role-based access control
  - `id` (uuid, pk, references auth.users)
  - `full_name` (text)
  - `role` (enum: admin, staff, contractor, tenant)
  - `phone` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. properties
  Physical properties managed by the system
  - `id` (uuid, pk)
  - `name` (text)
  - `address` (text)
  - `city` (text)
  - `state` (text)
  - `zip` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. units
  Individual units/rooms within properties
  - `id` (uuid, pk)
  - `property_id` (uuid, fk -> properties)
  - `unit_number` (text)
  - `floor` (integer)
  - `tenant_id` (uuid, fk -> profiles, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. maintenance_issues
  Tracks maintenance requests and their lifecycle
  - `id` (uuid, pk)
  - `property_id` (uuid, fk -> properties)
  - `unit_id` (uuid, fk -> units, nullable)
  - `created_by` (uuid, fk -> profiles)
  - `assigned_to` (uuid, fk -> profiles, nullable)
  - `category` (enum: fire, electrical, gas, water, general)
  - `title` (text)
  - `description` (text)
  - `status` (enum: open, assigned, in_progress, completed)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - `completed_at` (timestamptz, nullable)

  ### 5. issue_attachments
  Photos and videos for maintenance issues
  - `id` (uuid, pk)
  - `issue_id` (uuid, fk -> maintenance_issues)
  - `file_url` (text)
  - `file_type` (enum: photo, video)
  - `uploaded_by` (uuid, fk -> profiles)
  - `created_at` (timestamptz)

  ### 6. key_sets
  Groups of keys per property
  - `id` (uuid, pk)
  - `property_id` (uuid, fk -> properties)
  - `name` (text)
  - `description` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. keys
  Individual keys within key sets
  - `id` (uuid, pk)
  - `key_set_id` (uuid, fk -> key_sets)
  - `key_number` (text)
  - `description` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. key_checkouts
  Tracks who has which keys and for how long
  - `id` (uuid, pk)
  - `key_id` (uuid, fk -> keys)
  - `checked_out_by` (uuid, fk -> profiles)
  - `checked_out_at` (timestamptz)
  - `expected_return_at` (timestamptz, nullable)
  - `checked_in_at` (timestamptz, nullable)
  - `maintenance_issue_id` (uuid, fk -> maintenance_issues, nullable)
  - `notes` (text)
  - `created_at` (timestamptz)

  ## Security
  
  ### Role-Based Access Control
  1. **Admin**: Full access to all resources
  2. **Staff**: Can view all, manage properties/units, assign maintenance issues
  3. **Contractor**: Can view assigned issues and update their status
  4. **Tenant**: Can create issues for their units and view their own issues

  ### RLS Policies
  - Comprehensive policies for each table based on user roles
  - All tables have RLS enabled
  - Policies check authentication and role-based permissions
*/

-- Create enums for type safety
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'contractor', 'tenant');
CREATE TYPE issue_category AS ENUM ('fire', 'electrical', 'gas', 'water', 'general');
CREATE TYPE issue_status AS ENUM ('open', 'assigned', 'in_progress', 'completed');
CREATE TYPE attachment_type AS ENUM ('photo', 'video');

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'tenant',
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view properties"
  ON properties FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can insert properties"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin and staff can update properties"
  ON properties FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admins can delete properties"
  ON properties FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Units table
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  floor integer DEFAULT 1,
  tenant_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, unit_number)
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view units"
  ON units FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can insert units"
  ON units FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin and staff can update units"
  ON units FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admins can delete units"
  ON units FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Maintenance issues table
CREATE TABLE IF NOT EXISTS maintenance_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  category issue_category NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status issue_status NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE maintenance_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff can view all issues"
  ON maintenance_issues FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Tenants can view their own issues"
  ON maintenance_issues FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
  );

CREATE POLICY "Contractors can view assigned issues"
  ON maintenance_issues FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
  );

CREATE POLICY "Tenants can create issues"
  ON maintenance_issues FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "Admin and staff can create issues"
  ON maintenance_issues FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin and staff can update any issue"
  ON maintenance_issues FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Contractors can update assigned issues"
  ON maintenance_issues FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
  )
  WITH CHECK (
    assigned_to = auth.uid()
  );

CREATE POLICY "Admins can delete issues"
  ON maintenance_issues FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Issue attachments table
CREATE TABLE IF NOT EXISTS issue_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES maintenance_issues(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type attachment_type NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE issue_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments for accessible issues"
  ON issue_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_issues
      WHERE maintenance_issues.id = issue_attachments.issue_id
      AND (
        maintenance_issues.created_by = auth.uid()
        OR maintenance_issues.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'staff')
        )
      )
    )
  );

CREATE POLICY "Users can upload attachments to their issues"
  ON issue_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM maintenance_issues
      WHERE maintenance_issues.id = issue_attachments.issue_id
      AND (
        maintenance_issues.created_by = auth.uid()
        OR maintenance_issues.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'staff')
        )
      )
    )
  );

CREATE POLICY "Admins can delete attachments"
  ON issue_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Key sets table
CREATE TABLE IF NOT EXISTS key_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE key_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view key sets"
  ON key_sets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can manage key sets"
  ON key_sets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin and staff can update key sets"
  ON key_sets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admins can delete key sets"
  ON key_sets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Keys table
CREATE TABLE IF NOT EXISTS keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_set_id uuid NOT NULL REFERENCES key_sets(id) ON DELETE CASCADE,
  key_number text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(key_set_id, key_number)
);

ALTER TABLE keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view keys"
  ON keys FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can manage keys"
  ON keys FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin and staff can update keys"
  ON keys FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admins can delete keys"
  ON keys FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Key checkouts table
CREATE TABLE IF NOT EXISTS key_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  checked_out_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_out_at timestamptz NOT NULL DEFAULT now(),
  expected_return_at timestamptz,
  checked_in_at timestamptz,
  maintenance_issue_id uuid REFERENCES maintenance_issues(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE key_checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff can view all checkouts"
  ON key_checkouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Users can view their own checkouts"
  ON key_checkouts FOR SELECT
  TO authenticated
  USING (
    checked_out_by = auth.uid()
  );

CREATE POLICY "Admin and staff can create checkouts"
  ON key_checkouts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin and staff can update checkouts"
  ON key_checkouts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_tenant_id ON units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_issues_property_id ON maintenance_issues(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_issues_unit_id ON maintenance_issues(unit_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_issues_created_by ON maintenance_issues(created_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_issues_assigned_to ON maintenance_issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maintenance_issues_status ON maintenance_issues(status);
CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue_id ON issue_attachments(issue_id);
CREATE INDEX IF NOT EXISTS idx_key_sets_property_id ON key_sets(property_id);
CREATE INDEX IF NOT EXISTS idx_keys_key_set_id ON keys(key_set_id);
CREATE INDEX IF NOT EXISTS idx_key_checkouts_key_id ON key_checkouts(key_id);
CREATE INDEX IF NOT EXISTS idx_key_checkouts_checked_out_by ON key_checkouts(checked_out_by);
CREATE INDEX IF NOT EXISTS idx_key_checkouts_checked_in_at ON key_checkouts(checked_in_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_issues_updated_at BEFORE UPDATE ON maintenance_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_key_sets_updated_at BEFORE UPDATE ON key_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keys_updated_at BEFORE UPDATE ON keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();