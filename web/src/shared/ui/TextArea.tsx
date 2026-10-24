import type { ComponentProps } from "react";
import inputStyles from "./TextInput.module.css";
import styles from "./TextArea.module.css";

// The text field's recipe, on several lines.
export function TextArea(props: Omit<ComponentProps<"textarea">, "className">) {
  return <textarea className={`${inputStyles.input} ${styles.area}`} {...props} />;
}
