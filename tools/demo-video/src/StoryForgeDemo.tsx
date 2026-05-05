import {AbsoluteFill, Sequence} from 'remotion';
import {OpeningScene} from './scenes/OpeningScene';
import {BookshelfScene} from './scenes/BookshelfScene';
import {CreateProjectScene} from './scenes/CreateProjectScene';
import {SkillScene} from './scenes/SkillScene';
import {PlanningScene} from './scenes/PlanningScene';
import {WorkflowScene} from './scenes/WorkflowScene';
import {ReaderScene} from './scenes/ReaderScene';
import {QualityScene} from './scenes/QualityScene';
import {ClosingScene} from './scenes/ClosingScene';
import {Fade} from './components/Fade';

export const StoryForgeDemo = () => (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={180}><Fade duration={180}><OpeningScene /></Fade></Sequence>
    <Sequence from={180} durationInFrames={240}><Fade duration={240}><BookshelfScene /></Fade></Sequence>
    <Sequence from={420} durationInFrames={300}><Fade duration={300}><CreateProjectScene /></Fade></Sequence>
    <Sequence from={720} durationInFrames={300}><Fade duration={300}><SkillScene /></Fade></Sequence>
    <Sequence from={1020} durationInFrames={360}><Fade duration={360}><PlanningScene /></Fade></Sequence>
    <Sequence from={1380} durationInFrames={420}><Fade duration={420}><WorkflowScene /></Fade></Sequence>
    <Sequence from={1800} durationInFrames={300}><Fade duration={300}><WorkflowScene confirmMode /></Fade></Sequence>
    <Sequence from={2100} durationInFrames={300}><Fade duration={300}><ReaderScene /></Fade></Sequence>
    <Sequence from={2400} durationInFrames={120}><Fade duration={120}><QualityScene /></Fade></Sequence>
    <Sequence from={2520} durationInFrames={180}><Fade duration={180}><ClosingScene /></Fade></Sequence>
  </AbsoluteFill>
);
