import {interpolate, useCurrentFrame} from 'remotion';
import {BrowserFrame} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {CreateProjectShot} from '../components/ProductShot';
import {SceneShell} from '../components/SceneShell';

export const CreateProjectScene = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 280], [0.92, 0.98], {extrapolateRight: 'clamp'});
  const x = interpolate(frame, [0, 280], [34, -18], {extrapolateRight: 'clamp'});

  return (
    <SceneShell>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', transform: `translateX(${x}px)`}}>
        <BrowserFrame scale={scale}><CreateProjectShot /></BrowserFrame>
      </div>
      <Caption>选择题材、协作方式和作家风格。</Caption>
    </SceneShell>
  );
};
