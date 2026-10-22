import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { Tag } from "./Tag.tsx";
import styles from "./NavTabs.module.css";

export interface NavTab {
  label: string;
  // No address: a page not built yet, shown dimmed with its note.
  to?: string;
  // Active only on its exact address (the home page).
  end?: boolean;
  icon?: ReactNode;
  note?: string;
}

// Links between pages; the current one stands out on a neutral fill.
export function NavTabs({ label, tabs }: { label: string; tabs: NavTab[] }) {
  return (
    <nav aria-label={label}>
      <ul className={styles.tabs}>
        {tabs.map((tab) => (
          <li key={tab.label}>
            {tab.to ? (
              <NavLink to={tab.to} end={tab.end} className={styles.tab}>
                {tab.icon}
                {tab.label}
              </NavLink>
            ) : (
              <span className={`${styles.tab} ${styles.disabled}`}>
                {tab.icon}
                {tab.label}
                {tab.note && <Tag>{tab.note}</Tag>}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
