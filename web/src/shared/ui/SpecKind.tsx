import type { CSSProperties } from "react";
import { BlueprintIcon, DomainIcon, PageIcon } from "./icons.tsx";
import styles from "./SpecKind.module.css";

// app FR-04: a page spec, a domain sheet and a blueprint each wear one colour and one icon, everywhere.
export type SpecKind = "page" | "domain" | "blueprint";

export const specColor = (kind: SpecKind) => `var(--spec-${kind})`;

const ICONS = { page: PageIcon, domain: DomainIcon, blueprint: BlueprintIcon };

export function SpecIcon({ kind }: { kind: SpecKind }) {
  const Icon = ICONS[kind];
  return <Icon />;
}

// The kind's icon on a soft tint of its colour.
export function SpecChip({ kind }: { kind: SpecKind }) {
  return (
    <span className={styles.chip} style={{ "--spec": specColor(kind) } as CSSProperties}>
      <SpecIcon kind={kind} />
    </span>
  );
}
