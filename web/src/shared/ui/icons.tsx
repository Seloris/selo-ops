// Inline icons in currentColor; each sits beside text, so none has an accessible name.
const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export function SearchIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg {...iconProps}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg {...iconProps}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ExpandIcon() {
  return (
    <svg {...iconProps}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
    </svg>
  );
}

export function CollapseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 10h-6V4" />
      <path d="M3 14h6v6" />
      <path d="m14 10 7-7" />
      <path d="m10 14-7 7" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 11a8 8 0 0 0-14.9-4" />
      <path d="M4 3v4h4" />
      <path d="M4 13a8 8 0 0 0 14.9 4" />
      <path d="M20 21v-4h-4" />
    </svg>
  );
}

export function BranchIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="7" r="2" />
      <path d="M6 7v10" />
      <path d="M18 9c0 5-7 4-11.5 8.5" />
    </svg>
  );
}

export function OpenIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function PromptIcon() {
  return (
    <svg {...iconProps}>
      <path d="m5 7 5 5-5 5" />
      <path d="M12 17h7" />
    </svg>
  );
}

export function ArchiveIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function UnarchiveIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="m9.5 14.5 2.5-2.5 2.5 2.5M12 12v6" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function QuestionIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z" />
      <path d="M9.7 9.6a2.4 2.4 0 0 1 4.6.9c0 1.6-2.3 2-2.3 3.1" />
      <path d="M12 16.6h.01" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function CommitIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M3 12h5.5M15.5 12H21" />
    </svg>
  );
}

export function WarningIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function HourglassIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3v3a5 5 0 0 0 10 0V3" />
      <path d="M7 21v-3a5 5 0 0 1 10 0v3" />
    </svg>
  );
}

export function DoorIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 21V4a1 1 0 0 1 1-1h9v18" />
      <path d="M15 5h3a1 1 0 0 1 1 1v15" />
      <path d="M3 21h18" />
      <path d="M11.5 12h.01" />
    </svg>
  );
}

export function RobotIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3.5" r="0.5" />
      <path d="M9 13v1M15 13v1" />
      <path d="M2 13v3M22 13v3" />
    </svg>
  );
}

export function GaugeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="M12 18l4-6" />
      <circle cx="12" cy="18" r="1" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export function FileIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

// File-type icons, drawn in strokes like the others so they stay legible at 14 px.
export function MarkdownIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 15V9l3 3 3-3v6" />
      <path d="M17 9v6M15 13l2 2 2-2" />
    </svg>
  );
}

export function TypeScriptIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M6 9h6M9 9v9" />
      <path d="M18 10c-.6-.7-1.4-1-2.3-1-1.3 0-2.2.8-2.2 2 0 2.6 4.5 1.6 4.5 4.3 0 1.3-1 2.2-2.4 2.2-1 0-1.9-.4-2.4-1.1" />
    </svg>
  );
}

export function JavaScriptIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M11 9v6.5a2.5 2.5 0 0 1-5 0" />
      <path d="M18 10c-.6-.7-1.4-1-2.3-1-1.3 0-2.2.8-2.2 2 0 2.6 4.5 1.6 4.5 4.3 0 1.3-1 2.2-2.4 2.2-1 0-1.9-.4-2.4-1.1" />
    </svg>
  );
}

export function ReactIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="1" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </svg>
  );
}

export function BracesIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 4H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1" />
      <path d="M16 4h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1" />
    </svg>
  );
}

export function HashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}

export function CodeIcon() {
  return (
    <svg {...iconProps}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
    </svg>
  );
}

export function IndentIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 5h9M8 10h12M8 15h9M4 20h7" />
    </svg>
  );
}

export function ImageIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 15-5-5L5 20" />
    </svg>
  );
}

export function TerminalIcon() {
  return (
    <svg {...iconProps}>
      <path d="m4 17 6-5-6-5M12 19h8" />
    </svg>
  );
}

export function TextFileIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

export function NoteIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
