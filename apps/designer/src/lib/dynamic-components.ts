import dynamic from 'next/dynamic';
import { DialogProps } from '@radix-ui/react-dialog';
import { PopoverProps } from '@radix-ui/react-popover';
import { TooltipProps } from '@radix-ui/react-tooltip';
import { HoverCardProps } from '@radix-ui/react-hover-card';
import { ContextMenuProps } from '@radix-ui/react-context-menu';

// Dynamically import non-critical Radix components
export const Dialog = dynamic<DialogProps>(() => 
  import('@radix-ui/react-dialog').then(mod => mod.Root), {
  ssr: false,
  loading: () => null,
});

export const Popover = dynamic<PopoverProps>(() => 
  import('@radix-ui/react-popover').then(mod => mod.Root), {
  ssr: false,
  loading: () => null,
});

export const Tooltip = dynamic<TooltipProps>(() => 
  import('@radix-ui/react-tooltip').then(mod => mod.Root), {
  ssr: false,
  loading: () => null,
});

export const HoverCard = dynamic<HoverCardProps>(() => 
  import('@radix-ui/react-hover-card').then(mod => mod.Root), {
  ssr: false,
  loading: () => null,
});

export const ContextMenu = dynamic<ContextMenuProps>(() => 
  import('@radix-ui/react-context-menu').then(mod => mod.Root), {
  ssr: false,
  loading: () => null,
});

// Keep critical components imported normally in their respective files:
// - Button
// - Input
// - Form elements
// - Navigation components 