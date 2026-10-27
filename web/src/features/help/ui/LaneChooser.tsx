import { type ReactNode, useEffect, useRef, useState } from "react";
import { copyText } from "../../../shared/lib/clipboard.ts";
import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { CheckIcon, ChevronDownIcon, CopyIcon } from "../../../shared/ui/icons.tsx";
import type { ColourId } from "../content.ts";
import {
  answer,
  isAnswered,
  isPreviewAllowed,
  isScopeOpen,
  laneFor,
  previewHint,
  splitPrompt,
  type Answers,
  type LanePrompt,
  type LaneResult,
  type Preview,
  type Question,
  type Track,
} from "../laneChooser.ts";
import styles from "./LaneChooser.module.css";

// help FR-11: a lane's or a flow's class sets --c, which its dots, borders and tints read.
const colourClass = (colour?: ColourId) => (colour ? styles[`c-${colour}`] : "");

interface ChoiceProps {
  label: MessageKey;
  hint?: MessageKey;
  colour?: ColourId;
  isOn: boolean;
  isOff?: boolean;
  onPick(): void;
}

function Choice({ label, hint, colour, isOn, isOff = false, onPick }: ChoiceProps) {
  return (
    <button type="button" className={`${styles.choice} ${colourClass(colour)} ${isOn ? styles.on : ""}`} aria-pressed={isOn} aria-disabled={isOff} onClick={isOff ? undefined : onPick}>
      <span>{t(label)}</span>
      {isOn ? (
        <span className={styles.check} aria-hidden="true">
          ✓
        </span>
      ) : (
        colour && <span className={styles.dot} aria-hidden="true" />
      )}
      {hint && <small>{t(hint)}</small>}
    </button>
  );
}

function QuestionCard({ number, question, answers, note, children }: { number: number; question: Question; answers: Answers; note?: MessageKey; children: ReactNode }) {
  const isOpen = question !== "scope" || isScopeOpen(answers);
  const state = isAnswered(answers, question) ? styles.answered : isOpen ? styles.pending : "";
  const id = `help-lanes-q-${question}`;
  return (
    <div className={`${styles.question} ${state}`} role="group" aria-labelledby={id}>
      <div className={styles.questionHead}>
        <span className={styles.number} aria-hidden="true">
          {number}
        </span>
        <p id={id} className={styles.questionText}>
          {t(`help.lanes.q.${question}`)}
        </p>
        {note && <span className={styles.note}>{t(note)}</span>}
      </div>
      <div className={styles.choices}>{children}</div>
    </div>
  );
}

function Command({ command }: { command: string }) {
  return (
    <span>
      {splitPrompt(command).map((part, index) => (
        <span key={index} className={`${part.isOption ? styles.option : ""} ${part.isPlaceholder ? styles.placeholder : ""}`}>
          {part.text}
        </span>
      ))}
    </span>
  );
}

type CopyState = "idle" | "copied" | "blocked";

function Prompt({ prompt }: { prompt: LanePrompt }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = () => {
    void copyText(prompt.command).then((isDone) => {
      setState(isDone ? "copied" : "blocked");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState("idle"), 2000);
    });
  };
  return (
    <>
      {prompt.then && <span className={styles.then}>{t(prompt.then)}</span>}
      <div className={`${styles.prompt} ${colourClass(prompt.colour)}`}>
        <code className={styles.command}>
          <Command command={prompt.command} />
        </code>
        <Button size="sm" onClick={copy}>
          {state === "copied" ? <CheckIcon /> : <CopyIcon />}
          <span aria-live="polite">{t(state === "copied" ? "help.lanes.copied" : state === "blocked" ? "help.lanes.copyBlocked" : "help.lanes.copy")}</span>
        </Button>
      </div>
    </>
  );
}

function FlowTrack({ track }: { track: Track }) {
  return (
    <>
      <div className={`${styles.track} ${colourClass(track.colour)}`}>
        <h4 className={styles.trackTitle}>
          <span className={styles.dot} aria-hidden="true" />
          {t(track.name)}
        </h4>
        <ol className={styles.steps}>
          {track.steps.map((step) => (
            <li key={step.name} className={`${styles.step} ${styles[step.state]}`}>
              {step.loop && <span className={styles.loop}>{t("help.lanes.flow.loop")}</span>}
              <b>
                {step.state === "skip" && <span className={styles.srOnly}>{`${t("help.lanes.flow.skip")} : `}</span>}
                {t(step.name)}
              </b>
              <small>{t(step.hint)}</small>
              {step.code && <code>{step.code}</code>}
              {step.state === "you" && <span className={styles.tag}>{t("help.lanes.flow.youTag")}</span>}
            </li>
          ))}
        </ol>
      </div>
      {track.join && (
        <p className={`${styles.join} ${colourClass(track.colour)}`}>
          <span className={styles.joinArrow} aria-hidden="true">
            ↓
          </span>
          {t(track.join.text)}
          {track.join.code && <code className={styles.code}>{track.join.code}</code>}
        </p>
      )}
    </>
  );
}

function FlowMap({ result }: { result: LaneResult }) {
  return (
    <div className={styles.flowMap}>
      <div className={styles.flowHead}>
        <span>
          <b>{t("help.lanes.flow.title")}</b> {t("help.lanes.flow.intro")}
        </span>
        <span className={styles.legend}>
          <span>
            <i className={`${styles.swatch} ${styles.on} ${colourClass(result.lane)}`} />
            {t("help.lanes.flow.on")}
          </span>
          <span>
            <i className={`${styles.swatch} ${styles.skip}`} />
            {t("help.lanes.flow.skip")}
          </span>
          <span>
            <i className={`${styles.swatch} ${styles.you}`} />
            {t("help.lanes.flow.you")}
          </span>
        </span>
      </div>
      {result.tracks.map((track) => (
        <FlowTrack key={track.colour} track={track} />
      ))}
      <p className={styles.foot}>{t(result.foot)}</p>
    </div>
  );
}

