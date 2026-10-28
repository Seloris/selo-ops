import { useState, type ReactNode } from "react";
import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { CommandBox } from "../../../shared/ui/CommandBox.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { CloseIcon, CollapseIcon, ExpandIcon } from "../../../shared/ui/icons.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { SpecIcon, specColor } from "../../../shared/ui/SpecKind.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { dateOf, deltaBySheet, type Blueprint, type DeltaLine, type SpecSheet } from "../data/projectView.ts";
import { InlineMarkdown, Markdown } from "./Markdown.tsx";
import { DeltaBar, LiveSessions, ProgressTrack, StateTag, type LiveItem } from "./ProjectParts.tsx";
import { QuestionsTab, type QuestionsState } from "./QuestionsTab.tsx";
import styles from "./ProjectPanel.module.css";

const TABS = ["summary", "text", "questions"] as const;
const TAB_KEYS = { summary: "projects.panel.summary", text: "projects.panel.text", questions: "projects.panel.questions" } as const;

export type PanelSubject =
  | { kind: "blueprint"; blueprint: Blueprint }
  | { kind: "sheet"; sheet: SpecSheet; touching: { blueprint: Blueprint; lines: DeltaLine[] }[] }
  | { kind: "ideas" | "debt"; title: string }
  // projects FR-19, FR-25: the questions on the whole project, or on all its specs.
  | { kind: "ask"; scope: "project" | "specs"; title: string };

export interface FileText {
  isPending: boolean;
  error: string | null;
  text: string | null;
}

