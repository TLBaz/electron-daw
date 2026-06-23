import json
import os
import sys


def _resolve_device(requested: str) -> str:
    try:
        import torch
    except Exception:
        return "cpu"

    if requested == "cuda" and torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _run_musicgen(payload: dict) -> dict:
    try:
        import numpy as np
        from scipy.io import wavfile
        import torch
        from transformers import AutoProcessor, MusicgenForConditionalGeneration
    except Exception as exc:
        raise RuntimeError(
            "Missing Python deps for MusicGen. Install with: "
            "pip install torch torchaudio transformers accelerate scipy sentencepiece"
        ) from exc

    prompt = payload.get("prompt", "electronic groove")
    model_id = payload.get("model", os.getenv("MUSICGEN_MODEL", "facebook/musicgen-large"))
    duration = float(payload.get("duration", 8))
    device = _resolve_device(str(payload.get("device", os.getenv("MUSICGEN_DEVICE", "cuda"))).lower())
    seed = payload.get("seed")

    if seed is not None:
        try:
            torch.manual_seed(int(seed))
        except Exception:
            pass

    processor = AutoProcessor.from_pretrained(model_id)
    model = MusicgenForConditionalGeneration.from_pretrained(model_id)
    model.to(device)
    model.eval()

    inputs = processor(text=[prompt], padding=True, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}

    max_new_tokens = int(payload.get("max_new_tokens", max(64, int(duration * 50))))
    generate_kwargs = {
        "max_new_tokens": max_new_tokens,
        "do_sample": True,
    }
    if payload.get("top_k") is not None:
        generate_kwargs["top_k"] = int(payload["top_k"])
    if payload.get("top_p") is not None:
        generate_kwargs["top_p"] = float(payload["top_p"])
    if payload.get("temperature") is not None:
        generate_kwargs["temperature"] = float(payload["temperature"])
    if payload.get("cfg_coef") is not None:
        generate_kwargs["guidance_scale"] = float(payload["cfg_coef"])

    with torch.no_grad():
        wav = model.generate(**inputs, **generate_kwargs)

    audio = wav[0, 0].detach().cpu().numpy()
    audio = np.clip(audio, -1.0, 1.0)
    audio_i16 = (audio * 32767.0).astype(np.int16)

    output_path = payload["outputPath"]
    final_output_path = output_path if output_path.lower().endswith(".wav") else f"{output_path}.wav"
    sampling_rate = int(model.config.audio_encoder.sampling_rate)
    wavfile.write(final_output_path, sampling_rate, audio_i16)

    return {
        "ok": True,
        "provider": "huggingface-musicgen",
        "prompt": prompt,
        "duration": duration,
        "model": model_id,
        "device": device,
        "samplingRate": sampling_rate,
        "maxNewTokens": max_new_tokens,
        "outputPath": final_output_path,
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("Missing JSON payload", file=sys.stderr)
        return 1

    payload = json.loads(sys.argv[1])
    output_path = payload.get("outputPath")

    if not output_path:
        print("outputPath is required", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    try:
        result = _run_musicgen(payload)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
