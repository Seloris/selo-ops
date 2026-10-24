import { useState } from "react";
import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { CommandBox } from "../../../shared/ui/CommandBox.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { Field } from "../../../shared/ui/Field.tsx";
import { BackIcon, OpenIcon, QuestionIcon } from "../../../shared/ui/icons.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { Modal } from "../../../shared/ui/Modal.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import { Select } from "../../../shared/ui/Select.tsx";
import { Switch } from "../../../shared/ui/Switch.tsx";
import { TextArea } from "../../../shared/ui/TextArea.tsx";
import { TextInput } from "../../../shared/ui/TextInput.tsx";
import {
  EMPTY_FORM,
  SKILL_GROUPS,
  buildableBlueprints,
  canOpen,
  commandOf,
  folderOf,
  hasNoBrowser,
  isRequestOptional,
  projectOfFolder,
  usesBlueprint,
  type AutopilotLane,
  type NewSessionForm,
  type ProjectOverview,
  type SkillId,
} from "./newSession.ts";
import styles from "./NewSessionDialog.module.css";

const skillKey = (skill: SkillId, part: "label" | "when" | "lead") => `sessions.new.skill.${skill}.${part}` as MessageKey;
const skillName = (skill: SkillId) => (skill === "free" ? t("sessions.lane.free") : skill);
const LANES: AutopilotLane[] = ["agent", "fastlane", "blueprint"];

