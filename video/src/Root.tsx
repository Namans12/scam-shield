import React from "react";
import { AbsoluteFill, Composition, Sequence } from "remotion";
import { FPS, H, W, fontFamily } from "./theme";
import { Backdrop, SceneFade } from "./components/common";
import { Captions } from "./components/Captions";
import { OVERLAP, plans, sceneStarts, totalFrames } from "./plan";
import { FootageScene } from "./scenes/FootageScene";
import { Intro } from "./scenes/Intro";
import { Architecture } from "./scenes/Architecture";
import { Benchmark } from "./scenes/Benchmark";
import { Closing } from "./scenes/Closing";

const renderScene = (id: string, frames: number) => {
  switch (id) {
    case "intro":
      return <Intro frames={frames} />;
    case "architecture":
      return <Architecture frames={frames} />;
    case "benchmark":
      return <Benchmark frames={frames} />;
    case "closing":
      return <Closing frames={frames} />;
    default:
      return <FootageScene plan={plans[id]} audioId={id} frames={frames} />;
  }
};

export const Demo: React.FC = () => {
  const scenes = sceneStarts();
  return (
    <AbsoluteFill style={{ fontFamily, background: "#081B32" }}>
      <Backdrop />
      {scenes.map((s, i) => (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames} name={s.id}>
          <SceneFade frames={s.frames} overlap={OVERLAP} first={i === 0} last={i === scenes.length - 1}>
            {renderScene(s.id, s.frames)}
          </SceneFade>
        </Sequence>
      ))}
      <Captions />
    </AbsoluteFill>
  );
};

export const Root: React.FC = () => (
  <Composition
    id="ScamShieldDemo"
    component={Demo}
    durationInFrames={totalFrames()}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={{}}
    // The scene table travels with the composition so build scripts (stills, verification, srt) read the same numbers.
    calculateMetadata={() => ({ durationInFrames: totalFrames(), props: { table: sceneStarts() } })}
  />
);
