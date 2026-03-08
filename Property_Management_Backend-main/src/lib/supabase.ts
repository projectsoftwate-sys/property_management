import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'staff' | 'contractor' | 'tenant';
export type IssueCategory = 'fire' | 'electrical' | 'gas' | 'water' | 'general';
export type IssueStatus = 'open' | 'assigned' | 'in_progress' | 'completed';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  floor: number;
  tenant_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceIssue {
  id: string;
  property_id: string;
  unit_id?: string;
  created_by: string;
  assigned_to?: string;
  category: IssueCategory;
  title: string;
  description: string;
  status: IssueStatus;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}
