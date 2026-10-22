import { t } from "../../../shared/lib/i18n/index.ts";
import { PageTitle } from "../../../shared/ui/PageTitle.tsx";
import { Panel } from "../../../shared/ui/Panel.tsx";
import { HelpContent } from "../ui/HelpContent.tsx";
import styles from "./HelpPage.module.css";

// help FR-09: static content only, no data hook: the page renders the same with the API down.
export function HelpPage() {
  return (
    <main className={styles.page}>
      <Panel>
        <header className={styles.header}>
          <PageTitle>{t("help.page.title")}</PageTitle>
          <p className={styles.intro}>{t("help.page.intro")}</p>
        </header>
        <HelpContent />
      </Panel>
    </main>
  );
}
