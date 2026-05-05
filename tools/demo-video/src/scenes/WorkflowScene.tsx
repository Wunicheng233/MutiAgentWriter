import {interpolate, useCurrentFrame} from 'remotion';
import {BrowserFrame} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {WorkflowShot} from '../components/ProductShot';
import {SceneShell} from '../components/SceneShell';

type WorkflowSceneProps = {
  confirmMode?: boolean;
};

export const WorkflowScene = ({confirmMode = false}: WorkflowSceneProps) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, confirmMode ? 260 : 380], [0.91, confirmMode ? 1.01 : 0.97], {extrapolateRight: 'clamp'});

  return (
    <SceneShell tone={confirmMode ? 'green' : 'light'}>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <BrowserFrame scale={scale}><WorkflowShot confirmMode={confirmMode} /></BrowserFrame>
      </div>
      <Caption>{confirmMode ? '人在关键节点把关。' : '每一章，都经过写作、评审与修订。'}</Caption>
    </SceneShell>
  );
};
