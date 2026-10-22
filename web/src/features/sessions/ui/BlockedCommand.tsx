import { useEffect, useRef } from "react";
import { t } from "../../../shared/lib/i18n/index.ts";
import { TextInput } from "../../../shared/ui/TextInput.tsx";

// sessions-live FR-20: when the copy is refused, the command is shown selected for a manual copy.
export function BlockedCommand({ command }: { command: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [command]);
  return <TextInput ref={ref} readOnly value={command} aria-label={t("sessions.toast.commandLabel")} />;
}
