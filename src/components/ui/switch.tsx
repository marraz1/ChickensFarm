"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-input p-0.5 transition-colors outline-none select-none",
        // The visible track is 24px tall; the pseudo-element stretches the hit
        // area to the 44px tap target used everywhere else, without affecting layout.
        "after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-['']",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "dark:bg-input/50",
        className,
      )}
      {...props}
    />
  );
}

function SwitchThumb({ className, ...props }: SwitchPrimitive.Thumb.Props) {
  return (
    <SwitchPrimitive.Thumb
      data-slot="switch-thumb"
      className={cn(
        // Travel = 44px track − 4px padding − 20px thumb = 20px.
        "pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-1 ring-foreground/10 transition-transform data-checked:translate-x-5",
        className,
      )}
      {...props}
    />
  );
}

export { Switch, SwitchThumb };
