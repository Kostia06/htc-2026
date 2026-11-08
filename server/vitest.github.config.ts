import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/integrations/github.test.ts"],
        environment: "node",
        pool: "forks",
    },
});