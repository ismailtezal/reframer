"use client";

import { USER, updateClip } from "@/core/ops";
import { type BackgroundClip, type Fill, SHAPE_KINDS, type ShapeClip } from "@/core/schema";
import { run } from "../../../actions";
import { useCoarseFrame } from "../../../store/playback-store";
import { ColorField, FieldRow, KeyframeButton, NumberField, Section, SelectField, SliderField } from "../fields";
import { keyframeState, setValue, toggleKeyframe, valueAtPlayhead } from "../props";

export const FillEditor: React.FC<{ fill: Fill | undefined; onChange: (f: Fill | undefined) => void; allowNone?: boolean }> = ({
  fill,
  onChange,
  allowNone,
}) => {
  const kind = fill?.type ?? "none";
  const first = fill?.type === "solid" ? fill.color : (fill?.stops[0]?.color ?? "#ffffff");
  const last = fill && fill.type !== "solid" ? fill.stops[fill.stops.length - 1].color : "#7c3aed";
  return (
    <>
      <FieldRow label="Fill">
        <SelectField
          value={kind}
          options={[
            ...(allowNone ? [{ value: "none", label: "None" }] : []),
            { value: "solid", label: "Solid" },
            { value: "linear", label: "Linear gradient" },
            { value: "radial", label: "Radial gradient" },
          ]}
          onChange={(k) => {
            if (k === "none") onChange(undefined);
            else if (k === "solid") onChange({ type: "solid", color: first });
            else if (k === "linear")
              onChange({
                type: "linear",
                angle: 135,
                stops: [
                  { color: first, pos: 0 },
                  { color: last, pos: 1 },
                ],
              });
            else
              onChange({
                type: "radial",
                cx: 0.5,
                cy: 0.4,
                stops: [
                  { color: first, pos: 0 },
                  { color: last, pos: 1 },
                ],
              });
          }}
        />
      </FieldRow>
      {fill?.type === "solid" ? (
        <FieldRow label="Color">
          <ColorField value={fill.color} onChange={(color) => onChange({ type: "solid", color })} />
        </FieldRow>
      ) : null}
      {fill && fill.type !== "solid" ? (
        <>
          <FieldRow label="From / to">
            <ColorField
              value={first}
              onChange={(c) => onChange({ ...fill, stops: [{ ...fill.stops[0], color: c }, ...fill.stops.slice(1)] })}
            />
            <ColorField
              value={last}
              onChange={(c) =>
                onChange({ ...fill, stops: [...fill.stops.slice(0, -1), { ...fill.stops[fill.stops.length - 1], color: c }] })
              }
            />
          </FieldRow>
          {fill.type === "linear" ? (
            <FieldRow label="Angle">
              <SliderField
                value={fill.angle}
                min={0}
                max={360}
                step={1}
                onChange={(angle) => onChange({ ...fill, angle })}
                format={(v) => `${v.toFixed(0)}°`}
              />
            </FieldRow>
          ) : (
            <FieldRow label="Center">
              <NumberField prefix="X" value={fill.cx} step={0.01} min={0} max={1} onChange={(cx) => onChange({ ...fill, cx })} />
              <NumberField prefix="Y" value={fill.cy} step={0.01} min={0} max={1} onChange={(cy) => onChange({ ...fill, cy })} />
            </FieldRow>
          )}
        </>
      ) : null}
    </>
  );
};

export const ShapeSection: React.FC<{ clip: ShapeClip }> = ({ clip }) => {
  const frame = useCoarseFrame();
  const patch = (p: Record<string, unknown>, label: string) =>
    run(label, (d) => updateClip(d, clip.id, p, { actor: USER }), `shape:${clip.id}:${Object.keys(p).join(",")}`);
  const draw = valueAtPlayhead<number>(clip, "drawProgress", clip.drawProgress ?? 1);
  const strokeWidth = valueAtPlayhead<number>(clip, "strokeWidth", clip.strokeWidth ?? 0);
  return (
    <Section title="Shape">
      <FieldRow label="Shape">
        <SelectField value={clip.shape} options={SHAPE_KINDS} onChange={(shape) => patch({ shape }, "Change shape")} />
      </FieldRow>
      <FillEditor fill={clip.fill} onChange={(fill) => patch({ fill: fill ?? null }, "Shape fill")} allowNone />
      <FieldRow label="Stroke">
        <ColorField value={clip.stroke ?? "#ffffff"} onChange={(stroke) => patch({ stroke }, "Stroke color")} />
        <NumberField
          className="max-w-20"
          value={strokeWidth}
          min={0}
          max={200}
          onChange={(v) => setValue(clip.id, "strokeWidth", v, "Stroke width")}
        />
        <KeyframeButton
          state={keyframeState(clip, "strokeWidth", frame)}
          onClick={() => toggleKeyframe(clip.id, "strokeWidth", strokeWidth)}
        />
      </FieldRow>
      {clip.shape === "rect" ? (
        <FieldRow label="Radius">
          <SliderField
            value={clip.cornerRadius ?? 0}
            min={0}
            max={400}
            step={1}
            onChange={(cornerRadius) => patch({ cornerRadius }, "Corner radius")}
            format={(v) => v.toFixed(0)}
          />
        </FieldRow>
      ) : null}
      {clip.shape === "star" || clip.shape === "polygon" ? (
        <FieldRow label="Points">
          <NumberField
            value={clip.points ?? (clip.shape === "star" ? 5 : 6)}
            min={3}
            max={24}
            onChange={(points) => patch({ points }, "Points")}
          />
        </FieldRow>
      ) : null}
      <FieldRow label="Draw on" hint="How much of the outline is drawn — keyframe it for draw-on animations">
        <SliderField
          value={draw}
          min={0}
          max={1}
          onChange={(v) => setValue(clip.id, "drawProgress", v, "Draw progress")}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <KeyframeButton state={keyframeState(clip, "drawProgress", frame)} onClick={() => toggleKeyframe(clip.id, "drawProgress", draw)} />
      </FieldRow>
    </Section>
  );
};

export const BackgroundSection: React.FC<{ clip: BackgroundClip }> = ({ clip }) => (
  <Section title="Background">
    <FillEditor
      fill={clip.fill}
      onChange={(fill) => fill && run("Background fill", (d) => updateClip(d, clip.id, { fill }, { actor: USER }), `bg:${clip.id}`)}
    />
  </Section>
);
