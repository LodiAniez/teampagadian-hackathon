import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResendCooldown } from "./use-resend-cooldown";

describe("useResendCooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts ready (remaining=0, isReady=true)", () => {
    const { result } = renderHook(() => useResendCooldown(30));

    expect(result.current.remaining).toBe(0);
    expect(result.current.isReady).toBe(true);
  });

  it("counts down from 30 to 0 after start()", () => {
    const { result } = renderHook(() => useResendCooldown(30));

    act(() => result.current.start());

    expect(result.current.remaining).toBe(30);
    expect(result.current.isReady).toBe(false);

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(result.current.remaining).toBe(15);

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(result.current.remaining).toBe(0);
    expect(result.current.isReady).toBe(true);
  });
});
