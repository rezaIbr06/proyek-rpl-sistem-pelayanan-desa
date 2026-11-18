/** @type {import("jest").Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          paths: { "@/*": ["./src/*"] },
        },
      },
    ],
  },
  // Jangan kirim pesan asli saat test
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
}

module.exports = config
