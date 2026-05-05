import {theme} from '../theme';

type ProgressBadgeProps = {
  label: string;
  progress?: number;
  tone?: 'orange' | 'green';
};

export const ProgressBadge = ({label, progress, tone = 'orange'}: ProgressBadgeProps) => {
  const color = tone === 'green' ? theme.colors.pine : theme.colors.orange;
  const background = tone === 'green' ? 'rgba(95, 135, 111, 0.10)' : theme.colors.orangeSoft;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 14px',
        borderRadius: 9,
        border: `1px solid ${color}33`,
        background,
        color,
        fontFamily: theme.fonts.sans,
        fontSize: 18,
        fontWeight: 700
      }}
    >
      <span style={{width: 10, height: 10, borderRadius: 999, background: color}} />
      <span>{label}</span>
      {typeof progress === 'number' ? <span>{Math.round(progress)}%</span> : null}
    </div>
  );
};
