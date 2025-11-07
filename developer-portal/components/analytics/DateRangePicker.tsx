'use client';

import { Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type DateRange = {
  startDate: string;
  endDate: string;
  label: string;
};

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presetRanges = [
  {
    label: 'Last 7 days',
    getValue: () => ({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      label: 'Last 7 days',
    }),
  },
  {
    label: 'Last 30 days',
    getValue: () => ({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      label: 'Last 30 days',
    }),
  },
  {
    label: 'Last 90 days',
    getValue: () => ({
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      label: 'Last 90 days',
    }),
  },
  {
    label: 'This month',
    getValue: () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: startOfMonth.toISOString(),
        endDate: now.toISOString(),
        label: 'This month',
      };
    },
  },
  {
    label: 'Last month',
    getValue: () => {
      const now = new Date();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: startOfLastMonth.toISOString(),
        endDate: endOfLastMonth.toISOString(),
        label: 'Last month',
      };
    },
  },
];

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const handlePresetChange = (presetLabel: string) => {
    const preset = presetRanges.find((p) => p.label === presetLabel);
    if (preset) {
      onChange(preset.getValue());
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-gray-500" />
      <Select value={value.label} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select date range" />
        </SelectTrigger>
        <SelectContent>
          {presetRanges.map((preset) => (
            <SelectItem key={preset.label} value={preset.label}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
