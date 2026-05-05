import {interpolate, useCurrentFrame} from 'remotion';
import {BrowserFrame} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {SkillShot} from '../components/ProductShot';
import {SceneShell} from '../components/SceneShell';

export const SkillScene = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 280], [0.94, 1.02], {extrapolateRight: 'clamp'});

  return (
    <SceneShell tone="green">
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <BrowserFrame scale={scale}><SkillShot /></BrowserFrame>
      </div>
      <Caption>风格成为可注入的创作能力。</Caption>
    </SceneShell>
  );
};
