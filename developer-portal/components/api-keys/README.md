# API Keys Components

This directory contains the components for the API Keys management page in the developer portal.

## Components

### ApiKeyCard
Displays an individual API key with:
- Key name and status badges (Active, Revoked, Expired)
- Environment badge (Development, Production)
- Key prefix with visibility toggle
- Copy to clipboard functionality
- Creation date, last used date, and expiration date
- Delete action with confirmation dialog

### ApiKeyList
Displays a list of API keys or an empty state when no keys exist.

### CreateApiKeyDialog
A multi-step dialog for creating new API keys:
1. **Form step**: Collect key name and environment
2. **Success step**: Display the newly created key with a warning that it won't be shown again

## Features Implemented

- ✅ Key list component
- ✅ Key card component with status badges
- ✅ Create key dialog with two-step flow
- ✅ Delete confirmation dialog
- ✅ Copy-to-clipboard functionality
- ✅ Key visibility toggle (show/hide)
- ✅ API integration with React Query
- ✅ Loading and error states
- ✅ Security warning banner
- ✅ Responsive design

## Usage

```tsx
import { ApiKeyList, CreateApiKeyDialog } from '@/components/api-keys';

// In your page component
<ApiKeyList
  apiKeys={apiKeys}
  onDelete={handleDelete}
  deletingKeyId={deletingKeyId}
/>

<CreateApiKeyDialog
  open={showDialog}
  onClose={() => setShowDialog(false)}
  onCreate={handleCreate}
/>
```

## Dependencies

- `@radix-ui/react-alert-dialog` - Delete confirmation
- `@radix-ui/react-select` - Environment selector
- `@radix-ui/react-dialog` - Create key dialog
- `lucide-react` - Icons
- `@tanstack/react-query` - Data fetching and mutations
