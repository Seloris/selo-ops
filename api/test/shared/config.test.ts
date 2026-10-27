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
});
