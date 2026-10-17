"use client";
import { useState } from "react";
import type { AppLocale } from "@supastack/i18n";
import { Dialog, Select } from "../ui/primitives";
import { copyForLocale } from "../ui/ui-copy";
import { FoundationPreview } from "./foundation-preview";

export const KIT_UI_GALLERY_SECTIONS = ["buttons", "inputs", "cards", "badges", "dialogs"] as const;
export type KitUiGallerySectionId = (typeof KIT_UI_GALLERY_SECTIONS)[number];

export function KitUiGallery({ locale = "en" }: { locale?: AppLocale | undefined }) {
  const copy = copyForLocale(locale).gallery;
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <section aria-label={copy.title} className="kit-ui-gallery">
      <header className="kit-ui-gallery-intro">
        <h3>{copy.title}</h3>
        <p className="quiet-note">{copy.description}</p>
      </header>
      {KIT_UI_GALLERY_SECTIONS.map((section) => (
        <article className="kit-ui-gallery-section" data-gallery-section={section} key={section}>
          <div className="kit-ui-gallery-section-copy">
            <h4>{copy[section]}</h4>
          </div>
          <div className="kit-ui-gallery-demo">
            {section === "buttons" ? (
              <div className="kit-ui-gallery-row">
                <button className="button button-primary" type="button">
                  {copy.primary}
                </button>
                <button className="button button-secondary" type="button">
                  {copy.secondary}
                </button>
                <button className="button" type="button" disabled>
                  {copy.disabled}
                </button>
              </div>
            ) : null}
            {section === "inputs" ? (
              <form
                className="auth-form kit-ui-gallery-form"
                onSubmit={(event) => event.preventDefault()}
              >
                <label htmlFor="kit-gallery-name">{copy.displayName}</label>
                <input
                  id="kit-gallery-name"
                  name="kit-gallery-name"
                  defaultValue="Builder"
                  autoComplete="off"
                  type="text"
                />
                <label htmlFor="kit-gallery-plan">{copy.plan}</label>
                <span className="select">
                  <Select id="kit-gallery-plan" name="kit-gallery-plan" defaultValue="pro">
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="scale">Scale</option>
                  </Select>
                </span>
                <label htmlFor="kit-gallery-notes">{copy.notes}</label>
                <textarea id="kit-gallery-notes" name="kit-gallery-notes" rows={3} />
                <fieldset className="kit-ui-gallery-choice">
                  <legend>{copy.workspaceType}</legend>
                  <label>
                    <input type="radio" name="kit-gallery-kind" defaultChecked value="personal" />{" "}
                    {copy.personal}
                  </label>
                  <label>
                    <input type="radio" name="kit-gallery-kind" value="team" /> {copy.team}
                  </label>
                </fieldset>
                <label>
                  <input type="checkbox" defaultChecked name="kit-gallery-alerts" /> {copy.alerts}
                </label>
                <label>
                  <input
                    className="toggle"
                    type="checkbox"
                    defaultChecked
                    name="kit-gallery-updates"
                  />{" "}
                  {copy.summary}
                </label>
              </form>
            ) : null}
            {section === "cards" ? (
              <div className="kit-ui-gallery-card-grid">
                <article className="empty-card">
                  <strong>{copy.workspaceCard}</strong>
                  <p className="quiet-note">{copy.cardDetail}</p>
                </article>
                <article className="empty-card">
                  <strong>{copy.empty}</strong>
                  <p className="quiet-note">{copy.cardDetail}</p>
                </article>
              </div>
            ) : null}
            {section === "badges" ? (
              <div className="kit-ui-gallery-row">
                {(["success", "warning", "danger", "info"] as const).map((kind) => (
                  <span className={`status-badge status-badge-${kind}`} key={kind}>
                    {copy[kind]}
                  </span>
                ))}
              </div>
            ) : null}
            {section === "dialogs" ? (
              <>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setDialogOpen(true)}
                >
                  {copy.openDialog}
                </button>
                <Dialog
                  open={dialogOpen}
                  onOpenChange={setDialogOpen}
                  title={copy.sampleDialog}
                  closeLabel={copy.close}
                >
                  <p>{copy.dialogDescription}</p>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => setDialogOpen(false)}
                  >
                    {copy.close}
                  </button>
                </Dialog>
              </>
            ) : null}
          </div>
        </article>
      ))}
      <FoundationPreview locale={locale} />
    </section>
  );
}
