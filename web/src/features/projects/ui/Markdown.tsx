import { useMemo } from "react";
import { Checkbox } from "../../../shared/ui/Checkbox.tsx";
import { parseInline, parseMarkdown, type Inline } from "./markdown.ts";
import styles from "./Markdown.module.css";

// projects FR-13: a planning file formatted, from its parsed blocks only (no HTML injected).
export function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "code" ? <code key={i}>{p.text}</code> : p.kind === "bold" ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}

// One line of Markdown, as a delta line or a decision is written.
export function InlineMarkdown({ text }: { text: string }) {
  return <InlineText parts={parseInline(text)} />;
}

export function Markdown({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <div className={styles.markdown}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading": {
            const Tag = (`h${Math.min(6, b.level + 2)}` as "h3");
            return (
              <Tag key={i} className={styles[`h${Math.min(3, b.level)}`]}>
                <InlineText parts={b.inline} />
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={i}>
                <InlineText parts={b.inline} />
              </p>
            );
          case "list": {
            const List = b.ordered ? "ol" : "ul";
            return (
              <List key={i} className={styles.list}>
                {b.items.map((item, j) => (
                  <li key={j} className={item.checked === null ? "" : styles.task} style={item.depth > 0 ? { marginLeft: `${item.depth * 18}px` } : undefined}>
                    {item.checked !== null && (
                      <span className={styles.box}>
                        <Checkbox checked={item.checked} readOnly tabIndex={-1} />
                      </span>
                    )}
                    <span>
                      <InlineText parts={item.inline} />
                    </span>
                  </li>
                ))}
              </List>
            );
          }
          case "table":
            return (
              <div key={i} className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      {b.head.map((cell, j) => (
                        <th key={j}>
                          <InlineText parts={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k}>
                            <InlineText parts={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            return (
              <pre key={i} className={styles.pre}>
                <code>{b.text}</code>
              </pre>
            );
          case "rule":
            return <hr key={i} className={styles.rule} />;
        }
      })}
    </div>
  );
}
