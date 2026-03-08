# Property Management System - Setup Guide

## System Overview

A complete property management backend with:
- Role-based authentication (admin, staff, contractor, tenant)
- Property and unit management
- Maintenance issue tracking with photo/video support
- Key checkout/check-in system
- RESTful API for mobile and web applications

## Getting Started

### 1. Database Setup

The database has been automatically configured with:
- 8 tables with proper relationships
- Row Level Security (RLS) policies for all tables
- Indexes for optimal query performance
- Automatic timestamp updates

### 2. Create Your First Admin User

To create an admin user, you'll need to:

1. Sign up a new user through Supabase Auth
2. Manually insert a profile record with admin role

```sql
-- After signing up, insert profile:
INSERT INTO profiles (id, full_name, role)
VALUES ('user-uuid-from-auth', 'Admin Name', 'admin');
```

Or use the Supabase dashboard to create users.

### 3. API Endpoints

Three edge functions are deployed and ready to use:

- **Properties API**: `/functions/v1/properties`
  - Manage properties and units

- **Maintenance Issues API**: `/functions/v1/maintenance-issues`
  - Create, assign, and track maintenance issues

- **Keys API**: `/functions/v1/keys`
  - Manage key sets, keys, and checkouts

See `API_DOCUMENTATION.md` for detailed endpoint documentation.

## Quick Start Guide

### Step 1: Create Properties

```bash
curl -X POST {SUPABASE_URL}/functions/v1/properties \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunset Apartments",
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102"
  }'
```

### Step 2: Add Units

```bash
curl -X POST {SUPABASE_URL}/functions/v1/properties/units \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "property-uuid",
    "unit_number": "101",
    "floor": 1
  }'
```

### Step 3: Create Maintenance Issue

```bash
curl -X POST {SUPABASE_URL}/functions/v1/maintenance-issues \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "property-uuid",
    "unit_id": "unit-uuid",
    "category": "electrical",
    "title": "Outlet not working",
    "description": "Kitchen outlet has no power"
  }'
```

### Step 4: Assign Contractor

```bash
curl -X PUT {SUPABASE_URL}/functions/v1/maintenance-issues/{issue-id} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "assigned_to": "contractor-user-id",
    "status": "assigned"
  }'
```

### Step 5: Create Key Set

```bash
curl -X POST {SUPABASE_URL}/functions/v1/keys/key-sets \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "property-uuid",
    "name": "Master Keys",
    "description": "Main building access"
  }'
```

### Step 6: Checkout Key

```bash
curl -X POST {SUPABASE_URL}/functions/v1/keys/checkouts \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "key_id": "key-uuid",
    "checked_out_by": "contractor-user-id",
    "maintenance_issue_id": "issue-uuid",
    "notes": "For electrical repair work"
  }'
```

## User Roles & Permissions

### Admin
- Full system access
- Manage all properties, units, issues, and keys
- Delete any resource
- Assign roles to users

### Staff
- Manage properties and units
- Create and assign maintenance issues
- Manage key sets and checkouts
- View all data

### Contractor
- View assigned maintenance issues
- Update status of assigned issues
- Checkout keys for their work
- View their key checkout history

### Tenant
- Create maintenance issues for their unit
- View their own issues
- View issue status and updates

## Mobile/Web Integration

The system is API-first and works with any client:

### React/React Native Example

```typescript
import { supabase } from './supabase';

// Get user's access token
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Call API
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/maintenance-issues`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
);

const { data } = await response.json();
```

### Flutter Example

```dart
final response = await http.get(
  Uri.parse('$supabaseUrl/functions/v1/properties'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
);

final data = json.decode(response.body);
```

## Demo UI

A demo admin dashboard is included at `/src/components/Dashboard.tsx` that shows:
- Property management interface
- Maintenance issue tracking
- Key checkout system
- Role-based access control

## Maintenance Issue Workflow

1. **Tenant creates issue** → Status: `open`
2. **Staff assigns contractor** → Status: `assigned`
3. **Contractor checks out key** → Linked to issue
4. **Contractor starts work** → Status: `in_progress`
5. **Contractor completes work** → Status: `completed`
6. **Contractor returns key** → Key checked in

## Key Management Best Practices

1. Create key sets per property
2. Number keys clearly (e.g., "001", "002")
3. Always link checkouts to maintenance issues when applicable
4. Add notes about key condition on return
5. Monitor overdue keys using `expected_return_at`

## Security Features

- All tables protected by Row Level Security (RLS)
- Role-based access control at database level
- JWT authentication required for all API calls
- Automatic audit trails with timestamps
- Secure edge functions with authentication checks

## Monitoring & Analytics

Query the database directly for:
- Open vs completed issues by property
- Average resolution time per category
- Key checkout duration analysis
- Contractor workload distribution

Example queries:

```sql
-- Issues by status
SELECT status, COUNT(*)
FROM maintenance_issues
GROUP BY status;

-- Average key checkout duration
SELECT AVG(
  EXTRACT(EPOCH FROM (checked_in_at - checked_out_at)) / 3600
) as avg_hours
FROM key_checkouts
WHERE checked_in_at IS NOT NULL;
```

## Support

For API details, see `API_DOCUMENTATION.md`
For database schema, see the migration file in `supabase/migrations/`
