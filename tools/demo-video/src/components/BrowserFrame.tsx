import type {ReactNode} from 'react';
import {theme} from '../theme';

type BrowserFrameProps = {
  children: ReactNode;
  title?: string;
  scale?: number;
};

export const BrowserFrame = ({children, title = 'StoryForge AI', scale = 1}: BrowserFrameProps) => (
  <div
    style={{
      width: 1440,
      height: 810,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      borderRadius: 28,
      background: theme.colors.white,
      border: `1px solid ${theme.colors.line}`,
      boxShadow: theme.shadow,
      overflow: 'hidden'
    }}
  >
    <div
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 26px',
        gap: 14,
        borderBottom: `1px solid ${theme.colors.line}`,
        background: 'rgba(255, 250, 244, 0.92)',
        fontFamily: theme.fonts.sans,
        color: theme.colors.muted,
        fontSize: 18
      }}
    >
      <span style={{width: 13, height: 13, borderRadius: 999, background: '#df7f58'}} />
      <span style={{width: 13, height: 13, borderRadius: 999, background: '#e7c96d'}} />
      <span style={{width: 13, height: 13, borderRadius: 999, background: '#78a986'}} />
      <span style={{marginLeft: 14, fontWeight: 700}}>{title}</span>
    </div>
    <div style={{height: 746}}>{children}</div>
  </div>
);
