# Review Zen

Review Zen presents a code change as a guided review story. It keeps the source visible while it explains selected code and its test evidence.

## Language

**Review Stop**:
One behavior in one scenario within the guided review story.
_Avoid_: Tab, slide, lens

**Focus Block**:
One or more related source ranges that need one Language explanation and one Intent explanation.
_Avoid_: Selected line, line picker

**Source Frame**:
A stable source snapshot that contains enough code to understand one or more Review Stops.
_Avoid_: Live file, code pane

**Test Evidence**:
A test and its checks that support a claim about a Focus Block.
_Avoid_: Coverage, proof that a line is tested

**Evidence Marker**:
A source-gutter symbol that states the known relation between a Focus Block and Test Evidence.
_Avoid_: Coverage marker, tested line
