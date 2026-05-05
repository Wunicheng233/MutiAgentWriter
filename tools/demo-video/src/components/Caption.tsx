import {interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

type CaptionProps = {
  children: string;
  bottom?: number;
};

export const Caption = ({children, bottom = 84}: CaptionProps) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
  const translateY = interpolate(frame, [0, 20], [20, 0], {extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        bottom,
        opacity,
        transform: `translateY(${translateY}px)`,
        fontFamily: theme.fonts.serif,
        fontSize: 48,
        lineHeight: 1.28,
        color: theme.colors.ink,
        textShadow: '0 1px 0 rgba(255,255,255,0.5)'
      }}
    >
      {children}
    </div>
  );
};
