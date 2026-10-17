import { Skeleton } from "../../src/kit/blocks/app/skeleton";
import styles from "../../src/supadata/web/dashboard.module.css";

/** Route-level loading state — keeps the page structure visible while the
 *  dashboard queries resolve (period/tab navigation is a full server render). */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" className={styles.loading}>
      <div className={styles.loadingStats}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} width="100%" />
        ))}
      </div>
      <Skeleton className={styles.loadingChart} width="100%" />
      <div className={styles.loadingPanels}>
        <Skeleton width="100%" />
        <Skeleton width="100%" />
      </div>
    </div>
  );
}
