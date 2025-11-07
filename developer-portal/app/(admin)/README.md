# Admin Panel

This directory contains the admin panel for the MindShop platform. The admin panel is accessible only to users with admin or super_admin roles.

## Structure

```
app/(admin)/
├── layout.tsx              # Admin layout with sidebar and header
├── admin/
│   └── page.tsx           # Admin overview/dashboard
├── merchants/             # Merchant management (to be implemented)
├── system-health/         # System health monitoring (to be implemented)
├── metrics/               # Platform metrics (to be implemented)
├── errors/                # Error logs (to be implemented)
└── settings/              # Admin settings (to be implemented)
```

## Components

### AdminSidebar
Located at `components/admin/AdminSidebar.tsx`

Navigation sidebar with the following sections:
- Overview - Admin dashboard
- Merchants - Merchant management
- System Health - System monitoring
- Metrics - Platform analytics
- Error Logs - Error tracking
- Settings - Admin configuration

Features:
- Mobile responsive with hamburger menu
- Active route highlighting
- Link to return to merchant dashboard
- Red color scheme to distinguish from merchant portal

### AdminHeader
Located at `components/admin/AdminHeader.tsx`

Top header bar with:
- Admin panel title with shield icon
- Administrator access badge
- Notifications bell
- User dropdown menu with:
  - Link to merchant dashboard
  - Admin settings
  - Sign out

## Access Control

The admin layout includes role-based access control:
- Checks for `admin` or `super_admin` role in the user session
- Redirects non-admin users to the merchant dashboard
- Redirects unauthenticated users to login

## Styling

The admin panel uses a red color scheme (`bg-red-600`, `text-red-600`) to visually distinguish it from the merchant portal (which uses blue/primary colors).

## Next Steps

The following pages need to be implemented:
1. Merchant list page (`/admin/merchants`)
2. Merchant detail page (`/admin/merchants/[id]`)
3. System health dashboard (`/admin/system-health`)
4. Metrics page (`/admin/metrics`)
5. Error logs page (`/admin/errors`)
6. Admin settings page (`/admin/settings`)

Each page should integrate with the corresponding backend API endpoints defined in the merchant platform specification.
