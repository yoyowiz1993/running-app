import { describe, expect, it } from 'vitest'
import {
  clampPace,
  formatPace,
  parsePaceToSecPerKm,
  secPerKmToKmh,
} from './pace'

describe('pace', () => {
  describe('parsePaceToSecPerKm', () => {
    it('parses mm:ss format', () => {
      expect(parsePaceToSecPerKm('5:00')).toBe(300)
      expect(parsePaceToSecPerKm('4:30')).toBe(270)
      expect(parsePaceToSecPerKm('6:00')).toBe(360)
    })
    it('parses single-digit minutes', () => {
      expect(parsePaceToSecPerKm('9:45')).toBe(585)
    })
  })

  describe('formatPace', () => {
    it('formats secPerKm to mm:ss/km', () => {
      expect(formatPace(300)).toBe('5:00/km')
      expect(formatPace(270)).toBe('4:30/km')
    })
  })

  describe('secPerKmToKmh', () => {
    it('converts pace to speed', () => {
      expect(secPerKmToKmh(300)).toBe(12)
      expect(secPerKmToKmh(360)).toBe(10)
    })
  })

  describe('clampPace', () => {
    it('clamps between 120 and 720', () => {
      expect(clampPace(100)).toBe(120)
      expect(clampPace(800)).toBe(720)
      expect(clampPace(300)).toBe(300)
    })
  })
})
