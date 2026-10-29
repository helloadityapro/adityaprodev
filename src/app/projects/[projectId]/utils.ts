import { format, parseISO, isValid, startOfDay, differenceInDays } from 'date-fns';

export const formatCapacity = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export const formatTimestamp = (ts: any) => {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
  return format(date, 'dd MMM yyyy HH:mm');
};

export const getDaysRemaining = (dateStr?: string) => {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  if (!isValid(date)) return null;
  const today = startOfDay(new Date());
  return differenceInDays(date, today);
};
