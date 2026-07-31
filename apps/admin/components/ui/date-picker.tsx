'use client';

import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { cn } from './utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

interface DatePickerProps {
  /** ISO date string ("yyyy-MM-dd") — same shape a native `<input type="date">` uses. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Disable any day before today (e.g. scheduling future appointments). */
  disablePast?: boolean;
  className?: string;
}

function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  disablePast,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          {selected ? format(selected, 'PPP') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) onChange(format(date, 'yyyy-MM-dd'));
            setOpen(false);
          }}
          disabled={disablePast ? { before: new Date(new Date().setHours(0, 0, 0, 0)) } : undefined}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
