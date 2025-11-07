# Product Sync Components

This directory contains the UI components for the Product Sync feature in the MindShop Developer Portal.

## Overview

The Product Sync feature allows merchants to synchronize their product catalog with the RAG assistant. Products can be synced through:
- **Scheduled sync**: Automatically pull products on a schedule (cron)
- **Webhook sync**: Receive real-time updates via webhooks
- **Manual sync**: Trigger sync on-demand
- **File upload**: Upload CSV or JSON files

## Components

### SyncConfigurationForm

Form component for configuring product synchronization settings.

**Props:**
- `config?: ProductSyncConfig | null` - Existing configuration (for editing)
- `onSubmit: (data: any) => Promise<void>` - Submit handler
- `isSubmitting: boolean` - Loading state

**Features:**
- Sync type selection (manual, scheduled, webhook)
- Source type selection (API, CSV, FTP, S3)
- Cron schedule configuration
- Field mapping editor (JSON)
- Form validation

### SyncStatusCard

Displays the current sync status and allows triggering manual syncs.

**Props:**
- `status: 'idle' | 'syncing' | 'error'` - Current sync status
- `lastSync?: ProductSyncHistory` - Last sync details
- `nextSync?: string` - Next scheduled sync time
- `onTriggerSync: () => void` - Manual sync trigger
- `isSyncing: boolean` - Loading state

**Features:**
- Real-time status display
- Last sync statistics (processed, created, updated, skipped)
- Manual sync trigger button
- Error message display

### FileUploadCard

File upload component for manual product imports.

**Props:**
- `onUpload: (file: File) => Promise<void>` - Upload handler
- `isUploading: boolean` - Loading state

**Features:**
- Drag and drop file upload
- File type validation (CSV, JSON)
- File size display
- Upload progress indication
- Example format display

### SyncHistoryTable

Table displaying past synchronization attempts.

**Props:**
- `history: ProductSyncHistory[]` - Array of sync history records

**Features:**
- Status badges (completed, failed, in progress, pending)
- Sync type display
- Duration formatting
- Statistics display (processed, created, updated, skipped)
- Empty state handling

## Usage Example

```tsx
import {
  SyncConfigurationForm,
  SyncStatusCard,
  FileUploadCard,
  SyncHistoryTable,
} from '@/components/product-sync';

function ProductSyncPage() {
  const handleConfigSubmit = async (data) => {
    await apiClient.createProductSyncConfig(merchantId, data, token);
  };

  const handleTriggerSync = () => {
    apiClient.triggerProductSync(merchantId, token);
  };

  const handleFileUpload = async (file) => {
    await apiClient.uploadProductFile(merchantId, file, token);
  };

  return (
    <div>
      <SyncConfigurationForm
        config={config}
        onSubmit={handleConfigSubmit}
        isSubmitting={false}
      />
      
      <SyncStatusCard
        status="idle"
        lastSync={lastSync}
        nextSync={nextSync}
        onTriggerSync={handleTriggerSync}
        isSyncing={false}
      />
      
      <FileUploadCard
        onUpload={handleFileUpload}
        isUploading={false}
      />
      
      <SyncHistoryTable history={history} />
    </div>
  );
}
```

## API Integration

The components integrate with the following API endpoints:

- `GET /api/merchants/:merchantId/sync/configure` - Get sync configuration
- `POST /api/merchants/:merchantId/sync/configure` - Create sync configuration
- `PUT /api/merchants/:merchantId/sync/configure` - Update sync configuration
- `POST /api/merchants/:merchantId/sync/trigger` - Trigger manual sync
- `GET /api/merchants/:merchantId/sync/status` - Get sync status
- `GET /api/merchants/:merchantId/sync/history` - Get sync history
- `POST /api/merchants/:merchantId/sync/upload` - Upload product file

## Data Types

```typescript
interface ProductSyncConfig {
  id: string;
  merchantId: string;
  syncType: 'scheduled' | 'webhook' | 'manual';
  schedule?: string; // cron expression
  sourceType: 'api' | 'ftp' | 's3' | 'csv';
  sourceUrl?: string;
  fieldMapping: Record<string, string>;
  lastSyncAt?: string;
  nextSyncAt?: string;
  status: 'active' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface ProductSyncHistory {
  id: string;
  merchantId: string;
  syncType: 'scheduled' | 'webhook' | 'manual';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  productsProcessed: number;
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number; // in seconds
}
```

## Field Mapping

The field mapping configuration maps source product fields to the RAG assistant schema:

```json
{
  "sku": "product_id",
  "title": "name",
  "description": "description",
  "price": "price",
  "image": "image_url"
}
```

## Sync Types

### Manual Sync
- Triggered by the merchant on-demand
- No schedule configuration needed
- Useful for testing and one-time imports

### Scheduled Sync
- Runs automatically on a cron schedule
- Examples:
  - `0 */6 * * *` - Every 6 hours
  - `0 0 * * *` - Daily at midnight
  - `0 0 * * 0` - Weekly on Sunday

### Webhook Sync
- Triggered by incoming webhooks from the merchant's platform
- Real-time product updates
- Requires webhook endpoint configuration

## File Upload

Supported file formats:

**CSV Example:**
```csv
sku,title,description,price,image_url
SKU001,Product 1,Description 1,29.99,https://example.com/image1.jpg
SKU002,Product 2,Description 2,39.99,https://example.com/image2.jpg
```

**JSON Example:**
```json
[
  {
    "sku": "SKU001",
    "title": "Product 1",
    "description": "Description 1",
    "price": 29.99,
    "image_url": "https://example.com/image1.jpg"
  }
]
```

## Error Handling

All components handle errors gracefully:
- Form validation errors are displayed inline
- API errors are shown via toast notifications
- Failed syncs are logged in the history table
- Error messages are displayed in the status card

## Styling

Components use:
- Tailwind CSS for styling
- shadcn/ui components for consistency
- Lucide React icons
- Responsive design (mobile-friendly)

## Testing

To test the components:

1. Navigate to `/product-sync` in the developer portal
2. Configure sync settings in the Configuration tab
3. View sync status in the Status tab
4. Upload a test file in the Upload tab
5. Check sync history in the History tab

## Future Enhancements

- [ ] Real-time sync progress updates via WebSocket
- [ ] Bulk product deletion
- [ ] Product preview before sync
- [ ] Advanced field mapping UI (drag-and-drop)
- [ ] Sync scheduling calendar view
- [ ] Export sync history to CSV
