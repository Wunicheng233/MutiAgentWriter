import {interpolate, useCurrentFrame} from 'remotion';
import {BrowserFrame} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {ReaderShot} from '../components/ProductShot';
import {SceneShell} from '../components/SceneShell';

export const ReaderScene = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 280], [0.93, 1.03], {extrapolateRight: 'clamp'});

  return (
    <SceneShell>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <BrowserFrame scale={scale}><ReaderShot /></BrowserFrame>
      </div>
      <Caption>最终回到阅读本身。</Caption>
    </SceneShell>
  );
};
