#!/usr/bin/env python3
# Liest die BLS-4.0-Excel, ergänzt Portionsgrößen per kuratierten Regeln und
# schreibt public/bls-foods.json. Erneut ausführbar bei BLS-Updates.
import json, re, openpyxl, sys, os

SRC = "BLS_4_0_Daten_2025_DE.xlsx"
OUT = "public/bls-foods.json"

def P(*pairs):  # Portionsliste [[label, gramm], ...]
    return [[l, g] for l, g in pairs]

# Regeln: (keyword-regex, gruppe|None, portions, negativ-regex|None)
# Erste passende Regel gewinnt. gruppe = erster Buchstabe des BLS-Codes.
PROC = r"getrocknet|gefriergetr|pulver|mus|mark|saft|konzentrat|chips|püree|konserve|kompott|gedünstet|gebraten|gekocht|frittiert|tiefgefroren|nektar|sirup|likör|wein"
RULES = [
    # --- Obst (Gruppe F), nur rohe ganze Frucht ---
    (r"\bapfel\b",        "F", P(("1 Stück (mittel)",150),("1 Stück (groß)",200),("1 Stück (klein)",100)), PROC),
    (r"banane",           "F", P(("1 Stück (mittel)",120),("1 Stück (groß)",150)), PROC+r"|koch|chips"),
    (r"birne",            "F", P(("1 Stück",150),), PROC),
    (r"orange|apfelsine", "F", P(("1 Stück",130),), PROC),
    (r"mandarine|clementine","F", P(("1 Stück",70),), PROC),
    (r"zitrone",          "F", P(("1 Stück",60),), PROC),
    (r"pfirsich",         "F", P(("1 Stück",120),), PROC),
    (r"nektarine",        "F", P(("1 Stück",120),), PROC),
    (r"pflaume|zwetschge","F", P(("1 Stück",50),), PROC),
    (r"aprikose",         "F", P(("1 Stück",40),), PROC),
    (r"kiwi",             "F", P(("1 Stück",75),), PROC),
    (r"kirsche",          "F", P(("1 Handvoll",100),), PROC),
    (r"erdbeere",         "F", P(("1 Handvoll",100),("1 Schale",250)), PROC),
    (r"heidelbeere|blaubeere","F", P(("1 Handvoll",60),), PROC),
    (r"himbeere",         "F", P(("1 Handvoll",60),), PROC),
    (r"brombeere",        "F", P(("1 Handvoll",60),), PROC),
    (r"weintraube|\btraube","F", P(("1 Handvoll",80),), PROC),
    (r"ananas",           "F", P(("1 Scheibe",80),), PROC),
    (r"mango",            "F", P(("1/2 Stück",150),), PROC),
    (r"avocado",          "F", P(("1/2 Stück",100),("1 Stück",200)), PROC),
    (r"wassermelone",     "F", P(("1 Stück",200),), PROC),
    (r"honigmelone|melone","F", P(("1 Stück",150),), PROC),
    (r"dattel",           "F", P(("1 Stück",8),), None),
    (r"\bfeige",          "F", P(("1 Stück",50),), PROC),
    (r"granatapfel",      "F", P(("1/2 Stück",100),), PROC),
    (r"clementine",       "F", P(("1 Stück",60),), PROC),
    # --- Eier (Gruppe E) ---
    (r"hühnerei",         "E", P(("1 Stück (Größe M)",55),("1 Stück (Größe L)",63)), r"pulver|eigelb|eiklar|eiweiß|trocken|gekocht"),
    (r"eigelb",           "E", P(("1 Stück",18),), r"pulver|trocken"),
    (r"eiklar|eiweiß",    "E", P(("1 Stück",33),), r"pulver|trocken"),
    # --- Öle & Fette (Gruppe Q) ---
    (r"butter\b",         None, P(("1 Portion",10),("1 Teelöffel (TL)",5)), r"milch|käse|erdnuss|kakao"),
    (r"margarine",        None, P(("1 Portion",10),), None),
    (r"öl\b|öl$",         "Q", P(("1 Esslöffel (EL)",12),("1 Teelöffel (TL)",4)), None),
    # --- Brot & Backwaren (Gruppe B) ---
    (r"toast",            "B", P(("1 Scheibe",25),), None),
    (r"knäckebrot",       "B", P(("1 Scheibe",10),), None),
    (r"zwieback",         "B", P(("1 Stück",8),), None),
    (r"brötchen|semmel|schrippe","B", P(("1 Stück",60),), None),
    (r"baguette",         "B", P(("1 Stück",50),), None),
    (r"brot",             "B", P(("1 Scheibe",45),), r"mehl|krume|teig|frucht"),
    (r"croissant",        "B", P(("1 Stück",60),), None),
    # --- Milchprodukte (Gruppe M) ---
    (r"joghurt",          "M", P(("1 Becher",150),), r"pulver"),
    (r"speisequark|magerquark|quark","M", P(("1 Portion",250),), r"pulver"),
    (r"skyr",             "M", P(("1 Becher",150),), None),
    (r"hüttenkäse|körniger frischkäse","M", P(("1 Portion",100),), None),
    (r"frischkäse",       "M", P(("1 Portion",30),), None),
    (r"mozzarella",       "M", P(("1 Kugel",125),), None),
    (r"\bfeta",           "M", P(("1 Portion",50),), None),
    (r"parmesan",         "M", P(("1 Esslöffel (EL)",10),), None),
    (r"gouda|edamer|emmentaler|tilsiter|butterkäse|scheibletten|schnittkäse","M", P(("1 Scheibe",25),), None),
    (r"sahne|rahm",       "M", P(("1 Esslöffel (EL)",15),), r"pulver|käse|meerrettich"),
    (r"schmand|crème fraîche|creme fraiche","M", P(("1 Esslöffel (EL)",30),), None),
    (r"\bmilch\b",        "M", P(("1 Glas",200),), r"pulver|kondens|reis|kokos|mandel|hafer|soja"),
    # --- Getränke (Gruppe N/P) ---
    (r"espresso",         None, P(("1 Espresso",30),), None),
    (r"kaffee \(getränk\)|kaffee getränk|^kaffee","N", P(("1 Tasse",200),), r"pulver|ersatz|bohne|sahne"),
    (r"tee \(getränk\)|^tee\b","N", P(("1 Tasse",200),), r"pulver|blatt|beutel|eistee"),
    (r"orangensaft|apfelsaft|saft","N", P(("1 Glas",200),), r"pulver|konzentrat"),
    (r"cola|limonade|softdrink|brause","N", P(("1 Glas",250),("1 Dose",330)), None),
    (r"\bbier\b",         "P", P(("1 Glas",300),("1 Flasche",500)), r"frei"),
    (r"\bwein\b",         "P", P(("1 Glas",200),), None),
    (r"wasser",           "N", P(("1 Glas",250),), None),
    # --- Fleisch & Wurst ---
    (r"hähnchen|hühnerbrust|hühnchen|geflügel","H", P(("1 Filet",150),), None),
    (r"putenbrust|pute",  "H", P(("1 Portion",150),), None),
    (r"schnitzel",        None, P(("1 Stück",150),), None),
    (r"steak",            None, P(("1 Stück",200),), None),
    (r"hackfleisch|hack\b","H", P(("1 Portion",125),), None),
    (r"bratwurst|wurst",  None, P(("1 Stück",100),), r"salami|scheibe|aufschnitt"),
    (r"salami",           None, P(("1 Scheibe",10),), None),
    (r"schinken",         None, P(("1 Scheibe",25),), None),
    (r"\bspeck\b|bacon",  None, P(("1 Scheibe",15),), None),
    # --- Fisch ---
    (r"lachs",            None, P(("1 Filet",125),), None),
    (r"thunfisch",        None, P(("1 Dose",150),), None),
    (r"forelle",          None, P(("1 Filet",130),), None),
    (r"garnele|shrimp",   None, P(("1 Portion",100),), None),
    # --- Nüsse & Samen ---
    (r"mandel",           None, P(("1 Handvoll",25),), r"milch|mus|mehl|öl"),
    (r"walnuss|haselnuss|cashew|paranuss|pistazie|erdnuss","F", P(("1 Handvoll",25),), r"mus|öl|butter|milch"),
    (r"sonnenblumenkern|kürbiskern","F", P(("1 Esslöffel (EL)",10),), None),
    (r"leinsamen|chiasamen|chia","F", P(("1 Esslöffel (EL)",12),), None),
    # --- Getreideflocken/Frühstück ---
    (r"haferflocken",     None, P(("1 Portion",50),), None),
    (r"müsli|granola",    None, P(("1 Portion",50),), None),
    (r"cornflakes|frühstückscerealien","None", P(("1 Portion",30),), None),
    # --- Süßes & Aufstriche/Soßen ---
    (r"\bzucker\b",       None, P(("1 Teelöffel (TL)",5),("1 Esslöffel (EL)",15)), r"couleur|austausch"),
    (r"honig",            None, P(("1 Teelöffel (TL)",7),), None),
    (r"marmelade|konfitüre|fruchtaufstrich","None", P(("1 Esslöffel (EL)",20),), None),
    (r"nuss-nougat|nougatcreme|nutella","None", P(("1 Esslöffel (EL)",20),), None),
    (r"schokolade",       None, P(("1 Riegel",20),("1 Tafel",100)), r"getränk|pulver|milch\b"),
    (r"ketchup",          None, P(("1 Esslöffel (EL)",15),), None),
    (r"mayonnaise",       None, P(("1 Esslöffel (EL)",15),), None),
    (r"\bsenf\b",         None, P(("1 Teelöffel (TL)",5),), None),
]

