#!/usr/bin/env python3
"""
Extrait le calendrier officiel d'un club depuis SportCorico (pages publiques club + équipe).

Respect du site :
  * seules les pages /clubs/... sont lues (robots.txt interdit /match/ aux robots : jamais explorées) ;
  * 1 requête toutes les 2 s, User-Agent explicite, aucune donnée de joueur n'est lue ni stockée
    (uniquement équipe, compétition, adversaire, date, heure, score) ;
  * pas de contournement : en cas d'erreur HTTP on s'arrête.

Usage :  python3 sportcorico_sync.py a-s-lieusaint-football > calendrier.json
         python3 sportcorico_sync.py a-s-lieusaint-football --self-test      (tests du parseur)
Dépendances : bibliothèque standard uniquement.
"""
import html, json, re, sys, time, urllib.request, datetime

BASE = "https://www.sportcorico.com"
UA = "AS-Lieusaint-calendar-sync/1.0 (outil interne du club ; contact : direction technique)"
DELAY = 2.0

def fetch(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA, "Accept-Language": "fr"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

def tokens(block):
    block = re.sub(r"<script.*?</script>|<style.*?</style>", "", block, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", "|", block))
    return [t.strip() for t in text.split("|") if t.strip()]

DATE = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")
TIME = re.compile(r"^(\d{2}):(\d{2})$")
NUM = re.compile(r"^\d{1,2}$")
NOISE = re.compile(r"^(live|en direct|publicité|terminé|prochain match|dernier match)", re.I)
STOPS = ("publicité", "Stats de la saison", "Dirigeants & éducateurs")

def parse_block(block, our_marker):
    """Retourne (match|None, bye|None, raison_si_ignoré).
    status : scheduled (heure connue) | played (score) | forfeit (« F ») ; « Exempt » => bye (pas de match)."""
    mid = re.match(r'<div class="match-(\d+)"', block).group(1)
    t = tokens(block)
    cut = [t.index(x) for x in STOPS if x in t and t.index(x) > 4]
    if cut: t = t[:min(cut)]
    t = [x for x in t if not NOISE.match(x)]
    di = next((i for i, x in enumerate(t) if DATE.match(x)), None)
    if di is None or di < 2 or di + 1 >= len(t):
        return None, None, f"structure inattendue : {t[:8]}"
    d, m, y = DATE.match(t[di]).groups()
    forfeit = None
    head = t[:di]
    if head and head[-1] == "F":                       # « Équipe F  date » : l'équipe à domicile déclare forfait
        forfeit, head = "home", head[:-1]
    if len(head) < 2:
        return None, None, f"structure inattendue : {t[:8]}"
    competition, home = " ".join(head[:-1]), head[-1]
    rest, hs, as_, ko = t[di + 1:], None, None, None
    if rest and TIME.match(rest[0]):
        ko = rest[0]; rest = rest[1:]
    elif len(rest) >= 3 and NUM.match(rest[0]) and rest[1] == "-" and NUM.match(rest[2]):
        hs, as_ = int(rest[0]), int(rest[2]); rest = rest[3:]
    elif rest and rest[0] == "-":                      # pas de score : repos, forfait…
        rest = rest[1:]
        if rest and rest[0] == "F":
            forfeit, rest = "away", rest[1:]
    else:
        return None, None, f"ni heure ni score : {t[:10]}"
    rest = [x for x in rest if not re.match(r"^(TABS|T\.A\.B)", x, re.I)]
    if not rest:
        return None, None, f"adversaire manquant : {t[:10]}"
    away = rest[0]
    iso = f"{y}-{m}-{d}"
    if "Exempt" in (home, away):
        return None, {"external_id": mid, "competition": competition, "date": iso}, None
    home_is_us = our_marker.lower() in home.lower()
    away_is_us = our_marker.lower() in away.lower()
    if home_is_us == away_is_us:
        return None, None, f"équipe du club non identifiable : {home} / {away}"
    if forfeit and hs is None and ko is None:
        status = "forfeit"
    elif hs is not None:
        status = "played"
    elif ko is not None:
        status = "scheduled"
    else:
        return None, None, f"statut indéterminé : {t[:10]}"
    return {
        "external_id": mid, "competition": competition, "date": iso,
        "time": ko,                       # None = heure inconnue (matchs passés)
        "home": home, "away": away, "home_is_us": home_is_us,
        "opponent": away if home_is_us else home,
        "score_home": hs, "score_away": as_,
        "status": status,
        "forfeit_by_us": None if not forfeit else (forfeit == "home") == home_is_us,
    }, None, None

def parse_team_page(page, our_marker):
    title = html.unescape(re.search(r"<title>(.*?)</title>", page).group(1))
    label = re.sub(r"^.*?Football\s+", "", title.split(":")[0]).strip()
    blocks = re.split(r'(?=<div class="match-\d+")', page)[1:]
    out, byes, ignored = [], [], []
    for b in blocks:
        m, bye, why = parse_block(b, our_marker)
        if m: out.append(m)
        elif bye: byes.append(bye)
        else: ignored.append(why)
    return label, out, byes, ignored

def main(club_slug, our_marker="Lieusaint Foot AS"):
    club = fetch(f"/clubs/{club_slug}")
    paths = sorted(set(re.findall(rf'href="(/clubs/{re.escape(club_slug)}/[^"#?]+)"', club)))
    teams, season = [], re.search(r"Saison\s*\n?\s*(\d{4} - \d{4})", html.unescape(re.sub(r"<[^>]+>", "\n", club)))
    for p in paths:
        time.sleep(DELAY)
        label, matches, byes, ignored = parse_team_page(fetch(p), our_marker)
        teams.append({"external_key": p.rsplit("/", 1)[1], "label": label, "matches": matches, "byes": byes, "ignored": ignored})
        print(f"  {label}: {len(matches)} matchs, {len(byes)} repos, {len(ignored)} non reconnus", file=sys.stderr)
    json.dump({"source": "sportcorico", "club": club_slug, "season": season.group(1) if season else None,
               "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
               "teams": teams}, sys.stdout, ensure_ascii=False, indent=1)

def self_test():
    def blk(i, *spans): return f'<div class="match-{i}"><div>' + "</div><span>".join(spans) + "</span></div>"
    P = lambda b: parse_block(b, "Lieusaint Foot AS")
    ok   = P(blk(1, "Anciens R1", "Lieusaint Foot AS 1", "13/09/2026", "5", "-", "0", "Rungis US 1"))[0]
    up   = P(blk(2, "SENIORS D3", "Servon FC 2", "13/12/2026", "15:30", "Lieusaint Foot AS 1"))[0]
    tabs = P(blk(3, "COUPE 77", "V.F.FA 77 1", "15/11/2026", "1", "-", "1", "TABS : 5 - 4", "Lieusaint Foot AS 1"))[0]
    live = P(blk(4, "SENIORS D3", "Live terminé", "Vaux la Rochette 2", "04/10/2026", "0", "-", "2", "Lieusaint Foot AS 1"))[0]
    nxt  = P(blk(7, "PROCHAIN MATCH", "U16 D3", "Lieusaint Foot AS 2", "22/11/2026", "15:00", "Val de Marne 1"))[0]
    f_aw = P(blk(8, "Futsal R3", "Lieusaint Foot AS 1", "19/09/2026", "-", "F", "Piment Noir 1"))[0]
    f_hm = P(blk(9, "Futsal R3", "Piment Noir 1", "F", "14/05/2027", "-", "Lieusaint Foot AS 1"))[0]
    bye  = P(blk(10, "CRITERIUM 55 ANS", "Exempt", "22/11/2026", "-", "Lieusaint Foot AS 10"))
    bad  = P(blk(5, "X", "Autre FC", "01/01/2027", "15:00", "Encore Autre"))
    assert ok["opponent"] == "Rungis US 1" and ok["score_home"] == 5 and ok["time"] is None and ok["status"] == "played"
    assert up["home_is_us"] is False and up["time"] == "15:30" and up["opponent"] == "Servon FC 2" and up["status"] == "scheduled"
    assert tabs["opponent"] == "V.F.FA 77 1" and tabs["score_away"] == 1
    assert live["opponent"] == "Vaux la Rochette 2" and live["score_home"] == 0 and live["score_away"] == 2
    assert nxt["competition"] == "U16 D3" and nxt["time"] == "15:00"
    assert f_aw["status"] == "forfeit" and f_aw["forfeit_by_us"] is False and f_aw["opponent"] == "Piment Noir 1"
    assert f_hm["status"] == "forfeit" and f_hm["forfeit_by_us"] is False and f_hm["opponent"] == "Piment Noir 1"
    assert bye[0] is None and bye[1]["date"] == "2026-11-22" and bye[2] is None
    assert bad[0] is None and "non identifiable" in bad[2]
    print("self-test OK")

if __name__ == "__main__":
    if "--self-test" in sys.argv: self_test()
    else: main(sys.argv[1])
