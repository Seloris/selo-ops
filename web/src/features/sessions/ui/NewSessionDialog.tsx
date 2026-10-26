import { useState, type ReactNode } from "react";
import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { CommandBox } from "../../../shared/ui/CommandBox.tsx";
import { DropdownCheck, DropdownNote } from "../../../shared/ui/Dropdown.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { Field } from "../../../shared/ui/Field.tsx";
import { BlueprintIcon, CloseIcon, DomainIcon, ImageIcon, OpenIcon, PageIcon, PlusIcon, PromptIcon, RobotIcon } from "../../../shared/ui/icons.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { Modal } from "../../../shared/ui/Modal.tsx";
import { SearchInput } from "../../../shared/ui/SearchInput.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import { Select } from "../../../shared/ui/Select.tsx";
import { Switch } from "../../../shared/ui/Switch.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { TextArea } from "../../../shared/ui/TextArea.tsx";
import { TextInput } from "../../../shared/ui/TextInput.tsx";
import {
  EMPTY_FORM,
  SKILL_GROUPS,
  buildableBlueprints,
  canOpen,
  commandOf,
  folderOf,
  hasMockupOption,
  hasNoBrowser,
  isRequestOptional,
  projectOfFolder,
  usesBlueprint,
  type Mode,
  type NewSessionForm,
  type PilotLane,
  type Presence,
  type ProjectOverview,
  type SkillId,
  type SpecSheet,
} from "./newSession.ts";
import styles from "./NewSessionDialog.module.css";

const skillKey = (skill: SkillId, part: "label" | "when") => `sessions.new.skill.${skill}.${part}` as MessageKey;
// sessions-live FR-46: the selo skill beside each choice, as a session's type of work reads it (FR-29).
const skillName = (skill: SkillId) =>
  skill === "free" ? t("sessions.lane.free") : skill === "autonomous" ? t("sessions.lane.pilotAutonomous") : skill;
const LANES: PilotLane[] = ["agent", "fastlane", "blueprint"];
const PRESENCES: { value: Presence; skill: string; icon: ReactNode }[] = [
  { value: "stay", skill: "pilot", icon: <PromptIcon /> },
  { value: "leave", skill: t("sessions.lane.pilotAutonomous"), icon: <RobotIcon /> },
];
// `app` FR-04: a page spec indigo with a window, a domain sheet (the `app` sheet with them) pink with a book.
const isPage = (s: SpecSheet) => s.kind === "page";
const sheetColor = (s: SpecSheet) => (isPage(s) ? "var(--spec-page)" : "var(--spec-domain)");
const sheetIcon = (s: SpecSheet) => (isPage(s) ? <PageIcon /> : <DomainIcon />);

