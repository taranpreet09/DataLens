import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../intelligenceMarkdown';

describe('renderMarkdown', () => {
  it('returns empty string for null/undefined input', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
    expect(renderMarkdown('')).toBe('');
  });

  it('renders headings h1–h4', () => {
    expect(renderMarkdown('# Title')).toContain('<h1>Title</h1>');
    expect(renderMarkdown('## Section')).toContain('<h2>Section</h2>');
    expect(renderMarkdown('### Sub')).toContain('<h3>Sub</h3>');
    expect(renderMarkdown('#### Deep')).toContain('<h4>Deep</h4>');
  });

  it('renders bold and italic inline', () => {
    const out = renderMarkdown('**bold** and *italic*');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
  });

  it('renders inline code', () => {
    const out = renderMarkdown('Use `console.log` here');
    expect(out).toContain('<code>console.log</code>');
  });

  it('renders blockquotes', () => {
    const out = renderMarkdown('> This is a quote');
    expect(out).toContain('<blockquote>');
    expect(out).toContain('This is a quote');
  });

  it('renders unordered lists with - and *', () => {
    const out = renderMarkdown('- item one\n- item two');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>');
    expect(out).toContain('item one');
    expect(out).toContain('item two');
  });

  it('renders ordered lists', () => {
    const out = renderMarkdown('1. first\n2. second');
    expect(out).toContain('<ol>');
    expect(out).toContain('<li>');
    expect(out).toContain('first');
  });

  it('renders paragraphs for plain text', () => {
    const out = renderMarkdown('Hello world');
    expect(out).toContain('<p>');
    expect(out).toContain('Hello world');
  });

  it('renders links with rel=nofollow and target=_blank', () => {
    const out = renderMarkdown('[click here](https://example.com)');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it('escapes raw HTML in input', () => {
    const out = renderMarkdown('<div>raw html</div>');
    expect(out).not.toContain('<div>');
    expect(out).toContain('&lt;div&gt;');
  });

  it('never emits <script tags', () => {
    const inputs = [
      '<script>alert(1)</script>',
      '## Title\n<script src="evil.js"></script>',
      '**bold** <script>x</script>',
    ];
    for (const input of inputs) {
      const out = renderMarkdown(input);
      expect(out.toLowerCase()).not.toContain('<script');
    }
  });

  it('never emits <iframe tags', () => {
    const inputs = [
      '<iframe src="evil.com"></iframe>',
      '## Heading\n<iframe>',
    ];
    for (const input of inputs) {
      const out = renderMarkdown(input);
      expect(out.toLowerCase()).not.toContain('<iframe');
    }
  });

  it('never emits <style tags', () => {
    const out = renderMarkdown('<style>body{color:red}</style>');
    expect(out.toLowerCase()).not.toContain('<style');
  });

  it('strips on* event attributes', () => {
    const out = renderMarkdown('<a onclick="evil()">link</a>');
    expect(out).not.toContain('onclick');
  });

  it('handles multi-section markdown', () => {
    const md = `## Overview\n\nThis is a paragraph.\n\n## Details\n\n- item one\n- item two`;
    const out = renderMarkdown(md);
    expect(out).toContain('<h2>Overview</h2>');
    expect(out).toContain('<h2>Details</h2>');
    expect(out).toContain('<p>');
    expect(out).toContain('<ul>');
  });
});
