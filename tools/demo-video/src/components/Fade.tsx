import type {ReactNode} from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

type FadeProps = {
  children: ReactNode;
  duration: number;
};

export const Fade = ({children, duration}: FadeProps) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16, Math.max(17, duration - 16), duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return <div style={{position: 'absolute', inset: 0, opacity}}>{children}</div>;
};
