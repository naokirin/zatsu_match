import { ConfigError, SlackError, ValidationError } from "./errors";

describe("Custom Errors", () => {
  describe("SlackError", () => {
    it("should create error with default status code", () => {
      const error = new SlackError("test message");
      expect(error.message).toBe("test message");
      expect(error.statusCode).toBe(500);
      expect(error.details).toBeUndefined();
    });

    it("should create error with custom status code", () => {
      const error = new SlackError("test message", 400);
      expect(error.message).toBe("test message");
      expect(error.statusCode).toBe(400);
      expect(error.details).toBeUndefined();
    });

    it("should create error with details", () => {
      const details = { field: "test", value: "invalid" };
      const error = new SlackError("test message", 400, details);
      expect(error.message).toBe("test message");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
    });
  });

  describe("ValidationError", () => {
    it("should create validation error", () => {
      const error = new ValidationError("test message");
      expect(error.message).toBe("test message");
      expect(error.statusCode).toBe(400);
      expect(error.details).toBeUndefined();
    });

    it("should create validation error with details", () => {
      const details = { field: "test", value: "invalid" };
      const error = new ValidationError("test message", details);
      expect(error.message).toBe("test message");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
    });
  });

  describe("ConfigError", () => {
    it("should create config error with empty errors array", () => {
      const error = new ConfigError([]);
      expect(error.message).toBe("Configuration validation failed");
      expect(error.statusCode).toBe(500);
      expect(error.errors).toEqual([]);
    });

    it("should create config error with validation errors", () => {
      const errors = [
        { field: "SLACK_BOT_TOKEN", message: "Slack bot token is required" },
      ];
      const error = new ConfigError(errors);
      expect(error.message).toBe("Configuration validation failed");
      expect(error.statusCode).toBe(500);
      expect(error.errors).toEqual(errors);
    });

    it("should format error message with details", () => {
      const errors = [
        { field: "SLACK_BOT_TOKEN", message: "Slack bot token is required" },
      ];
      const error = new ConfigError(errors);
      expect(error.toString()).toBe(
        "Configuration validation failed: SLACK_BOT_TOKEN - Slack bot token is required",
      );
    });
  });
});
