import { useMemo } from "react";
import { t } from "../../../shared/lib/i18n/index.ts";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { CloseIcon, CommitIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import type { FileDiff } from "../data/useFileDiffQuery.ts";
import { diffLines } from "./diffLines.ts";
import styles from "./FileDiffView.module.css";

export interface FileDiffState {
  file: string;
  diff: FileDiff | undefined;
  isLoading: boolean;
  error: string | null;
}

// sessions-live FR-51: what one touched file went through, each recorded commit's part, then its uncommitted part.
export function FileDiffView({ state: { file, diff, isLoading, error }, onClose }: { state: FileDiffState; onClose: () => void }) {
  return (
    <div className={styles.diff}>
      <div className={styles.head}>
        <span className={styles.file} title={file}>
          {file}
        </span>
        <IconButton label={t("sessions.diff.close")} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>
      {isLoading ? (
        <LoadingState>{t("sessions.diff.loading")}</LoadingState>
      ) : error !== null ? (
        <ErrorMessage>{error || t("sessions.diff.error")}</ErrorMessage>
      ) : !diff ? null : !diff.isAvailable ? (
        <p className={styles.note}>{t("sessions.diff.noFolder")}</p>
      ) : diff.commits.length === 0 && !diff.uncommitted ? (
        <p className={styles.note}>{t("sessions.diff.empty")}</p>
      ) : (
        <>
          {diff.commits.map((c) => (
            <section key={c.sha} className={styles.part}>
              <h4 className={styles.partTitle}>
                <CommitIcon />
                <span className={styles.sha}>{c.sha}</span>
                <span className={styles.subject}>{c.subject}</span>
              </h4>
              {c.diff === null ? <p className={styles.note}>{t("sessions.diff.commitGone")}</p> : <DiffBlock text={c.diff} isCut={c.isCut} />}
            </section>
          ))}
          {diff.uncommitted && (
            <section className={styles.part}>
              <h4 className={styles.partTitle}>{t("sessions.diff.uncommitted")}</h4>
              <p className={styles.notice}>
                <WarningIcon />
                {t("sessions.diff.sharedNotice")}
              </p>
              <DiffBlock text={diff.uncommitted.diff} isCut={diff.uncommitted.isCut} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DiffBlock({ text, isCut }: { text: string; isCut: boolean }) {
  const lines = useMemo(() => diffLines(text), [text]);
  return (
    <>
      <pre className={styles.code}>
        {lines.map((l, i) => (
          <span key={i} className={`${styles.line} ${styles[l.kind]}`}>
            {l.text || " "}
          </span>
        ))}
      </pre>
      {isCut && <p className={styles.note}>{t("sessions.diff.cut")}</p>}
    </>
  );
}
