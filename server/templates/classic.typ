// Classic (kairos-single-v1): one column, ATS-safe, A4 or Letter. CISO mustFix 8: the only way user text gets in is the
// JSON string sys.inputs.data, and every value is placed as a string, so it can never become markup. No import, include,
// read or image here, and no show rule that matches text. The order on the page is resumePlainText's: the round trip
// (services/render.ts) checks that every line prints, in order.
#let d = json(bytes(sys.inputs.data))
#let accent = if d.accent != none { rgb(d.accent) } else { black }
#let compact = d.density == "compact"

#set document(title: d.name)
#set page(paper: if d.paper == "a4" { "a4" } else { "us-letter" }, margin: if compact { 1.5cm } else { 2cm })
// No hyphenation and no justification: a word stays whole in the text layer that an ATS reads.
#set text(font: "Libertinus Serif", size: if compact { 10pt } else { 11pt }, hyphenate: false, lang: "en")
#set par(justify: false, leading: 0.55em, spacing: 0.6em)
#set list(indent: 0.6em, spacing: 0.45em)

#if d.name != "" { text(size: 18pt, weight: "bold", fill: accent, d.name); parbreak() }
#if d.headline != none { text(size: 11pt, d.headline); parbreak() }
#if d.contact != "" { text(d.contact); parbreak() }

#for s in d.sections {
  v(0.5em)
  block(below: 0.4em, stroke: (bottom: 0.5pt + accent), inset: (bottom: 2pt), width: 100%, sticky: true, text(weight: "bold", fill: accent, s.title))
  for e in s.entries {
    if e.heading != "" { block(above: 0.6em, below: 0.3em, sticky: true, text(weight: "bold", e.heading)) }
    if e.lines.len() > 0 { list(..e.lines.map(l => [#l])) }
  }
}
