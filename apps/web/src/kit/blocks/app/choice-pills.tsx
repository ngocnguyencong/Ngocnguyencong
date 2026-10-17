import styles from "./choice-pills.module.css";

export type ChoicePillsOption = {
  value: string;
  label: string;
};

/**
 * Kit block — single-choice group rendered as equal-width pills.
 * Real <fieldset>/<legend> semantics; works uncontrolled (no state needed)
 * or controlled via `value` + `onChange`.
 */
export function ChoicePills({
  legend,
  name,
  options,
  value,
  defaultValue,
  onChange,
}: {
  /** Group label rendered as the fieldset legend. */
  legend: string;
  name: string;
  options: readonly ChoicePillsOption[];
  /** Controlled selection — pair with `onChange`. */
  value?: string | undefined;
  /** Initial selection for uncontrolled usage (no React state needed). */
  defaultValue?: string | undefined;
  onChange?: ((value: string) => void) | undefined;
}) {
  return (
    <fieldset className={styles.root}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label className={styles.option} key={option.value}>
            <input
              checked={value === undefined ? undefined : value === option.value}
              className={styles.input}
              defaultChecked={value === undefined ? option.value === defaultValue : undefined}
              name={name}
              onChange={onChange === undefined ? undefined : () => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span className={styles.pill}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
