"""Build the HTML e-mails of the PILOTA90 November campaign from emails.json.

Usage: python3 build.py  ->  writes html/<id>.html (inline styles, table layout, 600 px).
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
CAMPAIGN = "reprise_nov26"
URLS = {
    "STRESS_URL": "https://pilota90.com/products/pilota90-stress-anxiete-de-competition",
    "PARENT_URL": "https://pilota90.com/products/parent-dathlete-la-methode-complete",
}

NAVY = "#10213d"
GREEN = "#1f8a4c"
INK = "#1d2433"
MUTED = "#5b6475"


def utm(url: str, content: str) -> str:
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}utm_source=email&utm_medium=email&utm_campaign={CAMPAIGN}&utm_content={content}"


def inline(text: str, eid: str) -> str:
    """Escape, then apply **bold**, [label](url) and the Liquid first-name tag."""
    keep = "{{ first_name | default: '' }}"
    text = text.replace(keep, "\x00")
    for key, url in URLS.items():
        text = text.replace("{{" + key + "}}", url)
    out = html.escape(text, quote=False)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(
        r"\[(.+?)\]\((https?://[^)]+)\)",
        lambda m: f'<a href="{utm(m.group(2), eid + "_lien")}" style="color:{GREEN};font-weight:bold;">{m.group(1)}</a>',
        out,
    )
    return out.replace("\x00", keep).replace("\n", "<br>")


def block(par: str, eid: str) -> str:
    p = f'margin:0 0 16px;font-size:16px;line-height:1.6;color:{INK};'
    if par.startswith("> "):
        return (
            f'<p style="margin:0 0 16px;padding:14px 18px;border-left:4px solid {GREEN};background:#f1f7f3;'
            f'font-size:18px;line-height:1.5;color:{NAVY};font-weight:bold;">{inline(par[2:], eid)}</p>'
        )
    if par.startswith("- "):
        items = "".join(
            f'<li style="margin:0 0 8px;">{inline(line[2:], eid)}</li>' for line in par.split("\n")
        )
        return f'<ul style="{p}padding-left:22px;">{items}</ul>'
    return f'<p style="{p}">{inline(par, eid)}</p>'


def render(e: dict) -> str:
    eid = e["id"]
    image = ""
    if e["image"]:
        image = (
            f'<tr><td style="padding:0 32px 8px;" align="center"><a href="{utm(e["cta_url"], eid + "_image")}">'
            f'<img src="{e["image"]}" alt="{html.escape(e["image_alt"])}" width="300" '
            f'style="display:block;width:300px;max-width:100%;height:auto;border:0;"></a></td></tr>'
        )
    body = "".join(block(par, eid) for par in e["body"])
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(e["subject"])}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f5;">
<div style="display:none;max-height:0;overflow:hidden;">{html.escape(e["preview"])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="background:{NAVY};padding:22px 32px;" align="center">
<span style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#ffffff;">PILOTA<span style="color:#4cd38a;">90</span></span>
</td></tr>
<tr><td style="height:24px;"></td></tr>
{image}
<tr><td style="padding:8px 32px 0;">{body}</td></tr>
<tr><td style="padding:8px 32px 28px;" align="center">
<a href="{utm(e["cta_url"], eid + "_bouton")}" style="display:inline-block;background:{GREEN};color:#ffffff;text-decoration:none;font-size:17px;font-weight:bold;padding:16px 28px;border-radius:8px;">{html.escape(e["cta_text"])}</a>
</td></tr>
<tr><td style="padding:0 32px 8px;">
<p style="margin:0 0 6px;font-size:16px;line-height:1.6;color:{INK};">À samedi au bord du terrain,</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:{INK};"><strong>Aimane</strong>, PILOTA90</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:{MUTED};"><strong>P.-S.</strong> {inline(e["ps"], eid)}</p>
</td></tr>
<tr><td style="background:#f6f7f9;padding:18px 32px;font-size:12px;line-height:1.5;color:{MUTED};" align="center">
PILOTA90, guides de préparation mentale pour jeunes sportifs. Marque indépendante.<br>
<a href="https://pilota90.com" style="color:{MUTED};">pilota90.com</a> · contact@pilota90.com<br>
Vous recevez cet e-mail parce que vous êtes inscrit(e) à la newsletter PILOTA90.
<a href="{{{{ unsubscribe_link }}}}" style="color:{MUTED};">Se désinscrire</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
"""


def main() -> None:
    emails = json.loads((ROOT / "emails.json").read_text(encoding="utf-8"))
    out = ROOT / "html"
    out.mkdir(exist_ok=True)
    for e in emails:
        (out / f"{e['id']}.html").write_text(render(e), encoding="utf-8")
        print(f"html/{e['id']}.html  ({len(e['subject'])} car.)  {e['subject']}")


if __name__ == "__main__":
    main()
