import { listRows, number, unwrap } from './_baserow.js';

export async function configuredMembershipPerks(cfg) {
  if (!cfg.settings) return [];
  const rows = await listRows(cfg, cfg.settings);
  const row = rows[0] || {};
  return Object.keys(row)
    .map((key) => {
      const match = key.match(/^Perk\s*(\d+)\s*text$/i);
      if (!match) return null;
      const label = unwrap(row[key]).trim();
      if (!label) return null;
      const order = Number(match[1]);
      const unlockWeeks = Math.max(0, Math.trunc(number(row[`Perk ${match[1]} unlock weeks`], 0)));
      return { order, label, unlockWeeks };
    })
    .filter(Boolean)
    .sort((a,b)=>a.unlockWeeks-b.unlockWeeks||a.order-b.order);
}

export async function wholesalePerkAccess(cfg, member) {
  const perks = await configuredMembershipPerks(cfg);
  const perk = perks.find((item) => /wholesale/i.test(item.label));
  const unlockWeeks = perk?.unlockWeeks ?? 12;
  const weeks = Math.max(0, Math.trunc(number(member?.['Consecutive weeks'], 0)));
  return { unlocked: weeks >= unlockWeeks, unlockWeeks, weeks, label: perk?.label || 'Access to quarterly wholesale orders' };
}
