# AI Workflows

This folder contains small, composable orchestration helpers that translate DAW user intents
(e.g. “make a trap drum pattern”, “generate an 8-bar melody”) into calls to the AI adapters
and theory/sequencer services.

All workflows:
- are callable from Node.js (main process / IPC / agents)
- return plain JSON objects or disk output paths for audio
- do not embed audio blobs in MongoDB (metadata only)
