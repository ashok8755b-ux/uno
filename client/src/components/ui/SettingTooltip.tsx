import { useState } from 'react';

interface SettingTooltipProps {
  text: string;
}

export function SettingTooltip({ text }: SettingTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="More info"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-uno-muted hover:text-white"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-1 w-48 -translate-x-1/2 rounded-lg bg-black/90 px-2 py-1.5 text-[10px] leading-snug text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
