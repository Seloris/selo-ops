import { useState } from "react";
import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import type { NotifySetting } from "../../../shared/lib/notifications.ts";
import { Dropdown, DropdownCheck, DropdownNote, DropdownSeparator } from "../../../shared/ui/Dropdown.tsx";
import { BellIcon, BellOffIcon } from "../../../shared/ui/icons.tsx";
import type { SessionState } from "../../sessions/data/sessionView.ts";
import styles from "./NotifyMenu.module.css";

// app FR-05: those « à traiter » (`session` BR-04) first, then the ends of a run.
const TODO: SessionState[] = ["awaiting-answer", "awaiting-permission", "awaiting-commit", "stopped"];
const ENDED: SessionState[] = ["turn-ended", "job-done"];

// app FR-05: the bell and its panel, one check per state that may notify.
export function NotifyMenu({ notify }: { notify: NotifySetting }) {
  const [isOpen, setOpen] = useState(false);
  const check = (state: SessionState) => (
    <DropdownCheck
      key={state}
      label={t(`sessions.state.${state}` as MessageKey)}
      isChecked={notify.states.includes(state)}
      onChange={() => notify.toggle(state)}
    />
  );
  return (
    <Dropdown
      trigger={
        notify.states.length > 0 ? (
          <>
            <BellIcon />
            <span className={styles.count}>{notify.states.length}</span>
          </>
        ) : (
          <BellOffIcon />
        )
      }
      // The badge's count, read out too: the label replaces the trigger's content.
      triggerLabel={notify.states.length > 0 ? `${t("app.notify.label")} · ${notify.states.length}` : t("app.notify.label")}
      align="end"
      isOpen={isOpen}
      onToggle={() => setOpen(!isOpen)}
      onClose={() => setOpen(false)}
      closeLabel={t("app.notify.close")}
      panelLabel={t("app.notify.label")}
    >
      {notify.permission === "denied" ? (
        <DropdownNote>{t("app.notify.denied")}</DropdownNote>
      ) : (
        <>
          <DropdownNote>{t("app.notify.heading")}</DropdownNote>
          {TODO.map(check)}
          <DropdownSeparator />
          {ENDED.map(check)}
        </>
      )}
    </Dropdown>
  );
}
