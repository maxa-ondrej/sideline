interface ColorDotProps {
  color: string | undefined;
}

export function ColorDot({ color }: ColorDotProps) {
  if (!color) return null;
  return (
    <span
      className='inline-block w-3 h-3 rounded-full shrink-0'
      style={{ backgroundColor: color }}
    />
  );
}
