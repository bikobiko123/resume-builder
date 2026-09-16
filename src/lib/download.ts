/** Browser file download helper. Kept separate from the renderers so each export path stays pure. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadText = (text: string, filename: string, mime: string): void => {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
};
