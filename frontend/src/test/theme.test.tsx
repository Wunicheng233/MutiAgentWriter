import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Theme System', () => {
  it('should define all required CSS variables for Warm Parchment theme', () => {
    const cssPath = path.resolve(__dirname, '../index.css')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    const vars = [
      '--bg-primary', '--bg-secondary', '--bg-tertiary',
      '--text-primary', '--text-body', '--text-secondary', '--text-muted',
      '--accent-primary', '--accent-warm', '--accent-soft', '--accent-gold',
      '--on-accent', '--badge-warning-bg', '--badge-warning-text',
      '--border-default', '--border-strong', '--border-subtle',
      '--shadow-subtle', '--shadow-default', '--shadow-elevated'
    ]

    vars.forEach(v => {
      expect(cssContent).toContain(v)
    })
  })

  it('should define all three themes', () => {
    const cssPath = path.resolve(__dirname, '../index.css')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    expect(cssContent).toContain('Warm Parchment')
    expect(cssContent).toContain('Clean Light')
    expect(cssContent).toContain('Deep Dark')
    expect(cssContent).toContain('[data-theme="clean-light"]')
    expect(cssContent).toContain('[data-theme="deep-dark"]')
  })

  it('defines theme-specific badge colors for non-default themes', () => {
    const cssPath = path.resolve(__dirname, '../index.css')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')
    const cleanLightBlock = cssContent.slice(
      cssContent.indexOf('[data-theme="clean-light"]'),
      cssContent.indexOf('/* Theme 3: Deep Dark */')
    )
    const deepDarkBlock = cssContent.slice(cssContent.indexOf('[data-theme="deep-dark"]'))

    expect(cleanLightBlock).toContain('--badge-warning-bg')
    expect(cleanLightBlock).toContain('--badge-status-bg')
    expect(deepDarkBlock).toContain('--badge-warning-bg')
    expect(deepDarkBlock).toContain('--badge-status-text')
  })

  it('defines reader theme variables for every reader palette', () => {
    const cssPath = path.resolve(__dirname, '../index.css')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    ;['.theme-parchment', '.theme-white', '.theme-dark', '.theme-green'].forEach(selector => {
      const start = cssContent.indexOf(selector)
      expect(start).toBeGreaterThan(-1)
      const nextTheme = cssContent.indexOf('\n.theme-', start + selector.length)
      const block = cssContent.slice(start, nextTheme > -1 ? nextTheme : cssContent.indexOf('/* Global Base Styles */'))

      expect(block).toContain('--reader-bg')
      expect(block).toContain('--reader-text')
      expect(block).toContain('--reader-border')
      expect(block).toContain('--reader-accent-rgb')
    })
  })
})
