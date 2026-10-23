import { t } from "../../../shared/lib/i18n/index.ts";
import { Modal } from "../../../shared/ui/Modal.tsx";
import { HelpContent } from "./HelpContent.tsx";
import styles from "./HelpDialog.module.css";

// help FR-10: the help over the current page, which stays as it was under it; FR-16: full screen on demand.
export function HelpDialog({ onClose }: { onClose(): void }) {
  return (
    <Modal
      title={t("help.page.title")}
      closeLabel={t("help.dialog.close")}
      fullscreen={{ enter: t("help.dialog.fullscreen"), exit: t("help.dialog.exitFullscreen") }}
      onClose={onClose}
    >
      <div className={styles.content}>
        <HelpContent />
      </div>
    </Modal>
  );
}
