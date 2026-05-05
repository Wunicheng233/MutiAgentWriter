import {interpolate, useCurrentFrame} from 'remotion';
import {SceneShell} from '../components/SceneShell';
import {theme} from '../theme';

export const OpeningScene = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 28], [0, 1], {extrapolateRight: 'clamp'});
  const y = interpolate(frame, [0, 50], [36, 0], {extrapolateRight: 'clamp'});
  const scale = interpolate(frame, [30, 180], [0.95, 1.06], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <SceneShell>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <div style={{opacity, transform: `translateY(${y}px) scale(${scale})`, textAlign: 'center'}}>
          <div style={{fontFamily: theme.fonts.sans, letterSpacing: '0.38em', color: theme.colors.pine, fontSize: 18, marginBottom: 30}}>STORYFORGE AI</div>
          <h1 style={{fontFamily: theme.fonts.serif, fontSize: 88, lineHeight: 1.05, margin: 0, color: theme.colors.ink}}>多智能体小说创作工作台</h1>
          <p style={{fontFamily: theme.fonts.serif, fontSize: 44, color: theme.colors.muted, marginTop: 30}}>让 AI 写小说，不止生成一段文字。</p>
        </div>
      </div>
    </SceneShell>
  );
};
