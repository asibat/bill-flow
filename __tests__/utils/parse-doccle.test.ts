/**
 * Tests for parseDoccleHtml and extractDoccleUrl utility functions.
 */

import { parseDoccleHtml, extractDoccleUrl } from '@/lib/utils'

describe('extractDoccleUrl()', () => {
  it('extracts a Doccle direct document URL from email text', () => {
    const text = `
      Hello, you have a new document.
      https://secure.doccle.be/doccle-euui/direct/document/01/abc123?lang=EN
      Kind regards
    `
    expect(extractDoccleUrl(text)).toBe(
      'https://secure.doccle.be/doccle-euui/direct/document/01/abc123?lang=EN'
    )
  })

  it('returns null when no Doccle URL is present', () => {
    expect(extractDoccleUrl('Hello, this is a regular email.')).toBeNull()
    expect(extractDoccleUrl('https://google.com')).toBeNull()
  })

  it('handles URLs with special characters', () => {
    const url = 'https://secure.doccle.be/doccle-euui/direct/document/01/bnnxS1S5NFsD0fEej2W8HxHHDgwZLUlxhEchd3e9iAGDFM2UvwZnL40vKQ66QOvNrJOW16ILba0ZoRyY1D2TwZW2dsfnLd4Ynb9Ocasu4SajkyzR-qi0sGBGm6NrL80IDmvkclA7UZBBBRaoZ7nt4PkTU9OjejnJahNE_hwUQ9o?lang=EN'
    const text = `Check your document: ${url}`
    expect(extractDoccleUrl(text)).toBe(url)
  })
})

describe('parseDoccleHtml()', () => {
  it('extracts amount with € symbol', () => {
    const html = '<td>€45,00</td>'
    const result = parseDoccleHtml(html)
    expect(result.amount).toBe(45)
  })

  it('extracts amount with EUR prefix', () => {
    const html = '<td>EUR 127,50</td>'
    const result = parseDoccleHtml(html)
    expect(result.amount).toBe(127.5)
  })

  it('extracts amount with € suffix', () => {
    const html = '<td>45,00 €</td>'
    const result = parseDoccleHtml(html)
    expect(result.amount).toBe(45)
  })

  it('extracts amount with dot decimal', () => {
    const html = '<td>€37.29</td>'
    const result = parseDoccleHtml(html)
    expect(result.amount).toBe(37.29)
  })

  it('extracts due date in "30 March 2026" format', () => {
    const html = '<td>Due date:</td><td>30 March 2026</td>'
    const result = parseDoccleHtml(html)
    expect(result.dueDate).toBe('2026-03-30')
  })

  it('extracts due date with French label', () => {
    const html = '<td>échéance: 15 April 2026</td>'
    const result = parseDoccleHtml(html)
    expect(result.dueDate).toBe('2026-04-15')
  })

  it('extracts payee from title tag', () => {
    const html = '<html><head><title>A new document from VIVAQUA: Facture</title></head></html>'
    const result = parseDoccleHtml(html)
    expect(result.payee).toBe('A new document from VIVAQUA: Facture')
  })

  it('returns empty object for irrelevant HTML', () => {
    const html = '<html><body>Hello world</body></html>'
    const result = parseDoccleHtml(html)
    expect(result.amount).toBeUndefined()
    expect(result.dueDate).toBeUndefined()
    expect(result.payee).toBeUndefined()
  })
})
