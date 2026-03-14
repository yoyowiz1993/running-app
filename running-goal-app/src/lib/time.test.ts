import { describe, expect, it } from 'vitest'
import { formatClock, formatDurationShort } from './time'

describe('time', () => {
  describe('formatClock', () => {
    it('formats seconds as mm:ss', () => {
      expect(formatClock(90)).toBe('1:30')
      expect(formatClock(65)).toBe('1:05')
    })
    it('formats hours', () => {
      expect(formatClock(3665)).toBe('1:01:05')
    })
  })

  describe('formatDurationShort', () => {
    it('formats minutes only', () => {
      expect(formatDurationShort(90)).toBe('2m')
    })
    it('formats hours', () => {
      expect(formatDurationShort(3600)).toBe('1h')
    })
  })
})
