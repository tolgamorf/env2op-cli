import { afterEach, mock } from "bun:test";

// Restore all mocks after each test to ensure test isolation
afterEach(() => {
    mock.restore();
});
