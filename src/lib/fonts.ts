import type { ResumeFontFamily } from '../types/resume';

export const RESUME_FONT_OPTIONS: ReadonlyArray<{ value: ResumeFontFamily; label: string }> = [
  { value: 'source-han-serif', label: '思源宋体' },
  { value: 'anthropic-serif', label: 'Anthropic Serif' },
  { value: 'anthropic-sans', label: 'Anthropic Sans' },
];

const FONT_STACKS: Record<ResumeFontFamily, string> = {
  'source-han-serif': "'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', 'Noto Serif SC', STSong, SimSun, serif",
  'anthropic-serif': "'Anthropic Serif', 'Anthropic Serif Web', 'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', 'Noto Serif SC', STSong, SimSun, serif",
  'anthropic-sans': "'Anthropic Sans', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', Arial, sans-serif",
};

export const resumeFontStack = (fontFamily: ResumeFontFamily): string => FONT_STACKS[fontFamily];

export const resumeWordFont = (fontFamily: ResumeFontFamily): string => {
  if (fontFamily === 'anthropic-serif') return 'Anthropic Serif';
  if (fontFamily === 'anthropic-sans') return 'Anthropic Sans';
  return 'Source Han Serif SC';
};
