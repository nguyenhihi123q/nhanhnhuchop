import { defineConfig } from 'vitest/config';

// Cấu hình riêng cho kiểm thử (vitest) — tách khỏi vite.config.ts để tránh
// xung đột type do vitest ghim một bản vite riêng.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});