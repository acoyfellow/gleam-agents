const parseDay = (s: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new RangeError(`dates: bad date ${s}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) throw new RangeError(`dates: no such date ${s}`);
  return t / 86_400_000;
};

const show = (day: number): string => new Date(day * 86_400_000).toISOString().slice(0, 10);

export function addBusinessDays(date: string, days: number, holidays: string[] = []): string {
  if (!Number.isInteger(days)) throw new RangeError(`dates: ${days} is not a whole number of days`);
  const off = new Set(holidays.map(parseDay));
  const business = (day: number) => { const w = new Date(day * 86_400_000).getUTCDay(); return w !== 0 && w !== 6 && !off.has(day); };
  let day = parseDay(date);
  const step = days < 0 ? -1 : 1;
  if (days === 0) { while (!business(day)) day += 1; return show(day); }
  for (let left = Math.abs(days); left > 0; ) { day += step; if (business(day)) left -= 1; }
  return show(day);
}
