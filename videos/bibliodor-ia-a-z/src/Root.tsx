import React from 'react';
import { Composition } from 'remotion';
import { Pub, FPS, DURATION_S } from './Pub';

export const Root: React.FC = () => (
  <Composition
    id="Pub"
    component={Pub}
    durationInFrames={Math.round(DURATION_S * FPS)}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
