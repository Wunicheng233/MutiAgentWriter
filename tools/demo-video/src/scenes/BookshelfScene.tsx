import {interpolate, useCurrentFrame} from 'remotion';
import {BookshelfShot} from '../components/ProductShot';
import {BrowserFrame} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {SceneShell} from '../components/SceneShell';

export const BookshelfScene = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 220], [0.88, 0.96], {extrapolateRight: 'clamp'});

  return (
    <SceneShell>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <BrowserFrame scale={scale}><BookshelfShot /></BrowserFrame>
      </div>
      <Caption>从一个想法开始。</Caption>
    </SceneShell>
  );
};
