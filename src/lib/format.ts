/** Date-range label shared by the A4 preview, the HTML renderer and the .docx export. */
export const formatDateRange = (start: string, end: string): string => {
  const startStr = start || '';
  const endStr = end === 'present' ? '至今' : (end || '');
  if (startStr && endStr) return `${startStr} - ${endStr}`;
  if (startStr) return startStr;
  return endStr;
};
