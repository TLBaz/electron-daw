import json
import os
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("Missing JSON payload", file=sys.stderr)
        return 1

    payload = json.loads(sys.argv[1])
    output_path = payload.get("outputPath")
    prompt = payload.get("prompt", "ambient pad texture")
    style = payload.get("style", "ambient")

    if not output_path:
        print("outputPath is required", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Replace this placeholder with real Riffusion generation call.
    # Wire your cloned riffusion pipeline to save generated WAV to output_path.

    with open(output_path, "wb") as f:
        f.write(b"")

    print(json.dumps({
        "ok": True,
        "provider": "riffusion",
        "prompt": prompt,
        "style": style,
        "outputPath": output_path,
        "note": "Placeholder output. Wire real Riffusion inference in this script."
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
