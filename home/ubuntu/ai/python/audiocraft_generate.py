import json
import os
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("Missing JSON payload", file=sys.stderr)
        return 1

    payload = json.loads(sys.argv[1])
    output_path = payload.get("outputPath")
    prompt = payload.get("prompt", "electronic groove")
    duration = int(payload.get("duration", 8))

    if not output_path:
        print("outputPath is required", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Replace this placeholder block with real MusicGen generation call.
    # Example integration path:
    # from audiocraft.models import MusicGen
    # model = MusicGen.get_pretrained(payload.get("model", "facebook/musicgen-medium"))
    # model.set_generation_params(duration=duration)
    # wav = model.generate([prompt])
    # audiocraft.data.audio.audio_write(output_path_without_ext, wav[0].cpu(), model.sample_rate, strategy="loudness")

    # Placeholder file write so Node pipeline has deterministic output during scaffold.
    with open(output_path, "wb") as f:
        f.write(b"")

    print(json.dumps({
        "ok": True,
        "provider": "audiocraft",
        "prompt": prompt,
        "duration": duration,
        "outputPath": output_path,
        "note": "Placeholder output. Wire real MusicGen inference in this script."
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