def portions_for(name, gruppe):
    low = name.lower()
    for kw, grp, ports, neg in RULES:
        if grp and grp != gruppe:
            continue
        if neg and re.search(neg, low):
            continue
        if re.search(kw, low):
            return ports
    return None

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb[wb.sheetnames[0]]
out = []
n_port = 0
for r in ws.iter_rows(min_row=2, values_only=True):
    code, name, kcal, _ref, prot, fat, cho = r[0], r[1], r[2], r[3], r[4], r[5], r[6]
    if not code or not name or kcal in (None, "", "-"):
        continue
    try:
        kcal = round(float(kcal), 1); prot = round(float(prot or 0), 2)
        fat = round(float(fat or 0), 2); cho = round(float(cho or 0), 2)
    except (TypeError, ValueError):
        continue
    gruppe = str(code)[0]
    ports = portions_for(str(name), gruppe)
    if ports: n_port += 1
    entry = {"c": str(code), "n": str(name).strip(), "k": kcal, "p": prot, "f": fat, "ch": cho}
    if ports: entry["po"] = ports
    out.append(entry)

os.makedirs("public", exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print(f"{len(out)} Lebensmittel geschrieben, davon {n_port} mit Portionen -> {OUT}")
print(f"Dateigröße: {os.path.getsize(OUT)//1024} KB")