// sessions-live FR-44 to FR-50: what to do, in which project, as the selo command a new session of the Claude app opens
// with, in « Simple » or « Avancé ». `folder` points at the project to open on (FR-43): a session's folder.
export function NewSessionDialog({
  projects,
  error,
  folder,
  prefs,
  onPrefs,
  onCopy,
  onOpen,
  onClose,
}: {
  // null while the projects are read.
  projects: ProjectOverview[] | null;
  error: string | null;
  folder: string | null;
  // FR-49: the mode and the choice made last.
  prefs: { mode: Mode; presence: Presence };
  onPrefs(prefs: { mode: Mode; presence: Presence }): void;
  onCopy(command: string): Promise<boolean>;
  onOpen(command: string, project: ProjectOverview, folder: string): void;
  onClose(): void;
}) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [form, setForm] = useState<NewSessionForm>({ ...EMPTY_FORM, ...prefs });
  const [copied, setCopied] = useState<boolean | null>(null);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const list = projects ?? [];
  const project = list.find((p) => p.id === projectId) ?? (folder !== null ? projectOfFolder(folder, list) : null) ?? list[0] ?? null;
  const blueprints = project ? buildableBlueprints(project) : [];
  const mockups = project?.mockups ?? [];
  const command = commandOf(form);
  const target = project ? folderOf(project, form) : null;
  const isReady = project !== null && canOpen(form);

  const update = (patch: Partial<NewSessionForm>) => {
    const next = { ...form, ...patch };
    setForm(next);
    setCopied(null);
    if (next.mode !== form.mode || next.presence !== form.presence) onPrefs({ mode: next.mode, presence: next.presence });
  };
  const open = () => {
    if (project && target && isReady) onOpen(command, project, target);
  };

  const requestArea = (label: string, placeholder: string, isBig = false) => (
    <Field label={label} error={null}>
      {(control) => (
        <TextArea {...control} value={form.request} autoFocus rows={isBig ? 4 : 3} placeholder={placeholder} onChange={(event) => update({ request: event.target.value })} />
      )}
    </Field>
  );

  // ---- « Simple » (FR-45) ----

  const resumeCard = () => {
    const r = form.resume;
    if (r === null) return null;
    const bp = r.kind === "blueprint" ? blueprints.find((b) => b.file === r.file) : undefined;
    const title = bp?.title ?? mockups.find((m) => m.file === r.file)?.title ?? r.file;
    return (
      <div className={styles.chosen} data-kind={r.kind}>
        <span className={styles.chosenIcon}>{r.kind === "blueprint" ? <BlueprintIcon /> : <ImageIcon />}</span>
        <span className={styles.chosenTitle}>{t(r.kind === "blueprint" ? "sessions.new.resumeBlueprint" : "sessions.new.resumeMockup", { title })}</span>
        <span className={styles.file}>{r.file}</span>
        <Button size="sm" onClick={() => update({ resume: null })}>
          <CloseIcon />
          {t("sessions.new.writeRequest")}
        </Button>
      </div>
    );
  };

  const resumables = [
    ...blueprints.map((b) => ({ kind: "blueprint" as const, file: b.file, title: b.title, state: b.state })),
    ...mockups.map((m) => ({ kind: "mockup" as const, file: m.file, title: m.title, state: null })),
  ];

  const simple = (
    <>
      {form.resume?.kind === "blueprint" ? (
        <div className={styles.field}>
          <span className={styles.label}>{t("sessions.new.what")}</span>
          {resumeCard()}
        </div>
      ) : (
        <>
          {form.resume?.kind === "mockup" && resumeCard()}
          {requestArea(t("sessions.new.what"), t("sessions.new.whatPlaceholder"), true)}
        </>
      )}
      <div className={styles.field}>
        <span className={styles.label}>{t("sessions.new.presence")}</span>
        <div className={styles.presence} role="group" aria-label={t("sessions.new.presence")}>
          {PRESENCES.map((p) => (
            <button key={p.value} type="button" aria-pressed={form.presence === p.value} className={styles.presenceCard} onClick={() => update({ presence: p.value })}>
              <span className={styles.presenceIcon}>{p.icon}</span>
              <span className={styles.presenceName}>{t(`sessions.new.presence.${p.value}` as MessageKey)}</span>
              <span className={styles.presenceHint}>{t(`sessions.new.presence.${p.value}Hint` as MessageKey)}</span>
              <span className={styles.presenceSkill}>{p.skill}</span>
            </button>
          ))}
        </div>
      </div>
      {form.resume === null && resumables.length > 0 && (
        <>
          <div className={styles.divider}>{t("sessions.new.or")}</div>
          <div className={styles.field}>
            <span className={styles.label}>
              {t("sessions.new.resume")} <span className={styles.labelNote}>· {t("sessions.new.resumeCount", { count: resumables.length })}</span>
            </span>
            <div className={styles.rows}>
              {resumables.map((r) => (
                <div key={r.file} className={styles.row}>
                  <span className={styles.rowTitle}>{r.title}</span>
                  <span className={styles.file}>{r.file}</span>
                  {r.state === null ? (
                    <span className={styles.state} data-state="mockup">
                      {t("sessions.new.mockupTag")}
                    </span>
                  ) : (
                    <span className={styles.state} data-state={r.state}>
                      {t(`sessions.new.blueprintState.${r.state}` as MessageKey)}
                    </span>
                  )}
                  <Button size="sm" onClick={() => update({ resume: { kind: r.kind, file: r.file }, ...(r.kind === "mockup" && form.request.trim() === "" ? { request: r.title } : {}) })}>
                    {t("sessions.new.choose")}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <p className={styles.more}>
        {t("sessions.new.toAdvanced")}{" "}
        <button type="button" className={styles.link} onClick={() => update({ mode: "advanced" })}>
          {t("sessions.new.toAdvancedLink")}
        </button>
        .
      </p>
    </>
  );

  // ---- « Avancé » (FR-46) ----

  const option = (label: string, flag: string, hint: string, checked: boolean, onChange: (on: boolean) => void, disabled = false) => (
    <div key={flag} className={styles.option}>
      <Switch label={label} checked={checked} disabled={disabled} onChange={onChange} />
      <code className={styles.flag}>{flag}</code>
      <span className={styles.hint}>{hint}</span>
    </div>
  );

  const blueprintPicker = (
    <div className={styles.rows} role="group" aria-label={t("sessions.new.blueprint")}>
      {blueprints.length === 0 && <p className={styles.hint}>{t("sessions.new.blueprintNone")}</p>}
      {blueprints.map((b) => (
        <button key={b.file} type="button" className={styles.pick} aria-pressed={form.blueprintFile === b.file} onClick={() => update({ blueprintFile: b.file })}>
          <span className={styles.rowTitle}>{b.title}</span>
          <span className={styles.state} data-state={b.state}>
            {t(`sessions.new.blueprintState.${b.state}` as MessageKey)}
          </span>
          <span className={styles.file}>{b.file}</span>
        </button>
      ))}
    </div>
  );

  const sheets = project?.sheets ?? [];
  const needle = query.trim().toLowerCase();
  const found = sheets.filter((s) => needle === "" || `${s.title} ${s.file} ${s.route ?? ""}`.toLowerCase().includes(needle));
  const toggleTouch = (file: string) =>
    update({ touches: form.touches.includes(file) ? form.touches.filter((f) => f !== file) : [...form.touches, file] });
  const sheetGroup = (label: string, group: SpecSheet[]) =>
    group.length > 0 && (
      <>
        <DropdownNote>{label}</DropdownNote>
        {group.map((s) => (
          <DropdownCheck key={s.file} label={s.route ? `${s.title} · ${s.route}` : s.title} isChecked={form.touches.includes(s.file)} onChange={() => toggleTouch(s.file)} />
        ))}
      </>
    );

  const touches = (
    <div className={styles.field}>
      <span className={styles.label}>
        {t("sessions.new.touches")} <span className={styles.labelNote}>· {t("sessions.new.optional")}</span>
      </span>
      <div className={styles.touches}>
        {form.touches.map((file) => {
          const s = sheets.find((x) => x.file === file);
          return (
            <button key={file} type="button" className={styles.touch} aria-label={t("sessions.new.touchRemove", { title: s?.title ?? file })} onClick={() => toggleTouch(file)}>
              {s ? (
                <Tag icon={sheetIcon(s)} color={sheetColor(s)}>
                  {s.title}
                </Tag>
              ) : (
                <Tag>{file}</Tag>
              )}
              <CloseIcon />
            </button>
          );
        })}
        <Button size="sm" aria-expanded={isPickerOpen} onClick={() => setPickerOpen(!isPickerOpen)}>
          <PlusIcon />
          {t("sessions.new.touchAdd")}
        </Button>
      </div>
      {/* In the flow, not floating: the window's sticky foot would cover a floating list. */}
      {isPickerOpen && (
        <div className={styles.touchPanel} role="group" aria-label={t("sessions.new.touchAdd")}>
          <SearchInput aria-label={t("sessions.new.touchSearch")} placeholder={t("sessions.new.touchSearch")} value={query} autoFocus onChange={(event) => setQuery(event.target.value)} />
          {found.length === 0 && <DropdownNote>{t("sessions.new.touchNone")}</DropdownNote>}
          {sheetGroup(t("sessions.new.touchPages"), found.filter(isPage))}
          {sheetGroup(t("sessions.new.touchDomain"), found.filter((s) => !isPage(s)))}
        </div>
      )}
    </div>
  );

  const options = [
    form.skill === "autonomous" && !form.fromBlueprint && (
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
    form.skill === "autonomous" &&
      !form.fromBlueprint &&
      option(t("sessions.new.untilBlueprint"), "— until blueprint", t("sessions.new.untilBlueprintHint"), form.untilBlueprint && form.lane !== "fastlane", (on) => update({ untilBlueprint: on }), form.lane === "fastlane"),
    hasMockupOption(form.skill) && (
      <div key="mockup" className={styles.option}>
        <Switch
          label={t("sessions.new.mockup")}
          checked={form.mockupFile !== null}
          disabled={mockups.length === 0}
          onChange={(on) => update({ mockupFile: on ? (mockups[0]?.file ?? null) : null })}
        />
        <code className={styles.flag}>— mockup</code>
        <span className={styles.hint}>{t(mockups.length === 0 ? "sessions.new.mockupNone" : "sessions.new.mockupHint")}</span>
        {form.mockupFile !== null && (
          <span className={styles.wide}>
            <Select aria-label={t("sessions.new.mockupPick")} value={form.mockupFile} onChange={(event) => update({ mockupFile: event.target.value })}>
              {mockups.map((m) => (
                <option key={m.file} value={m.file}>
                  {m.title}
                </option>
              ))}
            </Select>
          </span>
        )}
      </div>
    ),
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

  const advanced = (
    <>
      <div className={styles.field}>
        <span className={styles.label}>{t("sessions.new.doing")}</span>
        <div className={styles.groups}>
          {SKILL_GROUPS.map(({ group, skills }) => (
            <div key={group} className={styles.group} role="group" aria-label={t(`sessions.new.group.${group}` as MessageKey)}>
              <span className={styles.groupName}>{t(`sessions.new.group.${group}` as MessageKey)}</span>
              <div className={styles.chips}>
                {skills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className={styles.chip}
                    data-skill={skill}
                    aria-pressed={form.skill === skill}
                    disabled={skill === "build" && blueprints.length === 0}
                    // A blueprint of another choice is picked again.
                    onClick={() => update({ skill, blueprintFile: null })}
                  >
                    {t(skillKey(skill, "label"))}
                    <span className={styles.skill}>{skillName(skill)}</span>
                    {skill === "build" && <span className={styles.count}>{blueprints.length}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className={styles.when}>
          <span>
            <b>{t(skillKey(form.skill, "label"))}</b> · {t(skillKey(form.skill, "when"))}
          </span>
          <a href="/help" target="_blank" rel="noreferrer">
            {t("sessions.new.guide")}
          </a>
        </p>
      </div>
      {form.skill === "autonomous" && (
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
        <>
          {requestArea(
            t(isRequestOptional(form.skill) ? "sessions.new.scope" : "sessions.new.request"),
            t(form.skill === "review" ? "sessions.new.reviewPlaceholder" : form.skill === "try" ? "sessions.new.tryPlaceholder" : "sessions.new.requestPlaceholder"),
          )}
          {touches}
        </>
      )}
      {options.length > 0 && (
        <div className={styles.field}>
          <span className={styles.label}>{t("sessions.new.options")}</span>
          <div className={styles.options}>{options}</div>
        </div>
      )}
    </>
  );

  const needHint =
    form.mode === "simple" ? "sessions.new.needRequestOrBlueprint" : usesBlueprint(form) ? "sessions.new.needBlueprint" : "sessions.new.needRequest";

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
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              open();
            }
          }}
        >
          <div className={styles.top}>
            <span className={styles.in}>{t("sessions.new.in")}</span>
            <span className={styles.project}>
              <Select
                aria-label={t("sessions.new.project")}
                value={project.id}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  // Files of the other project are picked again.
                  update({ resume: null, blueprintFile: null, mockupFile: null, touches: [] });
                }}
              >
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </span>
            <span className={styles.path}>{target}</span>
            <span className={styles.mode}>
              <Segmented
                label={t("sessions.new.mode")}
                options={[
                  { value: "simple", label: t("sessions.new.mode.simple") },
                  { value: "advanced", label: t("sessions.new.mode.advanced") },
                ]}
                value={form.mode}
                onChange={(mode) => update({ mode })}
              />
            </span>
          </div>
          <div className={styles.body}>{form.mode === "simple" ? simple : advanced}</div>
          <div className={styles.foot}>
            <CommandBox
              command={command || " "}
              copyLabel={t(copied === null ? "sessions.new.copy" : copied ? "sessions.new.copied" : "sessions.new.copyBlocked")}
              onCopy={() => void onCopy(command).then(setCopied)}
            />
            <div className={styles.footRow}>
              <span className={styles.footHint}>
                {isReady ? t("sessions.new.goHint", { project: project.name }) : t(needHint)}
                <kbd className={styles.kbd}>{t("sessions.new.shortcut")}</kbd>
              </span>
              <Button variant="primary" disabled={!isReady} onClick={open}>
                <OpenIcon />
                {t("sessions.new.go")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
