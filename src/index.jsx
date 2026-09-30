import React from "react";
import {
  registerRoot,
  Composition,
  AbsoluteFill,
  Audio,
  Img,
  Video,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import {
  useAudioData,
  visualizeAudio
} from "@remotion/media-utils";

const LivingEQ = ({ audioUrl, coverUrl, motionUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const audioData = useAudioData(audioUrl);

  const spectrum = audioData
    ? visualizeAudio({
        fps,
        frame,
        audioData,
        numberOfSamples: 64,
        optimizeFor: "speed"
      })
    : [];

  const average = (start, end) => {
    let total = 0;
    let count = 0;

    for (
      let i = start;
      i < Math.min(end, spectrum.length);
      i++
    ) {
      total += spectrum[i] || 0;
      count++;
    }

    return count ? total / count : 0;
  };

  const sub = average(0, 4);
  const bass = average(4, 10);
  const mids = average(10, 34);
  const highs = average(34, 64);

  const engine = Math.min(1, 0.22 + sub * 1.8);
  const plume = Math.min(1, 0.18 + bass * 1.6);

  const coreSize = 24 + engine * 48;
  const plumeLength = 70 + plume * 220;

  const breathe =
    1 +
    Math.sin((frame / fps) * Math.PI * 0.36) * 0.003 +
    sub * 0.006;

  const engineJet = (x, side) => (
    <>
      <div
        style={{
          position: "absolute",
          left: x,
          top: "59%",
          width: coreSize,
          height: coreSize,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle,#fff,#16e1ff 28%,rgba(129,43,255,.6) 52%,transparent 76%)",
          filter: "blur(3px)",
          opacity: 0.55 + engine * 0.45,
          boxShadow: "0 0 80px #16e1ff"
        }}
      />

      <div
        style={{
          position: "absolute",
          left: x,
          top: "59%",
          width: plumeLength,
          height: 14 + plume * 28,
          transform:
            side < 0
              ? "translate(-100%, -50%)"
              : "translate(0, -50%)",
          background:
            side < 0
              ? "linear-gradient(90deg,transparent,#812bff,#16e1ff,#fff)"
              : "linear-gradient(90deg,#fff,#16e1ff,#812bff,transparent)",
          filter: "blur(3px)",
          opacity: 0.3 + plume * 0.68
        }}
      />
    </>
  );

  return (
    <AbsoluteFill
      style={{
        background: "#03040a",
        overflow: "hidden"
      }}
    >
      <Audio src={audioUrl} />

      <Video
        src={motionUrl}
        muted
        loop
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.58
        }}
      />

      <Img
        src={coverUrl}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `scale(${breathe})`,
          opacity: 0.84,
          filter:
            `brightness(${1 + sub * 0.07}) ` +
            `saturate(${1 + mids * 0.2})`
        }}
      />

      {engineJet("36.5%", -1)}
      {engineJet("63.5%", 1)}

      {Array.from({ length: 36 }, (_, i) => {
        const travel =
          (frame *
            (0.25 + highs * 2) *
            (1 + (i % 5) * 0.12) +
            i * 97) %
          1920;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: travel,
              top: `${(i * 83) % 100}%`,
              width: 3 + highs * 40,
              height: 1 + (i % 3),
              background:
                i % 7 ? "#b9f5ff" : "#f05a3c",
              opacity: 0.12 + highs * 0.8
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Root = () => (
  <Composition
    id="LivingEQ"
    component={LivingEQ}
    width={1280}
    height={720}
    fps={30}
    durationInFrames={300}
    defaultProps={{
      audioUrl: "",
      coverUrl: "",
      motionUrl: "",
      durationSeconds: 10
    }}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.ceil(
        (props.durationSeconds || 10) * 30
      ),
      width: props.width || 1280,
      height: props.height || 720
    })}
  />
);

registerRoot(Root);
