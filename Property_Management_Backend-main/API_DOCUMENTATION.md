# Property Management API Documentation

## Overview

This is a complete property management backend system with role-based access control, maintenance tracking, and key management.

## Authentication

All API endpoints require authentication using Supabase Auth. Include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## User Roles

- **admin**: Full system access
- **staff**: Manage properties, units, assign maintenance issues
- **contractor**: View and update assigned maintenance issues
- **tenant**: Create and view own maintenance issues

## API Endpoints

### Properties API

Base URL: `{SUPABASE_URL}/functions/v1/properties`

#### Get All Properties
```http
GET /properties
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Building A",
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip": "10001",
      "unit_count": 10,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Property by ID
```http
GET /properties/{id}
```

Response includes full property details with units and tenant information.

#### Create Property
```http
POST /properties
Content-Type: application/json

{
  "name": "Building A",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zip": "10001"
}
```

Requires: `admin` or `staff` role

#### Update Property
```http
PUT /properties/{id}
Content-Type: application/json

{
  "name": "Building A - Updated"
}
```

Requires: `admin` or `staff` role

#### Delete Property
```http
DELETE /properties/{id}
```

Requires: `admin` role

### Units API

Base URL: `{SUPABASE_URL}/functions/v1/properties`

#### Get All Units
```http
GET /properties/units?property_id={property_id}
```

#### Create Unit
```http
POST /properties/units
Content-Type: application/json

{
  "property_id": "uuid",
  "unit_number": "101",
  "floor": 1,
  "tenant_id": "uuid"
}
```

Requires: `admin` or `staff` role

#### Update Unit
```http
PUT /properties/units/{id}
Content-Type: application/json

{
  "tenant_id": "uuid"
}
```

Requires: `admin` or `staff` role

### Maintenance Issues API

Base URL: `{SUPABASE_URL}/functions/v1/maintenance-issues`

#### Get All Issues
```http
GET /maintenance-issues?status={status}&property_id={property_id}
```

Query Parameters:
- `status`: Filter by status (open, assigned, in_progress, completed)
- `property_id`: Filter by property

#### Get Issue by ID
```http
GET /maintenance-issues/{id}
```

Returns issue with attachments, property, unit, creator, and assignee details.

#### Create Issue
```http
POST /maintenance-issues
Content-Type: application/json

{
  "property_id": "uuid",
  "unit_id": "uuid",
  "category": "electrical",
  "title": "Outlet not working",
  "description": "The outlet in the kitchen is not providing power"
}
```

Categories: `fire`, `electrical`, `gas`, `water`, `general`

#### Update Issue
```http
PUT /maintenance-issues/{id}
Content-Type: application/json

{
  "status": "in_progress",
  "assigned_to": "uuid"
}
```

Status Flow: `open` → `assigned` → `in_progress` → `completed`

When assigning a contractor, the status automatically changes to `assigned`.
When status is set to `completed`, `completed_at` is automatically set.

Permissions:
- `admin` and `staff`: Can update any issue
- `contractor`: Can only update issues assigned to them

#### Delete Issue
```http
DELETE /maintenance-issues/{id}
```

Requires: `admin` role

### Key Management API

Base URL: `{SUPABASE_URL}/functions/v1/keys`

#### Get All Key Sets
```http
GET /keys/key-sets?property_id={property_id}
```

#### Create Key Set
```http
POST /keys/key-sets
Content-Type: application/json

{
  "property_id": "uuid",
  "name": "Master Keys",
  "description": "Main building keys"
}
```

Requires: `admin` or `staff` role

#### Add Key to Set
```http
POST /keys/keys
Content-Type: application/json

{
  "key_set_id": "uuid",
  "key_number": "001",
  "description": "Front entrance"
}
```

Requires: `admin` or `staff` role

#### Get Key Checkouts
```http
GET /keys/checkouts?active=true&user_id={user_id}
```

Query Parameters:
- `active`: Only return active checkouts (keys not yet returned)
- `user_id`: Filter by user who checked out the key

#### Checkout Key
```http
POST /keys/checkouts
Content-Type: application/json

{
  "key_id": "uuid",
  "checked_out_by": "uuid",
  "expected_return_at": "2024-12-31T23:59:59Z",
  "maintenance_issue_id": "uuid",
  "notes": "For electrical repair in Unit 101"
}
```

Requires: `admin` or `staff` role

#### Check-in Key
```http
PUT /keys/checkouts/{id}
Content-Type: application/json

{
  "notes": "Key returned in good condition"
}
```

This automatically sets `checked_in_at` to the current timestamp.

Requires: `admin` or `staff` role

## Database Schema

### Tables

1. **profiles** - User profiles with role-based access
2. **properties** - Physical properties
3. **units** - Individual units/rooms within properties
4. **maintenance_issues** - Maintenance requests and tracking
5. **issue_attachments** - Photos and videos for issues
6. **key_sets** - Groups of keys per property
7. **keys** - Individual keys
8. **key_checkouts** - Key checkout/check-in tracking

### Row Level Security (RLS)

All tables have RLS enabled with policies based on user roles:

- **Admin**: Full access to all resources
- **Staff**: Can manage properties, units, and maintenance issues
- **Contractor**: Can view and update assigned maintenance issues
- **Tenant**: Can create issues and view their own data

## Usage Examples

### JavaScript/TypeScript

```typescript
// Get all properties
const response = await fetch(`${SUPABASE_URL}/functions/v1/properties`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});
const { data } = await response.json();

// Create maintenance issue
const response = await fetch(`${SUPABASE_URL}/functions/v1/maintenance-issues`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    property_id: 'uuid',
    category: 'electrical',
    title: 'Outlet not working',
    description: 'Kitchen outlet has no power',
  }),
});

// Checkout a key
const response = await fetch(`${SUPABASE_URL}/functions/v1/keys/checkouts`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    key_id: 'uuid',
    checked_out_by: 'uuid',
    notes: 'For maintenance work',
  }),
});
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `405` - Method Not Allowed
- `500` - Internal Server Error

Error responses include a descriptive message:

```json
{
  "error": "Error message here"
}
```
