'use client';

import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { Key, FileText, BarChart3, Settings, ArrowRight } from 'lucide-react';

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    title: 'Create API Key',
    description: 'Generate a new API key for your integration',
    href: '/api-keys',
    icon: <Key className="h-5 w-5" />,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    title: 'View Documentation',
    description: 'Learn how to integrate MindShop',
    href: '/documentation',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-purple-600 bg-purple-50',
  },
  {
    title: 'Check Analytics',
    description: 'View detailed usage and performance metrics',
    href: '/analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'text-green-600 bg-green-50',
  },
  {
    title: 'Manage Settings',
    description: 'Configure your account and preferences',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    color: 'text-orange-600 bg-orange-50',
  },
];

export function QuickActions() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-lg border border-gray-200 p-4 transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`rounded-lg p-2 ${action.color}`}>
                    {action.icon}
                  </div>
                  <h4 className="font-medium text-gray-900">{action.title}</h4>
                </div>
                <p className="text-sm text-gray-500">{action.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
