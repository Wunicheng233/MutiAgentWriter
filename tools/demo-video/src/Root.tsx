import {Composition} from 'remotion';
import {totalFrames} from './content';
import {StoryForgeDemo} from './StoryForgeDemo';

export const RemotionRoot = () => {
  return (
    <Composition
      id="StoryForgeDemo"
      component={StoryForgeDemo}
      durationInFrames={totalFrames}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
