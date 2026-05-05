import type {ReactNode} from 'react';
import {AbsoluteFill} from 'remotion';
import {theme} from '../theme';

type SceneShellProps = {
  children: ReactNode;
  tone?: 'light' | 'green';
};

export const SceneShell = ({children, tone = 'light'}: SceneShellProps) => (
  <AbsoluteFill
    style={{
      background:
        tone === 'green'
          ? `radial-gradient(circle at 80% 18%, rgba(95, 135, 111, 0.26), transparent 34%), linear-gradient(135deg, ${theme.colors.paperWarm}, ${theme.colors.paperMist})`
          : `radial-gradient(circle at 18% 18%, rgba(223, 127, 88, 0.11), transparent 28%), radial-gradient(circle at 84% 18%, rgba(95, 135, 111, 0.20), transparent 34%), linear-gradient(135deg, ${theme.colors.paper}, ${theme.colors.paperWarm} 54%, ${theme.colors.paperMist})`,
      color: theme.colors.ink,
      fontFamily: theme.fonts.serif,
      overflow: 'hidden'
    }}
  >
    {children}
  </AbsoluteFill>
);
