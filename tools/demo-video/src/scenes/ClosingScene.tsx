import {interpolate, useCurrentFrame} from 'remotion';
import {SceneShell} from '../components/SceneShell';
import {theme} from '../theme';

export const ClosingScene = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 26], [0, 1], {extrapolateRight: 'clamp'});
  const y = interpolate(frame, [0, 42], [28, 0], {extrapolateRight: 'clamp'});

  return (
    <SceneShell tone="green">
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <div style={{opacity, transform: `translateY(${y}px)`, textAlign: 'center'}}>
          <div style={{fontFamily: theme.fonts.sans, letterSpacing: '0.38em', color: theme.colors.pine, fontSize: 18, marginBottom: 28}}>STORYFORGE AI</div>
          <h1 style={{fontFamily: theme.fonts.serif, fontSize: 82, margin: 0}}>多智能体小说创作工作台</h1>
          <div style={{display: 'flex', justifyContent: 'center', gap: 18, marginTop: 38, fontFamily: theme.fonts.sans, color: theme.colors.pineDark, fontSize: 22}}>
            <span>策划</span>
            <span>·</span>
            <span>写作</span>
            <span>·</span>
            <span>评审</span>
            <span>·</span>
            <span>修订</span>
            <span>·</span>
            <span>交付</span>
          </div>
        </div>
      </div>
    </SceneShell>
  );
};
