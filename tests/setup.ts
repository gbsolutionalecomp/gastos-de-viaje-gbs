import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock global fetch if needed
if (!global.fetch) {
  global.fetch = vi.fn()
}
