#!/usr/bin/env bash
# Rebuilds the pitch deck from docs/submission/template-base.pptx and exports the PDF with Microsoft PowerPoint.
# Usage: scripts/build-deck.sh [--no-pdf]
#   PYTHON=...      python with python-pptx, Pillow and qrcode (default: the deck virtualenv, else python3)
#   DECK_STAGE=dir  folder PowerPoint exports from. PowerPoint is sandboxed and asks "Grant File Access" for a folder it has
#                   not seen; point this at a folder it may already read (default: docs/submission itself).
# Run it again after eval/results/*.md or the demo video link change.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-/private/tmp/claude-501/deck-venv/bin/python}"
[ -x "$PYTHON" ] || PYTHON=python3
SUB="$ROOT/docs/submission"
PPTX="$SUB/Scam-Shield-deck.pptx"
PDF="$SUB/Scam-Shield-deck.pdf"
STAGE="${DECK_STAGE:-$SUB}"

"$PYTHON" "$ROOT/scripts/build-deck.py" "$SUB/template-base.pptx" "$PPTX"
[ "${1:-}" = "--no-pdf" ] && exit 0
# The submission PDF leaves out slide 2 (the organisers' "download this template" note). The PPTX keeps all 16 slides.
DROP="${DECK_DROP_SLIDE:-2}"

[ "$DROP" = "0" ] || [ "$STAGE" != "$SUB" ] || { echo "Dropping a slide needs DECK_STAGE set to another folder (it would overwrite the 16-slide PPTX)" >&2; exit 1; }
mkdir -p "$STAGE"
S_PPTX="$STAGE/Scam-Shield-deck.pptx"
S_PDF="$STAGE/Scam-Shield-deck.pdf"
if [ "$DROP" != "0" ]; then
  "$PYTHON" "$ROOT/scripts/drop-slide.py" "$PPTX" "$S_PPTX" "$DROP"
else
  [ "$S_PPTX" = "$PPTX" ] || cp "$PPTX" "$S_PPTX"
fi
rm -f "$S_PDF"
osascript \
  -e 'tell application "Microsoft PowerPoint"' \
  -e 'launch' \
  -e "open POSIX file \"$S_PPTX\"" \
  -e 'delay 5' \
  -e "save active presentation in POSIX file \"$S_PDF\" as save as PDF" \
  -e 'close active presentation saving no' \
  -e 'end tell'
[ -f "$S_PDF" ] || { echo "PDF export failed" >&2; exit 1; }
[ "$S_PDF" = "$PDF" ] || cp "$S_PDF" "$PDF"

PAGES="$(pdfinfo "$PDF" | awk '/^Pages:/ {print $2}')"
SIZE="$(stat -f %z "$PDF")"
echo "PDF: $PDF  pages=$PAGES  bytes=$SIZE"
EXPECT=16; [ "$DROP" = "0" ] || EXPECT=15
[ "$PAGES" = "$EXPECT" ] || { echo "expected $EXPECT pages, got $PAGES" >&2; exit 1; }
[ "$SIZE" -lt 5000000 ] || { echo "PDF is 5 MB or larger" >&2; exit 1; }
