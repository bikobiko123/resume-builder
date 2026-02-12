export const preparePrint = (): void => {
  if (typeof document === 'undefined') {
    return;
  }
  document.body.classList.add('print-mode');
};

export const exportPdf = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.print();
};
