# MindShop Developer Portal

This is the developer portal for the MindShop platform, built with Next.js 14 (App Router).

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Authentication**: NextAuth.js with AWS Cognito

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- AWS Cognito User Pool configured

### Installation

1. Install dependencies:

```bash
npm install
```

2. Copy the environment variables:

```bash
cp .env.example .env.local
```

3. Update `.env.local` with your configuration:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key
COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_CLIENT_SECRET=your-cognito-client-secret
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/your-user-pool-id
COGNITO_DOMAIN=your-cognito-domain.auth.us-east-1.amazoncognito.com
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
developer-portal/
├── app/
│   ├── (auth)/              # Authentication pages
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── verify-email/
│   ├── (dashboard)/         # Dashboard pages
│   │   ├── dashboard/       # Overview
│   │   ├── api-keys/        # API key management
│   │   ├── analytics/       # Usage analytics
│   │   ├── documentation/   # API docs
│   │   └── settings/        # Account settings
│   ├── api/
│   │   └── auth/            # NextAuth configuration
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── dashboard/           # Dashboard components
│   ├── api-keys/            # API key components
│   ├── analytics/           # Analytics components
│   └── auth/                # Auth components
├── lib/
│   ├── api-client.ts        # API client
│   ├── providers.tsx        # React Query & Session providers
│   └── utils.ts             # Utility functions
└── types/
    └── index.ts             # TypeScript types
```

## Features

### Phase 1 (MVP)
- [x] Next.js 14 setup with App Router
- [x] TypeScript configuration
- [x] Tailwind CSS + shadcn/ui
- [x] NextAuth.js with Cognito
- [x] React Query setup
- [x] API client
- [ ] Authentication pages
- [ ] Dashboard layout
- [ ] API key management
- [ ] Analytics dashboard

### Phase 2 (Beta)
- [ ] Billing integration
- [ ] Webhook management
- [ ] Product sync configuration

### Phase 3 (Production)
- [ ] Advanced analytics
- [ ] Team management
- [ ] White-label options

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Environment Variables

See `.env.example` for all required environment variables.

## Contributing

This is part of the Merchant Platform specification. See `.kiro/specs/merchant-platform/` for detailed requirements and design documents.

## License

Proprietary
