// Local build helper. Outlines the locally installed Avenir Next; embeds no font.
import Foundation
import CoreText
import CoreGraphics

let font = CTFontCreateWithName("AvenirNext-DemiBold" as CFString, 72, nil)
let source = NSAttributedString(string: "Scam Shield", attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
let line = CTLineCreateWithAttributedString(source)
let cap = CTFontGetCapHeight(font)
func n(_ x: CGFloat) -> String { String(format: "%.3f", Double(x)) }
var outlines: [String] = []
for run in CTLineGetGlyphRuns(line) as! [CTRun] {
    let count = CTRunGetGlyphCount(run)
    var glyphs = [CGGlyph](repeating: 0, count: count)
    var positions = [CGPoint](repeating: .zero, count: count)
    CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
    CTRunGetPositions(run, CFRange(location: 0, length: 0), &positions)
    for i in 0..<count {
        guard let path = CTFontCreatePathForGlyph(font, glyphs[i], nil) else { continue }
        var d = ""
        func p(_ pt: CGPoint) -> String { "\(n(pt.x + positions[i].x)) \(n(cap - pt.y - positions[i].y))" }
        path.applyWithBlock { element in
            let e = element.pointee
            switch e.type {
            case .moveToPoint: d += "M\(p(e.points[0]))"
            case .addLineToPoint: d += "L\(p(e.points[0]))"
            case .addQuadCurveToPoint: d += "Q\(p(e.points[0])) \(p(e.points[1]))"
            case .addCurveToPoint: d += "C\(p(e.points[0])) \(p(e.points[1])) \(p(e.points[2]))"
            case .closeSubpath: d += "Z"
            @unknown default: break
            }
        }
        outlines.append(d)
    }
}
let result: [String: Any] = ["paths": outlines, "width": CTLineGetTypographicBounds(line, nil, nil, nil), "capHeight": cap, "font": CTFontCopyPostScriptName(font) as String]
let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
let destination = URL(fileURLWithPath: CommandLine.arguments[1])
try data.write(to: destination)
print("Outlined \(outlines.count) glyphs from \(CTFontCopyPostScriptName(font)); cap height \(n(cap))")
