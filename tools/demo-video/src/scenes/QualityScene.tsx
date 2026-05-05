import {interpolate, useCurrentFrame} from 'remotion';
import {BrowserFrame} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {QualityShot} from '../components/ProductShot';
import {SceneShell} from '../components/SceneShell';

export const QualityScene = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 110], [0.94, 0.99], {extrapolateRight: 'clamp'});

  return (
    <SceneShell tone="green">
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <BrowserFrame scale={scale}><QualityShot /></BrowserFrame>
      </div>
      <Caption>质量可检查，过程可追踪。</Caption>
    </SceneShell>
  );
};
