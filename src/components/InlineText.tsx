import type { ReactNode } from 'react';
import { hasInlineMarkup, splitInlineSegments } from '../lib/inline';

interface InlineTextProps {
  text: string;
}

export const renderInlineText = (text: string): ReactNode => {
  // Plain text is handed back as-is (not wrapped in an array) so React renders
  // exactly one text child, matching the previous implementation.
  if (!hasInlineMarkup(text)) return text;

  return splitInlineSegments(text).map((segment, index) =>
    segment.bold ? <strong key={index}>{segment.text}</strong> : segment.text,
  );
};

const InlineText = ({ text }: InlineTextProps) => <>{renderInlineText(text)}</>;

export default InlineText;
