# app/kit-blocks/page.tsx

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose（一句话人话）

dev-only kit block 浏览页 —— 遍历 `KIT_BLOCKS`，营销块套
`.marketing-theme` 包裹器渲染真实示例（生产环境 404）。

## Important Notes

- `testimonial-grid` previews a complete, generic four-card section with a heading, avatar slots, and varied ratings. Its example quotes are clearly labeled as sample content. The marketing cell inherits visitor style axes.

- 每注册一个 block 要在这里加示例分支（`block.id === "…"`）。
- `feature-tabs` demo (2026-10-10): three neutral capability tabs with
  lucide element icons; no `media` — panels show the block's ProductFrame
  placeholder default.
- `waitlist-band` 示例用静态 props 展示 status + shareUrl 两态。
- `otp-input` 示例用非受控模式（`label` 即可），保证 server component
  传入的 props 可序列化。
- `paywall-gate` 示例展示完整形态：faded `preview` + `title` + `excerpt` +
  `requiredTier="Pro"` + 升级 `cta`（app surface，`styles.blockPad`）。
- data-viz 示例（2026-09-27）：`chart-line`（marketing，两张并排——
  `tone="primary"` 周注册 + `tone="muted"` 回访）+
  `data-viz-bars`/`data-viz-donut`（app，`blockPad`，每日注册柱状 +
  渠道占比环形 4 slice）+ `metric-trend`（app，4 张卡片 auto-fit 网格行；
  Latency 卡演示 `direction:"down"` + `tone:"positive"` 下降即利好，
  Churn rate 卡演示 `direction:"flat"` 中性 Minus 芯片 + 持平 sparkline）。
- Foundation blocks preview: one localized `FoundationPreview` composes
  `TableToolbar`, `Pagination`, and `MasterDetail` with generic local records;
  search/status controls filter rows, paging changes visible records, and
  selection opens details with the narrow Back/focus-return behavior. Its state
  disclosure demonstrates ready/loading/empty/error/disabled, while the shared
  Popover, Dialog, and Sheet remain interactive.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-10 | +feature-tabs demo (marketing: 3-tab neutral capability tour, default ProductFrame media) | Devin |
| 2026-10-09 | +scroll-end-cta demo (marketing, `preview` inline panel — the real dialog only opens on scroll-end/dwell); site-footer demo passes real ThemeMenu+LanguageSwitcher into the new `controls` slot | Devin |
| 2026-10-06 | +localized interactive foundation preview for controlled app record blocks | Codex |
| 2026-09-27 | metric-trend demo += 4th card — `direction:"flat"` neutral chip (Churn rate, level points exercise the range===0 mid-height sparkline) | Devin |
| 2026-09-27 | +data-viz demos: chart-line (marketing), data-viz-bars + data-viz-donut + metric-trend (app, 3-card grid row) | Devin |
| 2026-09-27 | +paywall-gate demo (app surface: preview + title + excerpt + requiredTier + cta) | Devin |
| 2026-09-24 | +minimal style: "Minimal style" composed landing section (`MinimalShowcase` in `minimal-showcase.tsx`, `.marketing-theme` + `data-theme="minimal"` wrapper) + per-block demos via `MINIMAL_DEMOS[id]` | Devin |
| 2026-09-23 | +otp-input demo (app surface, uncontrolled + `label`) | Devin |
| 2026-09-23 | +changelog-timeline demo (upcoming roadmap entry + two shipped entries) | Devin |
| 2026-09-22 | +waitlist-band 示例 | Devin |
| 2026-09-23 | +tooltip demo (app surface) | Devin |
| 2026-09-23 | +ambient-background demo (canvas kinds grid) | Devin |
| 2026-10-16 | stat-grid demo shows delta chips | Devin |
