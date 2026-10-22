import type { ReactNode } from "react";
import { Checkbox } from "./Checkbox.tsx";
import { ChevronDownIcon } from "./icons.tsx";
import styles from "./Dropdown.module.css";

// A button opening a floating panel below it; a click outside closes it. The caller owns `isOpen`.
export function Dropdown({
  trigger,
  isOpen,
  onToggle,
  onClose,
  closeLabel,
  panelLabel,
  children,
}: {
  trigger: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  closeLabel: string;
  panelLabel: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.dropdown}>
      <button type="button" className={styles.trigger} aria-expanded={isOpen} onClick={onToggle}>
        {trigger}
        <ChevronDownIcon />
      </button>
      {isOpen && (
        <>
          <button type="button" className={styles.away} aria-label={closeLabel} onClick={onClose} />
          <div className={styles.panel} role="group" aria-label={panelLabel}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

// One line of a dropdown's checklist: a checkbox, its label, a count on the right.
export function DropdownCheck({ label, count, isChecked, onChange }: { label: string; count?: number; isChecked: boolean; onChange: () => void }) {
  return (
    <label className={styles.check}>
      <Checkbox checked={isChecked} onChange={onChange} />
      <span className={styles.label}>{label}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </label>
  );
}

export function DropdownSeparator() {
  return <div className={styles.sep} />;
}
