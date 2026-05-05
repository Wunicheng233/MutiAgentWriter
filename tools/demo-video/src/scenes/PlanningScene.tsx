import {interpolate, useCurrentFrame} from 'remotion';
import {BrowserFrame} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {PlanningShot} from '../components/ProductShot';
import {SceneShell} from '../components/SceneShell';

export const PlanningScene = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 340], [0.90, 0.97], {extrapolateRight: 'clamp'});

  return (
    <SceneShell>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <BrowserFrame scale={scale}><PlanningShot /></BrowserFrame>
      </div>
      <Caption>先策划，再写作。方向由人确认。</Caption>
    </SceneShell>
  );
};
