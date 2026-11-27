const TARGET_WORD = /^[A-Za-z][A-Za-z'-]*$/;

export function speakableStrong(ctx) {
  const path = ctx?.fileURL?.pathname ?? '';
  if (path && !path.includes('/content/english/')) return false;
  return {
    name: 'speakable-strong',
    element: {
      filter: ['strong'],
      visit(node, visitCtx) {
        const text = visitCtx.textContent(node).replace(/\s+/g, ' ').trim();
        if (!TARGET_WORD.test(text)) return;
        visitCtx.setProperty(node, 'role', 'button');
        visitCtx.setProperty(node, 'tabindex', '0');
        visitCtx.setProperty(node, 'aria-label', `播放 ${text} 的發音`);
      },
    },
  };
}
