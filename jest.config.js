module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  reporters: [
    "default",
    [
      "jest-html-reporters",
      {
        outputPath: "jest_html_reporters.html",
        includeConsoleLog: true,
      },
    ],
  ],
};
