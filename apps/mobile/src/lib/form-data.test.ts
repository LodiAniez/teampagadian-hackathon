import { describe, expect, it, vi } from "vitest";
import { appendFile } from "./form-data";

// The runtime behaviour (file object → multipart boundary) is React Native's
// FormData implementation, not testable in a Node env where the standard
// FormData stringifies the object. Instead we verify the call signature: that
// appendFile invokes FormData.append(name, { uri, name, type }) exactly. The
// shape is what RN's FormData reads to build the multipart body — if this
// signature is right on the call site, it works on device.
describe("appendFile", () => {
  it("calls FormData.append with the field name and { uri, name, type }", () => {
    const form = new FormData();
    const appendSpy = vi.spyOn(form, "append");

    appendFile(form, "file", {
      uri: "file:///tmp/quotation.pdf",
      name: "quotation.pdf",
      mimeType: "application/pdf",
    });

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith("file", {
      uri: "file:///tmp/quotation.pdf",
      name: "quotation.pdf",
      type: "application/pdf",
    });
  });

  it("renames mimeType (contract field) to type (RN convention) when calling append", () => {
    const form = new FormData();
    const appendSpy = vi.spyOn(form, "append");

    appendFile(form, "f", { uri: "file:///x.png", name: "x.png", mimeType: "image/png" });

    expect(appendSpy.mock.calls[0][1]).toEqual({
      uri: "file:///x.png",
      name: "x.png",
      type: "image/png",
    });
  });

  it("supports each allowed quotation MIME type", () => {
    const form = new FormData();
    const appendSpy = vi.spyOn(form, "append");

    appendFile(form, "pdf", { uri: "u1", name: "a.pdf", mimeType: "application/pdf" });
    appendFile(form, "png", { uri: "u2", name: "a.png", mimeType: "image/png" });
    appendFile(form, "jpg", { uri: "u3", name: "a.jpg", mimeType: "image/jpeg" });

    expect(appendSpy.mock.calls[0][1]).toMatchObject({ type: "application/pdf" });
    expect(appendSpy.mock.calls[1][1]).toMatchObject({ type: "image/png" });
    expect(appendSpy.mock.calls[2][1]).toMatchObject({ type: "image/jpeg" });
  });
});
