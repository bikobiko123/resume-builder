export type MoveDirection = 'up' | 'down';

export const moveArrayItem = <T>(items: readonly T[], index: number, direction: MoveDirection): T[] => {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || targetIndex < 0 || targetIndex >= items.length) {
    return [...items];
  }

  const reordered = [...items];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
  return reordered;
};