// sessions-live FR-44 to FR-47: what to do, in which project, as the selo command a new session of the Claude
// app opens with. `folder` points at the project to open on (FR-43): a session's folder.
export function NewSessionDialog({
  projects,
  error,
  folder,
  onCopy,
  onOpen,
  onClose,
}: {
  // null while the projects are read.
  projects: ProjectOverview[] | null;
  error: string | null;
  folder: string | null;
  onCopy(command: string): Promise<boolean>;
  onOpen(command: string, project: ProjectOverview, folder: string): void;
  onClose(): void;
}) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [form, setForm] = useState<NewSessionForm>(EMPTY_FORM);
  // sessions-live FR-47: below 640 px, the list of choices, then the chosen form.
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [copied, setCopied] = useState<boolean | null>(null);

  const list = projects ?? [];
  const project = list.find((p) => p.id === projectId) ?? (folder !== null ? projectOfFolder(folder, list) : null) ?? list[0] ?? null;
  const blueprints = project ? buildableBlueprints(project) : [];
  const command = commandOf(form);
  const target = project ? folderOf(project, form) : null;
  const isReady = project !== null && canOpen(form);

  const update = (patch: Partial<NewSessionForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setCopied(null);
  };
  const choose = (skill: SkillId) => {
    // A blueprint of the other project is not one of this one's: picked again.
    update({ skill, blueprintFile: null });
    setStep("form");
  };
  const open = () => {
    if (project && target && isReady) onOpen(command, project, target);
  };

  const option = (label: string, flag: string, hint: string, checked: boolean, onChange: (on: boolean) => void, disabled = false) => (
    <div key={flag} className={styles.option}>
      <Switch label={label} checked={checked} disabled={disabled} onChange={onChange} />
      <code className={styles.flag}>{flag}</code>
      <span className={styles.hint}>{hint}</span>
    </div>
  );

  const blueprintPicker = (
    <div className={styles.blueprints} role="group" aria-label={t("sessions.new.blueprint")}>
      {blueprints.length === 0 && <p className={styles.hint}>{t("sessions.new.blueprintNone")}</p>}
      {blueprints.map((b) => (
        <button key={b.file} type="button" className={styles.blueprint} aria-pressed={form.blueprintFile === b.file} onClick={() => update({ blueprintFile: b.file })}>
          <span className={styles.bpTitle}>{b.title}</span>
          <span className={styles.bpState} data-state={b.state}>
            {t(`sessions.new.blueprintState.${b.state}` as MessageKey)}
          </span>
          <span className={styles.bpFile}>{b.file}</span>
        </button>
      ))}
    </div>
  );

  const requestField = (
    <Field label={t(isRequestOptional(form.skill) ? "sessions.new.scope" : "sessions.new.request")} error={null}>
      {(control) => (
        <TextArea
          {...control}
          value={form.request}
          autoFocus
          placeholder={t(form.skill === "review" ? "sessions.new.reviewPlaceholder" : form.skill === "try" ? "sessions.new.tryPlaceholder" : "sessions.new.requestPlaceholder")}
          onChange={(event) => update({ request: event.target.value })}
        />
      )}
    </Field>
  );

  const options = [
    form.skill === "autopilot" && !form.fromBlueprint && (
      <div key="lane" className={styles.option}>
        <span className={styles.optionName}>{t("sessions.new.lane")}</span>
        <code className={styles.flag}>— fastlane · — blueprint</code>
        <span className={styles.hint}>{t("sessions.new.laneHint")}</span>
        <span className={styles.wide}>
          <Segmented
            label={t("sessions.new.lane")}
            options={LANES.map((lane) => ({ value: lane, label: t(`sessions.new.lane.${lane}` as MessageKey) }))}
            value={form.lane}
            onChange={(lane) => update({ lane })}
          />
        </span>
      </div>
    ),
    form.skill === "autopilot" &&
      !form.fromBlueprint &&
      option(t("sessions.new.untilBlueprint"), "— until blueprint", t("sessions.new.untilBlueprintHint"), form.untilBlueprint && form.lane !== "fastlane", (on) => update({ untilBlueprint: on }), form.lane === "fastlane"),
    form.skill === "fastlane" && option(t("sessions.new.iterate"), "— iterate", t("sessions.new.iterateHint"), form.iterate, (on) => update({ iterate: on })),
    form.skill === "build" && (
      <div key="stage" className={styles.option}>
        <Switch label={t("sessions.new.stage")} checked={form.stage !== null} onChange={(on) => update({ stage: on ? 1 : null })} />
        <code className={styles.flag}>— stage N</code>
        <span className={styles.hint}>{t("sessions.new.stageHint")}</span>
        <span className={styles.stage}>
          <TextInput
            type="number"
            min={1}
            aria-label={t("sessions.new.stageNumber")}
            value={form.stage ?? 1}
            disabled={form.stage === null}
            onChange={(event) => update({ stage: Math.max(1, Math.floor(Number(event.target.value)) || 1) })}
          />
        </span>
      </div>
    ),
    hasNoBrowser(form.skill) && option(t("sessions.new.noBrowser"), "— no browser", t("sessions.new.noBrowserHint"), form.noBrowser, (on) => update({ noBrowser: on })),
  ].filter(Boolean);

  return (
    <Modal title={t("sessions.new.title")} closeLabel={t("sessions.new.close")} onClose={onClose}>
      {error !== null && !projects ? (
        <ErrorMessage>{t("sessions.new.error", { message: error })}</ErrorMessage>
      ) : !projects ? (
        <LoadingState>{t("sessions.new.loading")}</LoadingState>
      ) : !project ? (
        <p className={styles.hint}>{t("sessions.new.noProject")}</p>
      ) : (
        <div
          className={styles.window}
          data-step={step}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              open();
            }
          }}
        >
          <div className={styles.project}>
            <Field label={t("sessions.new.project")} error={null}>
              {(control) => (
                <Select
                  {...control}
                  value={project.id}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    update({ blueprintFile: null });
                  }}
                >
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <span className={styles.path}>{target}</span>
          </div>
          <div className={styles.grid}>
            <nav className={styles.choices} aria-label={t("sessions.new.choices")}>
              {SKILL_GROUPS.map(({ group, skills }) => (
                <div key={group} className={styles.group} role="group" aria-label={t(`sessions.new.group.${group}` as MessageKey)}>
                  <span className={styles.groupName}>{t(`sessions.new.group.${group}` as MessageKey)}</span>
                  {skills.map((skill) => {
                    const isEmptyBuild = skill === "build" && blueprints.length === 0;
                    return (
                      <button key={skill} type="button" className={styles.choice} data-skill={skill} aria-pressed={form.skill === skill} disabled={isEmptyBuild} onClick={() => choose(skill)}>
                        <span className={styles.choiceName}>
                          {t(skillKey(skill, "label"))}
                          <span className={styles.skill}>{skillName(skill)}</span>
                          {skill === "build" && <span className={styles.count}>{blueprints.length}</span>}
                        </span>
                        <span className={styles.when}>{t(isEmptyBuild ? "sessions.new.skill.build.none" : skillKey(skill, "when"))}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              <span className={styles.unsure}>
                <QuestionIcon />
                {t("sessions.new.unsure")}
                <a href="/help" target="_blank" rel="noreferrer">
                  {t("sessions.new.guide")}
                </a>
              </span>
            </nav>
            <div className={styles.form}>
              <button type="button" className={styles.back} onClick={() => setStep("choose")}>
                <BackIcon />
                <span className={styles.backName}>{t(skillKey(form.skill, "label"))}</span>
                <span className={styles.skill} data-skill={form.skill}>
                  {skillName(form.skill)}
                </span>
                <span className={styles.srOnly}>{t("sessions.new.back")}</span>
              </button>
              <p className={styles.lead}>{t(skillKey(form.skill, "lead"))}</p>
              {form.skill === "autopilot" && (
                <div className={styles.field}>
                  <span className={styles.label}>{t("sessions.new.startFrom")}</span>
                  <Segmented
                    label={t("sessions.new.startFrom")}
                    options={[
                      { value: "request", label: t("sessions.new.fromRequest") },
                      { value: "blueprint", label: t("sessions.new.fromBlueprint") },
                    ]}
                    value={form.fromBlueprint ? "blueprint" : "request"}
                    onChange={(from) => update({ fromBlueprint: from === "blueprint" })}
                  />
                </div>
              )}
              {usesBlueprint(form) ? (
                <div className={styles.field}>
                  <span className={styles.label}>{t("sessions.new.blueprint")}</span>
                  {blueprintPicker}
                </div>
              ) : (
                requestField
              )}
              {options.length > 0 && (
                <div className={styles.field}>
                  <span className={styles.label}>{t("sessions.new.options")}</span>
                  <div className={styles.options}>{options}</div>
                </div>
              )}
              <div className={styles.field}>
                <span className={styles.label}>{t("sessions.new.command")}</span>
                <CommandBox
                  command={command || " "}
                  copyLabel={t(copied === null ? "sessions.new.copy" : copied ? "sessions.new.copied" : "sessions.new.copyBlocked")}
                  onCopy={() => void onCopy(command).then(setCopied)}
                />
              </div>
              <div className={styles.foot}>
                <span className={styles.footHint}>
                  {isReady ? t("sessions.new.goHint", { project: project.name }) : t(usesBlueprint(form) ? "sessions.new.needBlueprint" : "sessions.new.needRequest")}
                  <kbd className={styles.kbd}>{t("sessions.new.shortcut")}</kbd>
                </span>
                <Button variant="primary" disabled={!isReady} onClick={open}>
                  <OpenIcon />
                  {t("sessions.new.go")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
