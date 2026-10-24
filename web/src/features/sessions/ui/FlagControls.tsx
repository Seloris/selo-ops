import { t } from "../../../shared/lib/i18n/index.ts";
import type { SessionFlags } from "../../../shared/lib/flags.ts";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { FlagIcon } from "../../../shared/ui/icons.tsx";
import { Switch } from "../../../shared/ui/Switch.tsx";
import styles from "./FlagControls.module.css";

// sessions-live FR-42: the flag, in the mark colour once set, so that it shows without hovering.
export function FlagButton({ id, flags }: { id: string; flags: SessionFlags }) {
  const isFlagged = flags.isFlagged(id);
  return (
    <IconButton
      label={isFlagged ? t("sessions.actions.unflag") : t("sessions.actions.flag")}
      tone={isFlagged ? "mark" : "muted"}
      aria-pressed={isFlagged}
      onClick={() => flags.toggleFlag(id)}
    >
      <FlagIcon isFilled={isFlagged} />
    </IconButton>
  );
}

// sessions-live FR-42: on a flagged session only, and only where the browser has notifications.
export function NotifySwitch({ id, flags }: { id: string; flags: SessionFlags }) {
  if (!flags.isFlagged(id) || flags.permission === "unsupported") return null;
  const isDenied = flags.permission === "denied";
  return (
    <span className={styles.notify}>
      <Switch label={t("sessions.flag.notify")} checked={flags.isNotified(id)} disabled={isDenied} onChange={() => flags.toggleNotify(id)} />
      {isDenied && <span className={styles.denied}>{t("sessions.flag.denied")}</span>}
    </span>
  );
}