function Unsure() {
  return (
    <span className={styles.unsure}>
      {t("help.lanes.unsure")} <code className={styles.code}>{t("help.lanes.cmd.pilot")}</code>
    </span>
  );
}

// help FR-21: the worktree option, under the lane picked.
function Worktree() {
  return (
    <p className={styles.worktree}>
      {t("help.lanes.worktree.before")} <code className={styles.code}>{t("help.options.worktree")}</code> {t("help.lanes.worktree.middle")}{" "}
      <code className={styles.code}>{t("help.options.autonomous")}</code>
      {t("help.lanes.worktree.after")}
    </p>
  );
}

function Result({ result }: { result: LaneResult }) {
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  return (
    <div className={`${styles.result} ${colourClass(result.lane)}`}>
      <div className={styles.resultHead}>
        <h3 className={styles.resultTitle}>
          <span className={styles.dot} aria-hidden="true" />
          {t(result.name)}
        </h3>
        {result.options.map((option) => (
          <span key={option.label} className={`${styles.chip} ${colourClass(option.colour)}`}>
            {option.label}
          </span>
        ))}
        <span className={styles.why}>
          {t("help.lanes.because")}{" "}
          {result.why.map((reason, index) => (
            <span key={reason}>
              {index > 0 && " · "}
              <b>{t(reason)}</b>
            </span>
          ))}
        </span>
      </div>
      {result.prompts.map((prompt) => (
        <Prompt key={prompt.command} prompt={prompt} />
      ))}
      <p className={styles.resultText}>{t(result.text)}</p>
      <div className={styles.resultFoot}>
        <button type="button" className={styles.flowToggle} aria-expanded={isFlowOpen} onClick={() => setIsFlowOpen(!isFlowOpen)}>
          <span className={`${styles.chevron} ${isFlowOpen ? styles.open : ""}`}>
            <ChevronDownIcon />
          </span>
          {t(isFlowOpen ? "help.lanes.flow.hide" : "help.lanes.flow.show")}
        </button>
        {!result.isPilotWith && <Unsure />}
      </div>
      {isFlowOpen && <FlowMap result={result} />}
    </div>
  );
}

const previews: { value: Preview; label: MessageKey; colour?: ColourId }[] = [
  { value: "direct", label: "help.lanes.preview.direct" },
  { value: "mockup", label: "help.lanes.preview.mockup", colour: "mockup" },
  { value: "iterate", label: "help.lanes.preview.iterate", colour: "iterate" },
];

// help FR-02, FR-03, FR-20, FR-21: three questions, the lane they pick with its prompts to copy, its flow on demand, the worktree option.
export function LaneChooser() {
  const [answers, setAnswers] = useState<Answers>({});
  const pick = (patch: Answers) => setAnswers((current) => answer(current, patch));
  const result = laneFor(answers);
  const isScopeOn = isScopeOpen(answers);
  return (
    <>
      <div className={styles.chooser} role="group" aria-label={t("help.lanes.label")}>
        <QuestionCard number={1} question="stay" answers={answers}>
          <Choice label="help.lanes.stay.stay" hint="help.lanes.stay.stayHint" isOn={answers.stay === "stay"} onPick={() => pick({ stay: "stay" })} />
          <Choice label="help.lanes.stay.leave" hint="help.lanes.stay.leaveHint" colour="pilot" isOn={answers.stay === "leave"} onPick={() => pick({ stay: "leave" })} />
        </QuestionCard>
        <QuestionCard number={2} question="scope" answers={answers} note={isScopeOn ? undefined : "help.lanes.q.seloPicks"}>
          <Choice label="help.lanes.scope.page" hint="help.lanes.scope.pageHint" colour="fastlane" isOn={isScopeOn && answers.scope === "page"} isOff={!isScopeOn} onPick={() => pick({ scope: "page" })} />
          <Choice label="help.lanes.scope.new" hint="help.lanes.scope.newHint" colour="blueprint" isOn={isScopeOn && answers.scope === "new"} isOff={!isScopeOn} onPick={() => pick({ scope: "new" })} />
          <Choice label="help.lanes.scope.unsure" hint="help.lanes.scope.unsureHint" colour="pilot" isOn={isScopeOn && answers.scope === "unsure"} isOff={!isScopeOn} onPick={() => pick({ scope: "unsure" })} />
        </QuestionCard>
        <QuestionCard number={3} question="preview" answers={answers}>
          {previews.map((preview) => (
            <Choice
              key={preview.value}
              label={preview.label}
              hint={previewHint(answers, preview.value)}
              colour={preview.colour}
              isOn={answers.preview === preview.value}
              isOff={!isPreviewAllowed(answers, preview.value)}
              onPick={() => pick({ preview: preview.value })}
            />
          ))}
        </QuestionCard>
      </div>
      {result ? (
        <>
          <Result result={result} />
          <Worktree />
        </>
      ) : (
        <>
          <p className={styles.empty}>{t("help.lanes.empty")}</p>
          <div className={styles.emptyFoot}>
            <Unsure />
          </div>
        </>
      )}
    </>
  );
}
