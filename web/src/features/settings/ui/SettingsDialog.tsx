import { useState, type ReactNode } from "react";
import { t, tn, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { UndoIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { Modal } from "../../../shared/ui/Modal.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import { Select } from "../../../shared/ui/Select.tsx";
import { Switch } from "../../../shared/ui/Switch.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import {
  changesOf,
  choicesOf,
  presetSummary,
  previewOf,
  roleModel,
  type Catalog,
  type Role,
  type SeloSettings,
  type SettingChanges,
  type SettingsChoices,
} from "./settingsForm.ts";
import styles from "./SettingsDialog.module.css";

// The agent each role runs, as selo names it.
const AGENTS: Record<Role, string> = {
  planner: "Plan",
  implementer: "general-purpose",
  reviewer: "selo-flow:reviewer",
  runner: "selo-flow:runner",
  explorer: "Explore",
};
const roleText = (role: Role, part: "" | "Use") => t(`settings.role.${role}${part}` as MessageKey);
const presetLabel = (id: string) => (id === "standard" || id === "lean" ? t(`settings.preset.${id}`) : id);
const roleList = new Intl.ListFormat("fr", { type: "conjunction" });
// app FR-08: what a preset sets, from the catalog the API serves: « opus pour planifier et relire ; … ».
const presetText = (preset: string, catalog: Catalog) =>
  t("settings.preset.sets", {
    groups: presetSummary(preset, catalog)
      .map((g) => t("settings.preset.group", { model: g.model, roles: roleList.format(g.roles.map((r) => roleText(r, "").toLocaleLowerCase("fr"))) }))
      .join(" ; "),
  });

// A message with one placeholder shown as code (a path, `env`).
function withCode(text: string, name: string, code: string): ReactNode {
  const [before, after] = text.split(`{${name}}`);
  return (
    <>
      {before}
      <code className={styles.code}>{code}</code>
      {after}
    </>
  );
}

// app FR-08 to FR-12: the person's selo settings, read from the file when the window opens.
export function SettingsDialog({
  settings,
  loadError,
  isSaving,
  saveError,
  onSave,
  onClose,
}: {
  // null while the file is read.
  settings: SeloSettings | null;
  loadError: string | null;
  isSaving: boolean;
  saveError: string | null;
  onSave(changes: SettingChanges): void;
  onClose(): void;
}) {
  // The choices start from the file once it is read; the same window shows the reading, then the settings.
  const [form, setForm] = useState<{ initial: SettingsChoices; choices: SettingsChoices } | null>(null);
  if (settings !== null && form === null) {
    const initial = choicesOf(settings.values, settings.catalog);
    setForm({ initial, choices: initial });
  }
  if (settings === null || form === null) {
    return (
      <Modal title={t("settings.dialog.title")} closeLabel={t("settings.dialog.close")} onClose={onClose}>
        {loadError !== null ? <ErrorMessage>{t("settings.dialog.loadError", { message: loadError })}</ErrorMessage> : <LoadingState>{t("settings.dialog.loading")}</LoadingState>}
      </Modal>
    );
  }
  const { catalog, path } = settings;
  const { initial, choices } = form;
  const setChoices = (update: (c: SettingsChoices) => SettingsChoices) => setForm((f) => f && { ...f, choices: update(f.choices) });
  const isUnreadable = settings.state === "unreadable";
  const changes = changesOf(initial, choices, catalog);
  const count = Object.keys(changes).length;
  const setRole = (role: Role, model: string) => setChoices((c) => ({ ...c, roles: { ...c.roles, [role]: model } }));

  const footer = (
    <div className={styles.foot}>
      {count > 0 && (
        <div className={styles.preview}>
          <span className={styles.previewTitle}>{withCode(t("settings.preview.title"), "env", "env")}</span>
          <Preview settings={settings} changes={changes} />
        </div>
      )}
      {saveError !== null && <ErrorMessage>{t("settings.saveError", { message: saveError })}</ErrorMessage>}
      <div className={styles.actions}>
        <span className={styles.hint}>{isUnreadable ? null : count > 0 ? tn("settings.foot.pending", count) : t("settings.foot.hint")}</span>
        <Button variant="quiet" disabled={isSaving} onClick={onClose}>
          {isUnreadable ? t("settings.foot.close") : t("settings.foot.cancel")}
        </Button>
        <Button variant="primary" disabled={isUnreadable || count === 0 || isSaving} onClick={() => onSave(changes)}>
          {isSaving ? t("settings.foot.saving") : t("settings.foot.save")}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal title={t("settings.dialog.title")} closeLabel={t("settings.dialog.close")} footer={footer} onClose={onClose}>
      <div className={styles.window}>
        <p className={styles.where}>
          {t("settings.dialog.where")} <span className={styles.sep}>·</span> <code className={styles.code}>{path}</code>
        </p>
        {isUnreadable && settings.error && (
          <div className={styles.alert} role="alert">
            <WarningIcon />
            <div>
              <b>{t("settings.unreadable.title")}</b>{" "}
              {withCode(
                settings.error.reason === "json"
                  ? settings.error.line !== null
                    ? t("settings.unreadable.json", { line: settings.error.line, column: settings.error.column ?? 1 })
                    : t("settings.unreadable.jsonNoPosition")
                  : t(`settings.unreadable.${settings.error.reason}`),
                "path",
                path,
              )}{" "}
              {t("settings.unreadable.fix")}
            </div>
          </div>
        )}
        <fieldset className={styles.section} disabled={isUnreadable}>
          <legend className={styles.sectionHead}>
            <span className={styles.label}>{t("settings.models.label")}</span>
            <span className={styles.sub}>{t("settings.models.sub")}</span>
          </legend>
          <div className={styles.preset}>
            <span className={styles.name}>
              {t("settings.preset.label")} <span className={styles.key}>SELO_MODELS</span>
            </span>
            <Segmented
              label={t("settings.preset.label")}
              value={choices.preset}
              onChange={(preset) => setChoices((c) => ({ ...c, preset }))}
              options={catalog.presets.map((p) => ({ value: p.id, label: presetLabel(p.id) }))}
            />
            <span className={styles.presetDesc}>
              {catalog.presets.map((p) => (
                <span key={p.id}>
                  <b>{presetLabel(p.id)}</b> {presetText(p.id, catalog)}{" "}
                </span>
              ))}
            </span>
          </div>
          <div className={styles.roles}>
            {catalog.roles.map((role) => {
              const { model, isCustom } = roleModel(choices, role, catalog);
              const presetOne = roleModel({ ...choices, roles: { ...choices.roles, [role]: "" } }, role, catalog).model;
              // app FR-09: a model the menu does not offer, as the file holds it, stays one of its choices.
              const unknown = initial.roles[role] !== "" && !(catalog.models as string[]).includes(initial.roles[role]) ? initial.roles[role] : null;
              return (
                <div key={role} className={isCustom ? `${styles.role} ${styles.custom}` : styles.role}>
                  <span className={styles.name}>
                    {roleText(role, "")} <span className={styles.key}>{role}</span>
                    {isCustom && <Tag color="var(--accent)">{t("settings.role.custom")}</Tag>}
                  </span>
                  <span className={styles.agent}>
                    <code className={styles.code}>{AGENTS[role]}</code> · {roleText(role, "Use")}
                  </span>
                  <Select aria-label={t("settings.role.menu", { role: roleText(role, "") })} value={isCustom ? model : ""} onChange={(event) => setRole(role, event.target.value)}>
                    <option value="">{t("settings.role.followPreset", { model: presetOne })}</option>
                    {catalog.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    {unknown !== null && <option value={unknown}>{unknown}</option>}
                  </Select>
                  <span className={styles.slot}>
                    {isCustom && (
                      <IconButton label={t("settings.role.reset")} onClick={() => setRole(role, "")}>
                        <UndoIcon />
                      </IconButton>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </fieldset>
        <fieldset className={styles.section} disabled={isUnreadable}>
          <legend className={styles.sectionHead}>
            <span className={styles.label}>{t("settings.work.label")}</span>
          </legend>
          <div className={styles.option}>
            <Switch label={t("settings.routing.label")} checked={choices.isRouting} disabled={isUnreadable} onChange={(isRouting) => setChoices((c) => ({ ...c, isRouting }))} />
            <span className={styles.flag}>
              SELO_ROUTING = <b>{choices.isRouting ? "on" : "off"}</b>
            </span>
            <span className={styles.desc}>{t("settings.routing.desc")}</span>
          </div>
          <div className={styles.option}>
            <Switch
              label={t("settings.commit.label")}
              checked={choices.isAutoCommit}
              disabled={isUnreadable}
              onChange={(isAutoCommit) => setChoices((c) => ({ ...c, isAutoCommit }))}
            />
            <span className={styles.flag}>
              SELO_COMMIT = <b>{choices.isAutoCommit ? "auto" : "ask"}</b>
            </span>
            <span className={styles.desc}>{t("settings.commit.desc")}</span>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

// app FR-10: the SELO_ keys `env` will hold, a new or changed value marked.
function Preview({ settings, changes }: { settings: SeloSettings; changes: SettingChanges }) {
  const lines = previewOf(settings.values, changes);
  if (lines.length === 0) return <p className={styles.hint}>{t("settings.preview.empty")}</p>;
  return (
    <pre className={styles.env}>
      {lines.map((line, i) => (
        <span key={line.key}>
          {`"${line.key}": `}
          <span className={styles[line.mark]}>{JSON.stringify(line.value)}</span>
          {i < lines.length - 1 ? ",\n" : ""}
        </span>
      ))}
    </pre>
  );
}
