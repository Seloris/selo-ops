import { describe, expect, it } from "vitest";
import { readConfig } from "../../src/config.js";

describe("readConfig", () => {
  it("listens on the loopback address by default", () => {
    // Act
    const config = readConfig({});

    // Assert
    expect(config.API_HOST).toBe("127.0.0.1");
  });

  it("takes the address from API_HOST", () => {
    // Act
    const config = readConfig({ API_HOST: "0.0.0.0" });

    // Assert
    expect(config.API_HOST).toBe("0.0.0.0");
  });

  it("starts `claude` from the PATH unless CLAUDE_BIN names the executable", () => {
    // Act
    const byDefault = readConfig({});
    const named = readConfig({ CLAUDE_BIN: "C:/tools/claude.exe" });

    // Assert
    expect(byDefault.CLAUDE_BIN).toBe("claude");
    expect(named.CLAUDE_BIN).toBe("C:/tools/claude.exe");
  });
});
