import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: { "^.+\\.(t|j)s$": "ts-jest" },
  collectCoverageFrom: [
    "**/*.ts",
    "!**/*.spec.ts",
    "!**/*.d.ts",
    "!main.ts",
    "!**/*.module.ts",
    // OTel init runs as a side effect on import. Exercising it in a unit
    // test would require standing up an OTel collector; the production
    // path is integration-only. Excluded from coverage to keep the 80%
    // threshold meaningful on code we actually unit-test.
    "!infra/otel/**",
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};

export default config;
