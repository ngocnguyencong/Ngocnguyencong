import { describe, expect, it } from "vitest";

import { KIT_UI_GALLERY_SECTIONS } from "./kit-ui-gallery.js";

describe("kit UI gallery catalog", () => {
  it("lists the kit surfaces builders need to preview under app-theme", () => {
    expect(KIT_UI_GALLERY_SECTIONS).toEqual(["buttons", "inputs", "cards", "badges", "dialogs"]);
  });
});
