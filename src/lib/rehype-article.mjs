/**
 * Build-time markdown transforms for writeups and blog posts.
 *
 * Two jobs, both done here rather than client-side so they work
 * with JavaScript disabled:
 *
 *  1. A paragraph that contains nothing but an image becomes a
 *     <figure> with the alt text repeated as a <figcaption>. These
 *     writeups have unusually descriptive alt text — it's genuinely
 *     useful reading matter, not just an accessibility fallback, so
 *     it gets shown.
 *
 *  2. Every <pre> is wrapped in a positioned container so a copy
 *     button has somewhere to sit.
 *
 * No dependencies — a plain recursive walk over the hast tree.
 */

/** Depth-first walk, letting the visitor replace a node in its parent. */
function walk(node, parent, index, visit) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node.children)) {
    // Iterate backwards so in-place replacement can't disturb indices
    // we have yet to visit.
    for (let i = node.children.length - 1; i >= 0; i--) {
      walk(node.children[i], node, i, visit);
    }
  }

  if (parent) visit(node, parent, index);
}

const isImg = (n) => n.type === 'element' && n.tagName === 'img';
const isBlank = (n) => n.type === 'text' && n.value.trim() === '';

export function rehypeArticle() {
  return (tree) => {
    walk(tree, null, null, (node, parent, index) => {
      // ── 1. image-only paragraph → figure ───────────────────
      if (node.type === 'element' && node.tagName === 'p') {
        const meaningful = node.children.filter((c) => !isBlank(c));

        if (meaningful.length === 1 && isImg(meaningful[0])) {
          const img = meaningful[0];
          const alt = img.properties?.alt ?? '';

          img.properties = {
            ...img.properties,
            loading: 'lazy',
            decoding: 'async',
          };

          const children = [img];

          if (alt.trim()) {
            children.push({
              type: 'element',
              tagName: 'figcaption',
              properties: {},
              children: [{ type: 'text', value: alt }],
            });
          }

          parent.children[index] = {
            type: 'element',
            tagName: 'figure',
            properties: {},
            children,
          };
          return;
        }
      }

      // ── 2. pre → wrapped pre + copy button ─────────────────
      if (node.type === 'element' && node.tagName === 'pre') {
        // Don't double-wrap on a second pass.
        if (parent.type === 'element' && parent.properties?.className?.includes?.('code-wrap')) {
          return;
        }

        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['code-wrap'] },
          children: [
            node,
            {
              type: 'element',
              tagName: 'button',
              properties: {
                className: ['copy'],
                type: 'button',
                'data-copy': '',
                'aria-label': 'Copy code to clipboard',
              },
              children: [{ type: 'text', value: 'Copy' }],
            },
          ],
        };
        return;
      }

      // ── 3. wide tables get their own scroll container ──────
      if (node.type === 'element' && node.tagName === 'table') {
        if (parent.type === 'element' && parent.properties?.className?.includes?.('table-wrap')) {
          return;
        }
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-wrap'] },
          children: [node],
        };
      }
    });
  };
}

export default rehypeArticle;