function DeltaLines({ lines }: { lines: DeltaLine[] }) {
  return (
    <ul className={styles.delta}>
      {lines.map((l, i) => (
        <li key={i}>
          <span className={`${styles.op} ${l.op === "+" ? styles.add : l.op === "~" ? styles.change : styles.remove}`}>{l.op === "-" ? "−" : l.op}</span>
          <span className={styles.id}>{l.id}</span>
          <span className={styles.text}>
            <InlineMarkdown text={l.text} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{title}</h3>
      {children}
    </section>
  );
}

// projects FR-10 to FR-13, FR-19, FR-20: a blueprint, a sheet, the ideas, the debt or the questions on the project, in the side panel.
export function ProjectPanel({
  subject,
  file,
  questions,
  now,
  age,
  liveOf,
  ageOf,
  isFullscreen,
  onClose,
  onToggleFullscreen,
  onCopy,
}: {
  subject: PanelSubject;
  file: FileText;
  // The questions on the panel's file, or on the whole project; null for the ideas and the debt.
  questions: QuestionsState | null;
  now: number;
  age: (ms: number) => string;
  liveOf: (ids: string[]) => LiveItem[];
  ageOf: (iso: string) => string;
  isFullscreen: boolean;
  onClose: () => void;
  onToggleFullscreen: () => void;
  onCopy: (prompt: string) => void;
}) {
  const title = subject.kind === "blueprint" ? subject.blueprint.title : subject.kind === "sheet" ? subject.sheet.title : subject.title;
  const kindLabel =
    subject.kind === "blueprint" ? null : subject.kind === "sheet"
        ? t(`projects.panel.kind.${subject.sheet.kind}` as MessageKey)
        : subject.kind === "ask" && subject.scope === "specs"
          ? t("projects.panel.kind.askSpecs")
          : t(`projects.panel.kind.${subject.kind}`);
  const sheetKind = subject.kind === "sheet" && subject.sheet.kind === "page" ? "page" : "domain";
  const none = t("projects.panel.none");
  // The summary, the whole text and the questions in three tabs, so the delta and the decisions never show twice; the panel is keyed on its file.
  const [tab, setTab] = useState<(typeof TABS)[number]>("summary");

  let facts: ReactNode = null;
  if (subject.kind === "blueprint") {
    const b = subject.blueprint;
    const live = liveOf(b.sessionIds);
    facts = (
      <>
        <dl className={styles.facts}>
          <dt>{t("projects.panel.date")}</dt>
          <dd className={styles.mono}>{dateOf(b) ?? none}</dd>
          <dt>{t("projects.panel.pages")}</dt>
          <dd className={styles.mono}>{b.sheets.join(" · ") || none}</dd>
          <dt>{t("projects.panel.components")}</dt>
          <dd className={styles.mono}>{b.components.join(" · ") || none}</dd>
        </dl>
        {b.state !== "legacy" && (
          <Block title={t("projects.panel.progress")}>
            <ProgressTrack blueprint={b} isLarge />
          </Block>
        )}
        {b.delta.length > 0 && (
          <Block title={t("projects.panel.delta")}>
            <p className={styles.legend}>{t("projects.panel.deltaLegend")}</p>
            {deltaBySheet(b.delta).map((g) => (
              <div key={g.sheet} className={styles.group}>
                <h4 className={styles.groupTitle}>
                  {g.sheet} <DeltaBar delta={g.lines} />
                </h4>
                <DeltaLines lines={g.lines} />
              </div>
            ))}
          </Block>
        )}
        {b.decisions.length > 0 && (
          <Block title={t("projects.panel.decisions")}>
            <ul className={styles.decisions}>
              {b.decisions.map((d, i) => (
                <li key={i}>
                  <InlineMarkdown text={d} />
                </li>
              ))}
            </ul>
          </Block>
        )}
        {live.length > 0 && (
          <Block title={t("projects.sessions.label")}>
            <LiveSessions items={live} />
          </Block>
        )}
        {b.nextPrompt && (
          <Block title={t("projects.panel.next")}>
            <CommandBox command={b.nextPrompt} copyLabel={t("projects.next.copy")} onCopy={() => onCopy(b.nextPrompt ?? "")} />
          </Block>
        )}
      </>
    );
  } else if (subject.kind === "sheet") {
    const s = subject.sheet;
    facts = (
      <>
        <dl className={styles.facts}>
          {s.route && (
            <>
              <dt>{t("projects.panel.route")}</dt>
              <dd className={styles.mono}>{s.route}</dd>
            </>
          )}
          <dt>{t("projects.panel.ids")}</dt>
          <dd>
            {t("projects.specs.counts", { fr: s.frCount, br: s.brCount })} · {t("projects.panel.nextIds", { fr: s.nextFr, br: s.nextBr })}
          </dd>
          <dt>{t("projects.panel.lastCommit")}</dt>
          <dd className={styles.mono}>{s.lastCommit ? `${s.lastCommit.sha} ${t("projects.specs.lastCommit", { subject: s.lastCommit.subject, age: ageOf(s.lastCommit.at) })}` : none}</dd>
        </dl>
        <Block title={t("projects.panel.openBlueprints")}>
          {subject.touching.length === 0 ? (
            <p className={styles.muted}>{none}</p>
          ) : (
            subject.touching.map(({ blueprint, lines }) => (
              <div key={blueprint.name} className={styles.group}>
                <h4 className={styles.groupTitle}>
                  {blueprint.title} <StateTag state={blueprint.state} />
                </h4>
                {lines.length > 0 && <DeltaLines lines={lines} />}
              </div>
            ))
          )}
        </Block>
      </>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.row}>
          <span className={styles.tags}>
            {subject.kind === "blueprint" ? (
              <>
                <Tag icon={<SpecIcon kind="blueprint" />} color={specColor("blueprint")}>
                  {t("projects.panel.kind.blueprint")}
                </Tag>
                <StateTag state={subject.blueprint.state} />
              </>
            ) : subject.kind === "sheet" ? (
              <>
                <Tag icon={<SpecIcon kind={sheetKind} />} color={specColor(sheetKind)}>
                  {kindLabel}
                </Tag>
                {subject.sheet.isStub && <Tag>{t("projects.specs.stub")}</Tag>}
              </>
            ) : (
              <Tag>{kindLabel}</Tag>
            )}
            {subject.kind === "blueprint" && subject.blueprint.worktreeBranch && <Tag>{t("projects.worktree", { branch: subject.blueprint.worktreeBranch })}</Tag>}
          </span>
          <span className={styles.buttons}>
            <span className={styles.fullscreen}>
              <IconButton label={isFullscreen ? t("projects.panel.exitFullscreen") : t("projects.panel.fullscreen")} aria-pressed={isFullscreen} onClick={onToggleFullscreen}>
                {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
              </IconButton>
            </span>
            <IconButton label={t("projects.panel.close")} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </span>
        </div>
        <h2 className={styles.title}>{title}</h2>
      </div>
      {facts && (
        <div className={styles.tabs} role="tablist" aria-label={t("projects.panel.tabs")}>
          {TABS.map((v) => (
            <button
              key={v}
              id={`panel-tab-${v}`}
              type="button"
              role="tab"
              className={styles.tab}
              aria-selected={tab === v}
              aria-controls="panel-tabpanel"
              tabIndex={tab === v ? 0 : -1}
              onClick={() => setTab(v)}
              onKeyDown={(e) => {
                // The arrows move to the next or the previous tab, round.
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                const step = e.key === "ArrowRight" ? 1 : TABS.length - 1;
                const next = TABS[(TABS.indexOf(v) + step) % TABS.length] ?? "summary";
                setTab(next);
                document.getElementById(`panel-tab-${next}`)?.focus();
              }}
            >
              {t(TAB_KEYS[v])}
            </button>
          ))}
        </div>
      )}
      <div className={`${styles.body} ${isFullscreen ? styles.wide : ""}`} {...(facts ? { id: "panel-tabpanel", role: "tabpanel", "aria-labelledby": `panel-tab-${tab}` } : {})}>
        {subject.kind === "ask" && questions ? (
          <QuestionsTab state={questions} hasPresets={false} now={now} age={age} />
        ) : facts && tab === "summary" ? (
          facts
        ) : facts && tab === "questions" && questions ? (
          <QuestionsTab state={questions} hasPresets now={now} age={age} />
        ) : file.isPending ? (
          <LoadingState>{t("projects.panel.loading")}</LoadingState>
        ) : file.error !== null ? (
          <ErrorMessage>{t("projects.panel.error", { message: file.error || t("projects.page.errorUnknown") })}</ErrorMessage>
        ) : (
          <div className={styles.fileText}>
            <Markdown source={file.text ?? ""} />
          </div>
        )}
      </div>
    </div>
  );
}
