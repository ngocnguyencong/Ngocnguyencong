# resource-shell.tsx

## Purpose

Shared public reading shell for docs/blog/legal/resource pages, retaining the existing marketing header/footer, classes and theme attributes.

## Locale support

Passes the request locale to the existing header, translates the skip link, declares the content language on the wrapper, mounts `LocaleHtmlLang` so `<html lang>` syncs post-hydration (the root layout owns `lang="en"`; a no-op for English), and forwards `locale` to `SiteFooter` (the footer controls row localizes its theme-menu label from it). Layout, styles and footer structure are unchanged. Blog defaults stay English.
