# AI Layer (Electron DAW)

This folder contains the modular AI production stack for the Electron + WebAudio DAW.

## Integration Status

The following repositories are integrated at scaffold level with runnable module entry points:

1. Meta Audiocraft (MusicGen) -> `ai/adapters/audiocraft.adapter.js`
2. Riffusion -> `ai/adapters/riffusion.adapter.js`
3. Magenta.js -> `ai/adapters/magenta.adapter.js`
4. Tone.js -> `ai/sequencers/tone-sequencer.service.js`
5. Scribbletune -> `ai/sequencers/scribbletune.service.js`
6. Tonal -> `ai/theory/tonal.service.js`
7. LangChain.js (local deterministic tool router) -> `ai/services/langchain-agent.service.js`
8. Local advisor service (no paid API required) -> `ai/services/local-advisor.service.js`
9. Meyda -> `ai/analysis/meyda-analyzer.service.js`
10. DSP.js -> `ai/analysis/dsp.service.js`

## Storage Policy

- Audio files are always generated to disk in `ai/outputs/`
- MongoDB should store metadata only (paths, tags, project linkage, config)
- Conversational/advisory features run in local no-cost mode by default

## Folder Structure

- `adapters/` provider-specific generation bridges
- `services/` runtime utilities and LLM services
- `agents/` command dispatchers
- `orchestration/` top-level use-case orchestration
- `sequencers/` Tone.js + Scribbletune sequencing services
- `theory/` tonal music theory helpers
- `analysis/` Meyda + DSP signal analysis helpers
- `python/` Python-side generators (Audiocraft + Riffusion)
- `renderer/` browser-side AI clients
- `outputs/` generated assets (wav/json)

## Python Setup (manual)

Audiocraft and Riffusion are called through Node child processes.

Example setup:

```bash
python -m venv .venv
. .venv/Scripts/activate
pip install torch torchaudio transformers accelerate scipy sentencepiece
# pip install -e ./external/riffusion
```

Recommended default for strong machines:

```bash
export MUSICGEN_MODEL=facebook/musicgen-large
export MUSICGEN_DEVICE=cuda
```

The Audiocraft adapter now defaults to `facebook/musicgen-large` and writes real generated wav output via `ai/python/audiocraft_generate.py` using Hugging Face Transformers MusicGen.

Then wire real inference logic inside:

- `ai/python/riffusion_generate.py`
