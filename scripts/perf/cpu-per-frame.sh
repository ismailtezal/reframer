#!/bin/bash
# CPU milliseconds (all cores) per rendered frame, per layer type. Needs the app server at $BASE.
# usage: BASE=http://localhost:3000 bash scripts/perf/cpu-per-frame.sh <projectId> all video text ...
proj=$1; shift
for only in "$@"; do
  extra=(); [ "$only" != all ] && extra=(--only="$only")
  node scripts/perf/render-bench.mjs "$proj" --base="$BASE" --seconds="${SECS:-20}" --json='{"settings":{"parallelism":4,"includeAudio":false}}' "${extra[@]}" 2>&1 | tail -1 |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(process.argv[1].padEnd(10),"fps",r.renderFps,"steady",r.steadyFps,"cpu-ms/frame",r.cpuMsPerFrame,"cpu%",r.cpuAvg)})' "$only"
done
