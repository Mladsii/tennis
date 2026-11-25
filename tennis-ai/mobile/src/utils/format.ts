import dayjs from 'dayjs';

export function formatDateTime(iso: string): string {
  return dayjs(iso).format('DD.MM.YYYY HH:mm');
}

export function formatTime(iso: string): string {
  return dayjs(iso).format('HH:mm');
}

export function formatDate(iso: string): string {
  return dayjs(iso).format('DD.MM.YYYY');
}

export function formatInitials(firstName: string, lastName: string): string {
  return `${lastName} ${firstName[0]}.`;
}

export function formatFullName(
  lastName: string,
  firstName: string,
  patronymic?: string | null,
): string {
  const parts = [lastName, firstName];
  if (patronymic) parts.push(patronymic);
  return parts.join(' ');
}

export function extractErrorMessage(e: any, fallback: string): string {
  const detail = e.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => d.msg || d).join('\n');
  }
  if (typeof detail === 'string') {
    return detail;
  }
  return fallback;
}
