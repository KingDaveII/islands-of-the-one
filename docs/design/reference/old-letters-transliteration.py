"""Reference transliteration: a typed Name -> the Old Letters (LORE; book: Lore tab, §4.5 "Hearing a Name").

Usage: python3 old-letters-transliteration.py packages/shared/data/safe-letters.json "Black Rock" Maya

Not production code. MAIN implements it in TypeScript (packages/shared);
this file fixes the rules and produces the worked examples in the book.
The filter check reads the repo's safe-letters.json (alphabet positions only).
"""
import json, sys, unicodedata

ALEPHBET = "אבגדהוזחטיכלמנסעפצקרשת"
FINAL = {"כ": "ך", "מ": "ם", "נ": "ן", "פ": "ף", "צ": "ץ"}
BASE = {v: k for k, v in FINAL.items()}

LATIN_FOLD = {"ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "å": "o", "ð": "th",
              "þ": "th", "ñ": "ny", "ç": "s", "ý": "y", "ÿ": "y"}
VOWELS = set("aeiou")

# Vowel units, longest first: (latin, class). a = open (unwritten inside a word),
# i = front (yod), o = round (vav).
VOWEL_UNITS = [("ee", "i"), ("ea", "i"), ("ie", "i"), ("ei", "i"), ("ey", "i"),
               ("ay", "i"), ("ai", "i"), ("oo", "o"), ("ou", "o"), ("au", "o"),
               ("aw", "o"), ("ow", "o"), ("oa", "o"),
               ("a", "a"), ("e", "a"), ("i", "i"), ("o", "o"), ("u", "o")]
# Consonants, longest first.
CONSONANTS = [("tsch", "צ"), ("tch", "צ"), ("sch", "ש"), ("sh", "ש"), ("ch", "ח"),
              ("kh", "כ"), ("ph", "פ"), ("th", "ת"), ("gh", "ג"), ("ck", "ק"),
              ("qu", "קו"), ("ts", "צ"), ("tz", "צ"), ("cz", "צ"), ("zh", "ז"),
              ("b", "ב"), ("d", "ד"), ("f", "פ"), ("g", "ג"), ("h", "ה"),
              ("j", "ג"), ("k", "ק"), ("l", "ל"), ("m", "מ"), ("n", "נ"),
              ("p", "פ"), ("q", "ק"), ("r", "ר"), ("s", "ס"), ("t", "ט"),
              ("v", "ב"), ("w", "ו"), ("x", "קס"), ("y", "י"), ("z", "ז")]
INITIAL = {"a": "א", "i": "אי", "o": "או"}
MEDIAL = {"a": "", "i": "י", "o": "ו"}
FINALV = {"a": "ה", "i": "י", "o": "ו"}


def fold(name):
    out = ""
    for ch in name.lower():
        ch = LATIN_FOLD.get(ch, ch)
        ch = "".join(c for c in unicodedata.normalize("NFKD", ch) if not unicodedata.combining(c))
        out += ch
    return out


def words_of(name):
    """Words of Latin letters or Old Letters; spaces and hyphens split, the rest is dropped."""
    words, cur = [], ""
    for ch in fold(name):
        if ch in " -\t":
            if cur: words.append(cur); cur = ""
        elif ("a" <= ch <= "z") or ch in ALEPHBET or ch in BASE:
            cur += BASE.get(ch, ch)
        # anything else (digits, apostrophes, dots) is dropped
    if cur: words.append(cur)
    return words


def is_vowel_at(w, i):
    """y and w are vowels when no vowel follows them (y also as the only letter)."""
    c = w[i]
    if c in VOWELS: return True
    if c in "yw":
        nxt = w[i + 1] if i + 1 < len(w) else ""
        if c == "w" and (i == 0 or w[i - 1] not in VOWELS): return False
        return nxt not in VOWELS
    return False


