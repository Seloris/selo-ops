import { t } from "../../../shared/lib/i18n/index.ts";
import { Modal } from "../../../shared/ui/Modal.tsx";
import { HelpContent } from "./HelpContent.tsx";
import styles from "./HelpDialog.module.css";

// help FR-10: the help over the current page, which stays as it was under it.
export function HelpDialog({ onClose }: { onClose(): void }) {
  return (
    <Modal title={t("help.page.title")} closeLabel={t("help.dialog.close")} onClose={onClose}>
      <div className={styles.content}>
        <p className={styles.intro}>{t("help.page.intro")}</p>
        <HelpContent />
      </div>
    </Modal>
  );
}
