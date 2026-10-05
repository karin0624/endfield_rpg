"""Direct, unregistered pixel comparison against the fixed approved UI images.

Requires Pillow. No rescaling, alignment, color correction or acceptance thresholds.
Diagnostic rectangles never exclude pixels from the whole-image result.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat, __version__ as pillow_version

parser = argparse.ArgumentParser()
parser.add_argument("runtime", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--metrics-only", action="store_true", help="Keep the same metrics without encoding diagnostic PNG exports")
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
references = {
    "departure": "departure-hp-v1.webp",
    "selection": "selection-quick-v2.webp",
    "disabled": "departure-all-zero-disabled-v1.webp",
    "symptoms": "selection-fatigue-daze-v1.webp",
}

def metrics(diff, mask=None):
    channels = diff.split()
    nonzero = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2]).point(lambda x: 255 if x else 0)
    if mask is not None:
        nonzero = ImageChops.multiply(nonzero, mask)
    total = mask.histogram()[255] if mask is not None else diff.width * diff.height
    changed = nonzero.histogram()[255]
    return {"pixels": total, "different_pixels": changed,
            "different_fraction": changed / total if total else None,
            "mean_absolute_rgb_error": ImageStat.Stat(diff, mask).mean}

for state, file in references.items():
    reference = repo / "docs/ui-concepts/approved" / file
    candidates = list(args.runtime.rglob(f"approved-{state}.png"))
    if len(candidates) != 1:
        raise ValueError(f"Expected one runtime for {state}, got {candidates}")
    runtime = candidates[0]
    approved = Image.open(reference).convert("RGB")
    actual = Image.open(runtime).convert("RGB")
    if approved.size != actual.size or approved.size != (1672, 941):
        raise ValueError(f"Same native resolution required: {state}: {approved.size}, {actual.size}")
    out = args.output / state
    out.mkdir(parents=True, exist_ok=True)
    if not args.metrics_only:
        approved.save(out / "approved.png")
        actual.save(out / "runtime.png")
        Image.blend(approved, actual, .5).save(out / "overlay-50.png")
    diff = ImageChops.difference(approved, actual)
    if not args.metrics_only:
        diff.save(out / "raw-diff.png")
    note = Image.new("L", approved.size)
    ImageDraw.Draw(note).rectangle((1510, 12, 1664, 44), fill=255)
    if not args.metrics_only:
        note.save(out / "allowed-annotation-mask.png")
    invariant = ImageChops.invert(note)
    if not args.metrics_only:
        ImageChops.multiply(diff, invariant.convert("RGB")).save(out / "invariant-ui-diff.png")
    if not args.metrics_only:
        map_image = actual.copy()
        draw = ImageDraw.Draw(map_image)
        draw.rectangle((1510, 12, 1664, 44), outline="#ffcc00", width=2)
    diagnostics = ([("title", (145, 140, 445, 204)), ("card-frames", (165, 263, 770, 733)),
                    ("portraits", (184, 279, 750, 609)), ("name-hp-detail", (184, 610, 750, 720)),
                    ("panel-right", (780, 218, 1574, 785)), ("footer", (70, 787, 1600, 890))]
                   if state in ("selection", "symptoms") else
                   [("title", (60, 45, 320, 115)), ("portraits", (210, 260, 850, 710)),
                    ("name-hp", (270, 715, 810, 803)), ("empty-frames", (895, 318, 1428, 700)),
                    ("primary", (1280, 800, 1642, 893)), ("back", (58, 836, 262, 891))])
    records = []
    for label, box in diagnostics:
        region = Image.new("L", approved.size)
        ImageDraw.Draw(region).rectangle(box, fill=255)
        records.append({"label": label, "rectangle": box, "metrics": metrics(diff, region)})
        if not args.metrics_only:
            draw.rectangle(box, outline="#ff50c0", width=2)
            draw.text((box[0] + 3, box[1] + 3), label, fill="#ffffff", stroke_width=1, stroke_fill="#000000")
    if not args.metrics_only:
        map_image.save(out / "diagnostic-regions.png")
    (out / "results.json").write_text(json.dumps({
        "status": "REVIEW_REQUIRED: diagnostic differences, no zero-diff acceptance threshold", "resolution": approved.size,
        "tool": "Pillow " + pillow_version, "threshold": 0, "transforms": [],
        "reference": str(reference.relative_to(repo)), "reference_sha256": hashlib.sha256(reference.read_bytes()).hexdigest(),
        "runtime_sha256": hashlib.sha256(runtime.read_bytes()).hexdigest(),
        "full": metrics(diff), "invariant": metrics(diff, invariant), "annotation": metrics(diff, note),
        "allowed_regions": [{"rectangle": [1510,12,1664,44], "reason": "資料注記のみ。runtimeには表示しない。",
                             "approval": "docs/ui-concepts/approved/README.md; Slack 1791028085.252249"}],
        "diagnostics": records,
        "review_policy": {
            "reject": "Unexplained or unagreed meaningful changes to composition, information, positions, frames or material.",
            "permitted_residuals": ["Font raster/typeface differences tracked as shared typography work.", "Minor differences from existing character artwork; approval Slack 1791030923.386299."],
            "note": "Permitted residuals remain in raw differences and are not masked. Position/size/composition changes still require review."
        },
        "diagnostic_limit": "Rectangles may include multiple causes. They are not acceptance masks; all pixels remain in full and invariant metrics.",
    }, ensure_ascii=False, indent=2) + "\n")
    print(state, metrics(diff))
