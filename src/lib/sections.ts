export type SectionBlock = {
  type: string;
  key: string;
  order: number;
  items: any[];
  section: any;
};

const normalizedType = (type: string) => (type || 'Text').trim().toLowerCase().replace(/\s+/g, '-');

export function buildSectionBlocks(sections: any[]): SectionBlock[] {
  const blocks: SectionBlock[] = [];
  const grouped = new Map<string, SectionBlock>();

  for (const section of sections) {
    const key = String(section.key || '').trim();
    const inferredHowItWorks = section.page === 'home' && /^how-[1-9]\d*$/i.test(key);
    const type = inferredHowItWorks ? 'cards' : normalizedType(section.type);
    const groupable = type === 'cards' || type === 'gallery';
    const groupKey = section.groupKey || (inferredHowItWorks ? 'how-it-works' : (groupable ? `${section.page}-${type}` : ''));

    if (groupable && groupKey) {
      const mapKey = `${type}:${groupKey}`;
      let block = grouped.get(mapKey);
      if (!block) {
        block = { type, key: groupKey, order: section.order, items: [], section };
        grouped.set(mapKey, block);
        blocks.push(block);
      }
      block.items.push(section);
      block.order = Math.min(block.order, section.order);
    } else {
      blocks.push({ type, key: section.key || `${type}-${section.order}`, order: section.order, items: [section], section });
    }
  }

  return blocks.sort((a, b) => a.order - b.order);
}
