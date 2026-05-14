import type { ReactNode } from 'react';

interface InlineTextProps {
  text: string;
}

export const renderInlineText = (text: string): ReactNode => {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/gu;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(<strong key={`${match.index}-${match[1]}`}>{match[1]}</strong>);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : text;
};

const InlineText = ({ text }: InlineTextProps) => <>{renderInlineText(text)}</>;

export default InlineText;
