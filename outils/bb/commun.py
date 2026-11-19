# Outil : fabrique les fiches « Brevet blanc » (socle/bb/<matière>.json + socle/index.json)
# Syntaxe légère dans les textes : **gras**  ==surligné==  [def]…  [ex]…  [att]…  [astuce]…  [meth]…
import html, re

MAT = {"francais": "Français", "maths": "Maths", "histoire": "Histoire-Géo", "emc": "EMC", "svt": "SVT", "techno": "Technologie"}
TAGS = {"def": "Définition :", "ex": "Exemple :", "att": "Attention :", "astuce": "Astuce :", "meth": "Méthode :", "brevet": "Au brevet :", "date": "Repère :"}

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"==(.+?)==", r"<mark>\1</mark>", t)
    return t

def para(p):
    m = re.match(r"^\[(\w+)\]\s*(.*)$", p, re.S)
    if m and m.group(1) in TAGS:
        return "<p><b>" + TAGS[m.group(1)] + "</b> " + inline(m.group(2)) + "</p>"
    if p.startswith("- "):
        items = [x[2:] for x in p.split("\n") if x.startswith("- ")]
        return "<ul>" + "".join("<li>" + inline(i) + "</li>" for i in items) + "</ul>"
    return "<p>" + inline(p) + "</p>"

def fiche(sid, n, title, diff, retenir, sections, quiz):
    h = ["<h2>" + inline(title) + "</h2>", "<p>Fiche de révision · Brevet blanc n°1 · " + MAT[sid] + " · 3e</p>",
         "<blockquote><b>À retenir :</b> " + inline(retenir) + "</blockquote>"]
    for i, (h3, ps) in enumerate(sections, 1):
        h.append("<h3>" + str(i) + ". " + inline(h3) + "</h3>")
        h += [para(p) for p in ps]
    qs = []
    for q in quiz:
        qq, opts, c, ex = q
        assert 0 <= c < len(opts), (title, qq)
        qs.append({"type": "single", "q": qq, "options": opts, "correct": c, "explain": ex})
    fid = "sc-bb-" + sid + "-" + str(n).zfill(2)
    return fid, {"title": title, "format": "html", "difficulty": diff, "content": "".join(h), "quiz": qs}
