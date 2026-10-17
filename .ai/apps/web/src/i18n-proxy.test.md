# src/i18n-proxy.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

`proxy.ts` 契约测试 —— locale 解析顺序、`/en` 前缀归一化、cookie/header
回写，以及 growth 参数（`?ref=`/`?invite=`）落 httpOnly cookie、非法值不落。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | +growth cookie 捕获断言 | Devin |