def word_letters(w):
    """One word -> list of (letter, from_vowel)."""
    if any(c in ALEPHBET for c in w):           # typed in the Old Letters: kept as typed (strict check refuses)
        return [(c, False) for c in w if c in ALEPHBET]
    # collapse doubled consonants (vowel pairs are units)
    s = ""
    for c in w:
        if s and c == s[-1] and c not in VOWELS: continue
        s += c
    w = s
    # a word-final h after a vowel is silent
    silent_h = len(w) >= 2 and w[-1] == "h" and (w[-2] in VOWELS)
    if silent_h: w = w[:-1]
    units, i = [], 0
    while i < len(w):
        if is_vowel_at(w, i):
            for lat, cls in VOWEL_UNITS:
                if w.startswith(lat, i):
                    # a y or w closing a vowel pair stays a consonant before a vowel
                    if len(lat) == 2 and lat[1] in "yw" and i + 2 < len(w) and w[i + 2] in VOWELS:
                        continue
                    units.append(("V", cls)); i += len(lat); break
            else:  # vocalic y / w
                units.append(("V", "i" if w[i] == "y" else "o")); i += 1
            continue
        if w[i] == "c":
            nxt = w[i + 1] if i + 1 < len(w) else ""
            if nxt in "eiy": units.append(("C", "ס")); i += 1; continue
        for lat, heb in CONSONANTS:
            if w.startswith(lat, i):
                units.append(("C", heb)); i += len(lat); break
        else:
            i += 1  # 'c' handled above; nothing else falls through
    out = []
    for k, (kind, val) in enumerate(units):
        if kind == "C":
            out += [(c, False) for c in val]
        else:
            if k == 0: s = INITIAL[val]
            elif k == len(units) - 1: s = FINALV[val]
            else: s = MEDIAL[val]
            out += [(c, True) for c in s]
    # identical neighbours collapse when one of them is a vowel letter
    res = []
    for l in out:
        if res and res[-1][0] == l[0] and (l[1] or res[-1][1]):
            res[-1] = (l[0], res[-1][1] and l[1])
            continue
        res.append(l)
    return res


def close_doors(words):
    # yod-he and yod-yod never touch (ignoring spaces, either order)
    flat = [(wi, j) for wi, w in enumerate(words) for j in range(len(w))]
    changed = True
    while changed:
        changed = False
        flat = [(wi, j) for wi, w in enumerate(words) for j in range(len(w))]
        for (a, b), (c, d) in zip(flat, flat[1:]):
            x, y = words[a][b], words[c][d]
            if x[0] == y[0] == "י":
                k = (c, d) if words[c][d][1] else (a, b)
                del words[k[0]][k[1]]                        # two yods never touch
                changed = True
                break
            if {x[0], y[0]} == {"י", "ה"}:
                yod, he = ((a, b), (c, d)) if x[0] == "י" else ((c, d), (a, b))
                if words[yod[0]][yod[1]][1]:
                    del words[yod[0]][yod[1]]            # a vowel yod is left unwritten
                elif words[he[0]][he[1]][1]:
                    words[he[0]][he[1]] = ("א", True)    # a vowel he becomes aleph
                else:
                    words[he[0]][he[1]] = ("ח", False)   # a breathed h becomes het
                changed = True
                break


def transliterate(name, cap=12):
    words = [word_letters(w) for w in words_of(name)]
    words = [w for w in words if w]
    close_doors(words)
    # writing lean: over the cap, drop medial vowel letters from the end backwards
    def count(): return sum(len(w) for w in words)
    for wi in range(len(words) - 1, -1, -1):
        w = words[wi]
        j = len(w) - 2
        while count() > cap and j >= 1:
            if w[j][1] and w[j][0] in "יו": del w[j]
            j -= 1
    close_doors(words)
    words = [w for w in words if w]
    if sum(len(w) for w in words) == 1:
        words[0].insert(0, ("א", True))
    text = " ".join("".join(l for l, _ in w) for w in words)
    return text


def shaped(text):
    """With final forms, as the layout draws it."""
    return " ".join(w[:-1] + FINAL.get(w[-1], w[-1]) for w in text.split(" ") if w)


def positions(text):
    return [ALEPHBET.index(BASE.get(c, c)) for c in text if BASE.get(c, c) in ALEPHBET]


def safe(text, banned):
    p = positions(text)
    def has(run):
        for r in (run, run[::-1]):
            for i in range(len(p) - len(r) + 1):
                if p[i:i + len(r)] == r: return True
        return False
    return not any(has(r) for r in banned["hebrew"]["runs"] + banned["hebrew"]["strictPairs"])


if __name__ == "__main__":
    banned = json.load(open(sys.argv[1]))
    for n in sys.argv[2:]:
        t = transliterate(n)
        print(f"{n:20} {shaped(t):16} {len(positions(t)):2} {'ok' if safe(t, banned) else 'REFUSED'}")
