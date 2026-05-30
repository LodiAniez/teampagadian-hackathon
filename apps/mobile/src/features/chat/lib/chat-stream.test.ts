import { describe, expect, it } from "vitest";
import { initialStreamState, parseSseChunk, reduceChunk } from "./chat-stream";

function frame(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

describe("parseSseChunk", () => {
  it("parses a single complete text-delta frame", () => {
    const { events, rest } = parseSseChunk(frame({ type: "text-delta", id: "1", delta: "Hello" }));
    expect(events).toEqual([{ type: "text-delta", delta: "Hello" }]);
    expect(rest).toBe("");
  });

  it("parses multiple frames in one buffer", () => {
    const buffer =
      frame({ type: "text-delta", delta: "Hi " }) + frame({ type: "text-delta", delta: "there" });
    const { events } = parseSseChunk(buffer);
    expect(events).toEqual([
      { type: "text-delta", delta: "Hi " },
      { type: "text-delta", delta: "there" },
    ]);
  });

  it("returns an incomplete trailing frame as rest and emits the complete one", () => {
    const buffer = frame({ type: "text-delta", delta: "Hi" }) + `data: {"type":"text-de`;
    const { events, rest } = parseSseChunk(buffer);
    expect(events).toEqual([{ type: "text-delta", delta: "Hi" }]);
    expect(rest).toBe(`data: {"type":"text-de`);
  });

  it("ignores the [DONE] sentinel", () => {
    const { events, rest } = parseSseChunk(`data: [DONE]\n\n`);
    expect(events).toEqual([]);
    expect(rest).toBe("");
  });

  it("maps tool-input and tool-output frames", () => {
    const buffer =
      frame({
        type: "tool-input-available",
        toolCallId: "t1",
        toolName: "query_earnings",
        input: {},
      }) + frame({ type: "tool-output-available", toolCallId: "t1", output: { totalPhp: 5 } });
    const { events } = parseSseChunk(buffer);
    expect(events).toEqual([
      { type: "tool-input", toolCallId: "t1", toolName: "query_earnings" },
      { type: "tool-output", toolCallId: "t1", output: { totalPhp: 5 } },
    ]);
  });

  it("maps an error frame", () => {
    const { events } = parseSseChunk(frame({ type: "error", errorText: "boom" }));
    expect(events).toEqual([{ type: "error", errorText: "boom" }]);
  });

  it("drops unrecognized chunk types without losing framing", () => {
    const buffer =
      frame({ type: "start" }) +
      frame({ type: "text-delta", delta: "x" }) +
      frame({ type: "finish" });
    const { events } = parseSseChunk(buffer);
    expect(events).toEqual([{ type: "text-delta", delta: "x" }]);
  });
});

describe("reduceChunk", () => {
  it("accumulates text deltas in order", () => {
    let state = initialStreamState();
    state = reduceChunk(state, { type: "text-delta", delta: "Hello " });
    state = reduceChunk(state, { type: "text-delta", delta: "world" });
    expect(state.text).toBe("Hello world");
  });

  it("attaches a tool output to the tool name from its earlier input chunk", () => {
    let state = initialStreamState();
    state = reduceChunk(state, {
      type: "tool-input",
      toolCallId: "t1",
      toolName: "get_client_summary",
    });
    state = reduceChunk(state, { type: "tool-output", toolCallId: "t1", output: { name: "Acme" } });
    expect(state.toolResults).toEqual([
      { toolCallId: "t1", toolName: "get_client_summary", output: { name: "Acme" } },
    ]);
  });

  it("records an error", () => {
    const state = reduceChunk(initialStreamState(), { type: "error", errorText: "nope" });
    expect(state.error).toBe("nope");
  });

  it("does not mutate the previous state object", () => {
    const a = initialStreamState();
    const b = reduceChunk(a, { type: "text-delta", delta: "x" });
    expect(a.text).toBe("");
    expect(b).not.toBe(a);
  });
});
