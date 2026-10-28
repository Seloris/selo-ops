import { AppError, ConflictError } from "../../shared/errors.js";
import type { ProjectService } from "../projects/projects.service.js";
import type { AppSettingsRepository } from "../settings/settings.repository.js";
import { LaunchError, remoteControlNameOf, type SessionLauncher } from "./launches.launcher.js";
import type { LaunchedSession, LaunchSession } from "./launches.schema.js";

export function createLaunchService({
  projects,
  appSettings,
  launcher,
}: {
  projects: Pick<ProjectService, "launchTarget">;
  appSettings: Pick<AppSettingsRepository, "isCliLaunch">;
  launcher: SessionLauncher;
}) {
  return {
    // `session` BR-24: only while the CLI mode is on, only in a checkout of the project the export lists.
    async launch(projectId: string, input: LaunchSession): Promise<LaunchedSession> {
      if (!(await appSettings.isCliLaunch())) throw new ConflictError("cli_launch_off", "« Lancer les sessions en CLI » is off");
      const target = projects.launchTarget(projectId, input.folder);
      const name = remoteControlNameOf(target.name, input.title);
      try {
        const { id } = await launcher.launch({ cwd: target.root, name, command: input.command, isAutoMode: input.isAutoMode });
        return { id, name, folder: target.root };
      } catch (error) {
        if (error instanceof LaunchError && error.code === "missing-binary") {
          throw new AppError(502, "claude_not_found", `Claude Code was not found: ${error.detail ?? "no detail"}`);
        }
        throw new AppError(502, "launch_failed", `Claude Code failed to start the session: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

export type LaunchService = ReturnType<typeof createLaunchService>;
