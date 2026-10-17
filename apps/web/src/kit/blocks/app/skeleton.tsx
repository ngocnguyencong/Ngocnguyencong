import type { CSSProperties } from "react";
import styles from "./skeleton.module.css";

/** Kit block — shimmering placeholder bar for loading states. */
export function Skeleton({
  width,
  height,
  radius,
  className,
}: {
  /** CSS length (e.g. "60%", 120, "8rem"). Numbers become px. */
  width?: CSSProperties["width"];
  /** CSS length (e.g. "44px", 44). Numbers become px. */
  height?: CSSProperties["height"];
  /** Corner radius override; defaults to --radius-control. */
  radius?: CSSProperties["borderRadius"];
  className?: string | undefined;
}) {
  const style: CSSProperties = {
    borderRadius: radius,
    height,
    width,
  };
  return (
    <span
      aria-hidden="true"
      className={`${styles.skeleton} ${className ?? ""}`.trim()}
      style={style}
    />
  );
}
