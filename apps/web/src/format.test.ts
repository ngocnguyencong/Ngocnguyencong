import { describe, expect, it } from "vitest";

import { formatTemplate, splitTemplate } from "./format";

describe("formatTemplate", () => {
  it("interpolates own-property placeholders and leaves unknown ones intact", () => {
    expect(formatTemplate("Hi {name}, you are {n} of {total}", { name: "Ada", n: 2 })).toBe(
      "Hi Ada, you are 2 of {total}",
    );
  });

  it("does not substitute inherited Object.prototype members", () => {
    // `key in vars` would resolve "toString" via the prototype chain and leak
    // the function source into the copy — only own properties may substitute.
    expect(formatTemplate("{toString}", {})).toBe("{toString}");
    expect(formatTemplate("{hasOwnProperty} {constructor}", {})).toBe(
      "{hasOwnProperty} {constructor}",
    );
    expect(formatTemplate("{toString}", { toString: "custom" })).toBe("custom");
  });
});

describe("splitTemplate", () => {
  it("splits around the placeholder and passes templates without it through", () => {
    expect(splitTemplate("Set {setting} to enable them.", "setting")).toEqual([
      "Set ",
      " to enable them.",
    ]);
    expect(splitTemplate("No slot here.", "setting")).toEqual(["No slot here.", ""]);
  });
});
