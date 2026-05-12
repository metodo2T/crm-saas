'use client';
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { cn } from '@/lib/utils';

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog.Root>
  );
}

function SheetTrigger({ children, ...props }: React.ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger {...props}>{children}</Dialog.Trigger>;
}

function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { side?: 'left' | 'right' | 'top' | 'bottom' }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <Dialog.Popup
        className={cn(
          'fixed z-50 flex flex-col overflow-y-auto shadow-xl transition-all focus:outline-none',
          'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
          side === 'right' && [
            'inset-y-0 right-0 h-full',
            'data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full',
          ],
          side === 'left' && [
            'inset-y-0 left-0 h-full',
            'data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full',
          ],
          side === 'top' && [
            'inset-x-0 top-0 w-full',
            'data-[starting-style]:-translate-y-full data-[ending-style]:-translate-y-full',
          ],
          side === 'bottom' && [
            'inset-x-0 bottom-0 w-full',
            'data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full',
          ],
          className
        )}
        {...props}
      >
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 p-6 pb-4', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <Dialog.Title
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <Dialog.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function SheetClose({ className, ...props }: React.ComponentProps<typeof Dialog.Close>) {
  return (
    <Dialog.Close
      className={cn(
        'absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none',
        className
      )}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
};
