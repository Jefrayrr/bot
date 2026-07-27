import { Page } from 'puppeteer';
import { DOMNodeData } from './types.js';
import { eventBus } from './EventBus.js';

const INTERACTIVE_TAGS = new Set([
  'input', 'select', 'textarea', 'button', 'a', 'label',
]);

export class DOMSerializer {
  private page: Page | null = null;

  setPage(page: Page): void {
    this.page = page;
  }

  async serialize(): Promise<DOMNodeData | null> {
    if (!this.page) return null;

    try {
      const tree = await this.page.evaluate(() => {
        function serialize(el: Element, depth: number): DOMNodeData | null {
          if (depth > 6) return null;

          const tag = el.tagName.toLowerCase();
          const interactive = INTERACTIVE_TAGS.has(tag) ||
            el.getAttribute('role') === 'button' ||
            el.getAttribute('role') === 'link' ||
            el.getAttribute('tabindex') === '0';

          let text = '';
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
            text = el.textContent?.trim().substring(0, 80) || '';
          } else if (tag === 'button' || tag === 'a') {
            text = el.textContent?.trim().substring(0, 60) || '';
          } else if (tag === 'input') {
            text = (el as HTMLInputElement).placeholder ||
                   (el as HTMLInputElement).type || '';
          } else if (tag === 'select') {
            text = el.getAttribute('aria-label') || el.id || 'select';
          }

          const selector = buildSelector(el);
          const children: DOMNodeData[] = [];

          for (const child of el.children) {
            const childTag = child.tagName.toLowerCase();
            if (['script', 'style', 'noscript'].includes(childTag)) continue;

            const childNode = serialize(child, depth + 1);
            if (childNode) children.push(childNode);
          }

          if (!interactive && children.length === 0 && !text) return null;

          return { tag, text: text || undefined, children, interactive, selector };
        }

        function buildSelector(el: Element): string {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const cls = el.className && typeof el.className === 'string'
            ? '.' + el.className.split(/\s+/).filter(c => c && !c.startsWith('artdeco')).slice(0, 2).join('.')
            : '';
          return `${tag}${id}${cls}`;
        }

        const body = document.body;
        return serialize(body, 0);
      });

      return tree;
    } catch {
      return null;
    }
  }

  emitDOM(): void {
    this.serialize().then((tree) => {
      if (tree) eventBus.emit('dom:tree', tree);
    });
  }
}

export const domSerializer = new DOMSerializer();
