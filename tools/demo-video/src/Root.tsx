import {Composition} from 'remotion';
import {StoryForgeDemo} from './StoryForgeDemo';

export const RemotionRoot = () => {
  return (
    <Composition
      id="StoryForgeDemo"
      component={StoryForgeDemo}
      durationInFrames={2700}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
