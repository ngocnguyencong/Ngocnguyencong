import { AlertTriangle, CheckCircle2, Circle, FlaskConical } from "lucide-react";

import { SetupCopyButton } from "./setup-copy-button";
import styles from "./setup-page.module.css";
import type { SetupCheck, SetupCheckGroup, SetupReport } from "./setup-readiness";

const GROUP_TITLES: Readonly<Record<SetupCheckGroup, string>> = {
  accounts: "Accounts",
  foundation: "Foundation",
  platforms: "Platforms",
  product: "Product",
  providers: "Providers",
};

const GROUP_ORDER: readonly SetupCheckGroup[] = [
  "foundation",
  "accounts",
  "providers",
  "product",
  "platforms",
];

const STATUS_LABEL: Readonly<Record<SetupCheck["status"], string>> = {
  action: "Needs action",
  demo: "Demo mode",
  optional: "Optional",
  ready: "Ready",
};

function StatusIcon({ status }: { status: SetupCheck["status"] }) {
  const icon = {
    action: <AlertTriangle aria-hidden className={styles.iconAction} size={16} />,
    demo: <FlaskConical aria-hidden className={styles.iconDemo} size={16} />,
    optional: <Circle aria-hidden className={styles.iconOptional} size={16} />,
    ready: <CheckCircle2 aria-hidden className={styles.iconReady} size={16} />,
  }[status];
  return (
    <span className={styles.statusIcon}>
      {icon}
      <span className="visually-hidden">{STATUS_LABEL[status]}</span>
    </span>
  );
}

function CheckRow({ check }: { check: SetupCheck }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <StatusIcon status={check.status} />
        <div>
          <p className={styles.rowLabel}>{check.label}</p>
          <p className={styles.rowDetail}>{check.detail}</p>
          {check.fix ? (
            <div className={styles.fixLine}>
              {check.fix.env?.map((name) => (
                <code className={styles.fixCode} key={name}>
                  {name}
                </code>
              ))}
              {check.fix.file ? <code className={styles.fixCode}>{check.fix.file}</code> : null}
              {check.fix.command ? (
                <span className={styles.commandWrap}>
                  <code className={styles.fixCode}>{check.fix.command}</code>
                  <SetupCopyButton text={check.fix.command} />
                </span>
              ) : null}
              {check.fix.docHref ? (
                <a className={styles.docLink} href={check.fix.docHref}>
                  Guide
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * The `/setup` checklist body — summary counts + progress meter, then one
 * section per group. Server-rendered; the only client island is the Copy
 * button on fix commands.
 */
export function SetupReportView({ report }: { report: SetupReport }) {
  const { counts, checks } = report;
  const scored = counts.ready + counts.action + counts.demo;
  const percent = scored === 0 ? 100 : Math.round((counts.ready / scored) * 100);

  return (
    <>
      <header className="screen-intro">
        <p className="eyebrow">Deployment readiness</p>
        <h1>Setup</h1>
        <p className="header-subtitle">
          What is configured, what runs in demo mode, and what to do next.
        </p>
      </header>

      <section className={styles.summary} aria-label="Setup summary">
        <p className={styles.summaryLine}>
          {counts.ready} ready · {counts.action} need action · {counts.demo} in demo mode ·{" "}
          {counts.optional} optional
        </p>
        <div className={styles.meterRow}>
          <div
            aria-label="Setup progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className={styles.track}
            role="meter"
          >
            <div className={styles.fill} style={{ width: `${percent}%` }} />
          </div>
          <span className={styles.meterPercent}>{percent}%</span>
        </div>
        <p className="quiet-note">
          {report.readyForProduction
            ? "Nothing blocks a production deploy."
            : "Resolve the action items before a production deploy."}
        </p>
      </section>

      {GROUP_ORDER.map((group) => {
        const groupChecks = checks.filter((check) => check.group === group);
        if (groupChecks.length === 0) {
          return null;
        }
        return (
          <section className={styles.group} key={group}>
            <h2 className={styles.groupTitle}>{GROUP_TITLES[group]}</h2>
            <ul className={styles.checkList}>
              {groupChecks.map((check) => (
                <CheckRow check={check} key={check.id} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
