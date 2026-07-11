import { Text } from 'react-native';

interface SectionHeaderProps {
  label: string;
  className?: string;
}

export function SectionHeader({ label, className = '' }: SectionHeaderProps) {
  return (
    <Text
      accessibilityRole="header"
      className={`text-xs font-bold uppercase tracking-widest text-subtext pl-1 ${className}`}
    >
      {label}
    </Text>
  );
}
