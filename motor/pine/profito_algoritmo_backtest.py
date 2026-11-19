# Réplica del backtest de Profito Algoritmo.
# Misma señal que ai-profit-camp-algo.pine y que profito-algoritmo-backtest.pine.
# Cuenta aciertos y fallos. No calcula dólares.
# Datos: Yahoo Finance, contrato continuo MNQ=F (Micro Nasdaq). Los puntos coinciden con el NQ.

import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf
from PIL import Image, ImageDraw, ImageFont

TZ = ZoneInfo("America/New_York")
TICK = 0.25
MIN_BODY = 0.70
MAX_CLOSE_W = 0.12
MAX_OPP_W = 0.25
BODY_MULT = 1.5
ATR_MULT = 1.2
FULL_WICK = True
RR = 1.0
BUFFER_TICKS = 0
EXC_INI = 9 * 60 + 30
EXC_FIN = 9 * 60 + 40

SESIONES = [
    "Asia 18:00-03:00",
    "Londres 03:00-09:30",
    "09:30-09:40 no se opera",
    "Apertura NY 09:40-11:30",
    "Mediodía 11:30-14:00",
    "Tarde 14:00-16:00",
    "Hueco 16:00-18:00",
]


def aplanar(df):
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy()
        df.columns = [c[0] for c in df.columns]
    df = df.rename(columns=str.title)
    df = df[["Open", "High", "Low", "Close"]].dropna()
    if df.index.tz is None:
        df.index = df.index.tz_localize("UTC")
    return df.tz_convert(TZ).sort_index()


def descargar_1m():
    fin = datetime.now(TZ) + timedelta(days=1)
    partes = []
    for i in range(5):
        hasta = fin - timedelta(days=7 * i)
        desde = hasta - timedelta(days=7)
        bruto = yf.download(
            "MNQ=F",
            interval="1m",
            start=desde.strftime("%Y-%m-%d"),
            end=hasta.strftime("%Y-%m-%d"),
            progress=False,
            auto_adjust=False,
            threads=False,
        )
        if bruto is not None and not bruto.empty:
            partes.append(aplanar(bruto))
    if not partes:
        raise SystemExit("Yahoo no devolvió velas de 1 minuto de MNQ=F.")
    todo = pd.concat(partes)
    todo = todo[~todo.index.duplicated(keep="first")].sort_index()
    return todo


def descargar(intervalo, periodo):
    bruto = yf.download(
        "MNQ=F",
        interval=intervalo,
        period=periodo,
        progress=False,
        auto_adjust=False,
        threads=False,
    )
    if bruto is None or bruto.empty:
        raise SystemExit(f"Yahoo no devolvió MNQ=F {intervalo} {periodo}.")
    return aplanar(bruto)


def resamplear(df, regla):
    ohlc = df.resample(regla, origin="start_day", label="left", closed="left").agg(
        Open=("Open", "first"),
        High=("High", "max"),
        Low=("Low", "min"),
        Close=("Close", "last"),
    )
    return ohlc.dropna()


def atr_wilder(high, low, close, n=14):
    # Igual que ta.atr de Pine: la primera vela no tiene true range, y el ATR es una RMA.
    tr = pd.Series(float("nan"), index=high.index)
    prev = close.shift(1)
    tr.iloc[1:] = pd.concat(
        [(high - low).iloc[1:], (high - prev).abs().iloc[1:], (low - prev).abs().iloc[1:]],
        axis=1,
    ).max(axis=1)
    out = pd.Series(float("nan"), index=high.index)
    if len(tr) <= n:
        return out
    out.iloc[n] = tr.iloc[1:n + 1].mean()
    for i in range(n + 1, len(tr)):
        out.iloc[i] = (out.iloc[i - 1] * (n - 1) + tr.iloc[i]) / n
    return out


def sesion_de(minuto):
    if minuto >= 18 * 60 or minuto < 3 * 60:
        return 0
    if minuto < 9 * 60 + 30:
        return 1
    if minuto < 9 * 60 + 40:
        return 2
    if minuto < 11 * 60 + 30:
        return 3
    if minuto < 14 * 60:
        return 4
    if minuto < 16 * 60:
        return 5
    return 6


def preparar(df):
    d = df.copy()
    d["atr"] = atr_wilder(d["High"], d["Low"], d["Close"], 14)
    prev_o = d["Open"].shift(1)
    prev_c = d["Close"].shift(1)
    prev_h = d["High"].shift(1)
    prev_l = d["Low"].shift(1)
    rng = d["High"] - d["Low"]
    body = (d["Close"] - d["Open"]).abs()
    bull = d["Close"] > d["Open"]
    bear = d["Close"] < d["Open"]
    up_w = d["High"] - d[["Open", "Close"]].max(axis=1)
    lo_w = d[["Open", "Close"]].min(axis=1) - d["Low"]
    cl_w = up_w.where(bull, lo_w)
    op_w = lo_w.where(bull, up_w)
    b_pct = body.where(rng > 0, 0) / rng.where(rng > 0, 1)
    c_pct = cl_w.where(rng > 0, 0) / rng.where(rng > 0, 1)
    o_pct = op_w.where(rng > 0, 0) / rng.where(rng > 0, 1)
    p_body = (prev_c - prev_o).abs()
    ok_anat = (b_pct >= MIN_BODY) & (c_pct <= MAX_CLOSE_W) & (o_pct <= MAX_OPP_W)
    ok_size = (rng >= d["atr"] * ATR_MULT) & (body >= p_body * BODY_MULT)
    if FULL_WICK:
        b_cond = (d["Close"] > prev_h) & (d["Open"] <= prev_c)
        s_cond = (d["Close"] < prev_l) & (d["Open"] >= prev_c)
    else:
        b_cond = (d["Close"] > prev_o) & (d["Open"] <= prev_c)
        s_cond = (d["Close"] < prev_o) & (d["Open"] >= prev_c)
    d["alcista"] = bull & (prev_c < prev_o) & b_cond & ok_anat & ok_size
    d["bajista"] = bear & (prev_c > prev_o) & s_cond & ok_anat & ok_size
    local = d.index.tz_convert(TZ)
    d["minuto"] = local.hour * 60 + local.minute
    d["hora"] = local.hour
    d["sesion"] = d["minuto"].map(sesion_de)
    d["excluida"] = (d["minuto"] >= EXC_INI) & (d["minuto"] < EXC_FIN)
    return d


def simular(df, por_apertura):
    o = df["Open"].to_numpy()
    h = df["High"].to_numpy()
    l = df["Low"].to_numpy()
    c = df["Close"].to_numpy()
    alc = df["alcista"].to_numpy()
    baj = df["bajista"].to_numpy()
    exc = df["excluida"].to_numpy()
    ses = df["sesion"].to_numpy()
    hora = df["hora"].to_numpy()
    buf = BUFFER_TICKS * TICK
    ac_s = [0] * 7
    fa_s = [0] * 7
    ac_h = [0] * 24
    fa_h = [0] * 24
    ac_d = [0, 0]
    fa_d = [0, 0]
    en = False
    sl = tp = 0.0
    ses_t = hora_t = lado = bar_ent = 0
    abiertos = 0

    def anotar(gano):
        if gano:
            ac_s[ses_t] += 1
            ac_h[hora_t] += 1
            ac_d[lado] += 1
        else:
            fa_s[ses_t] += 1
            fa_h[hora_t] += 1
            fa_d[lado] += 1

    def resultado(i):
        es_largo = lado == 0
        hit_s = l[i] <= sl if es_largo else h[i] >= sl
        hit_t = h[i] >= tp if es_largo else l[i] <= tp
        if not hit_s and not hit_t:
            return 0
        return 1 if hit_t and not hit_s else -1

    n = len(df)
    for i in range(n):
        if en and (i != bar_ent or por_apertura):
            r = resultado(i)
            if r != 0:
                anotar(r == 1)
                en = False
        if (not en) and (not exc[i]) and (alc[i] or baj[i]):
            largo = bool(alc[i])
            entrada = o[i] if por_apertura else c[i]
            stop = (l[i] - buf) if largo else (h[i] + buf)
            riesgo = (entrada - stop) if largo else (stop - entrada)
            if riesgo <= 0:
                continue
            en = True
            bar_ent = i
            sl = stop
            tp = entrada + RR * riesgo if largo else entrada - RR * riesgo
            ses_t = int(ses[i])
            hora_t = int(hora[i])
            lado = 0 if largo else 1
            if por_apertura:
                r = resultado(i)
                if r != 0:
                    anotar(r == 1)
                    en = False
    if en:
        abiertos = 1
    return {
        "ac_s": ac_s,
        "fa_s": fa_s,
        "ac_h": ac_h,
        "fa_h": fa_h,
        "ac_d": ac_d,
        "fa_d": fa_d,
        "abiertos": abiertos,
        "senales": int((df["alcista"] | df["bajista"]).sum()),
        "excluidas": int(((df["alcista"] | df["bajista"]) & df["excluida"]).sum()),
    }


def totales(res):
    ac = sum(res["ac_s"])
    fa = sum(res["fa_s"])
    return ac, fa, (None if ac + fa == 0 else 100.0 * ac / (ac + fa))


def prueba_sintetica():
    idx = pd.date_range("2026-11-18 10:00", periods=30, freq="5min", tz=TZ)
    rows = []
    for i in range(30):
        base = 100 + (i % 2) * 0.1
        rows.append((base, base + 0.4, base - 0.4, base + (0.05 if i % 2 == 0 else -0.05)))
    # Vela previa bajista y vela de señal alcista que envuelve.
    rows[20] = (100.5, 100.6, 98.5, 99.0)
    rows[21] = (99.0, 102.2, 98.8, 102.0)
    # La siguiente vela no importa para la apertura: el stop y el objetivo caen en la propia señal.
    df = pd.DataFrame(rows, index=idx, columns=["Open", "High", "Low", "Close"])
    d = preparar(df)
    assert bool(d["alcista"].iloc[21]), "la vela de prueba debería ser alcista"
    abierto = simular(d, True)
    ac, fa, _ = totales(abierto)
    assert ac == 0 and fa == 1, (ac, fa)
    # Cierre: el objetivo queda por encima del máximo de la señal. La vela 22 lo alcanza sin tocar el stop.
    rows[22] = (102.0, 106.0, 101.5, 105.5)
    df2 = pd.DataFrame(rows, index=idx, columns=["Open", "High", "Low", "Close"])
    d2 = preparar(df2)
    cerrado = simular(d2, False)
    ac2, fa2, _ = totales(cerrado)
    assert ac2 == 1 and fa2 == 0, (ac2, fa2)
    # La misma señal a las 09:35 no se opera.
    idx3 = idx.copy()
    # no se usa; se comprueba la ventana con una marca directa
    assert sesion_de(9 * 60 + 35) == 2
    assert EXC_INI <= 9 * 60 + 35 < EXC_FIN


def rango(df):
    a = df.index.min().tz_convert(TZ)
    b = df.index.max().tz_convert(TZ)
    return a.strftime("%Y-%m-%d %H:%M"), b.strftime("%Y-%m-%d %H:%M"), f"{a.strftime('%d %b %Y')} – {b.strftime('%d %b %Y')}"


def pct(ac, fa):
    if ac + fa == 0:
        return None
    return 100.0 * ac / (ac + fa)


def mejor_peor(filas, minimo):
    utiles = [f for f in filas if f["n"] >= minimo and f["pct"] is not None]
    if len(utiles) < 2:
        return None, None
    orden = sorted(utiles, key=lambda f: (f["pct"], f["n"]))
    if orden[0]["pct"] == orden[-1]["pct"]:
        return None, None
    return orden[-1]["clave"], orden[0]["clave"]


def main():
    prueba_sintetica()
    print("Prueba sintética: correcta.")
    m1 = descargar_1m()
    datos = {
        "1m": m1,
        "2m": descargar("2m", "60d"),
        "3m": resamplear(m1, "3min"),
        "5m": descargar("5m", "60d"),
        "15m": descargar("15m", "60d"),
    }
    salida = {"fuente": "Yahoo Finance", "simbolo": "MNQ=F", "nota": "Micro E-mini Nasdaq. Los puntos son los del índice; no hay dólares.", "modos": {}}
    for modo, por_apertura in (("apertura", True), ("cierre", False)):
        bloques = []
        for nombre, df in datos.items():
            d = preparar(df)
            res = simular(d, por_apertura)
            desde, hasta, texto = rango(d)
            ac, fa, p = totales(res)
            sesiones = []
            for i, nom in enumerate(SESIONES):
                a, f = res["ac_s"][i], res["fa_s"][i]
                sesiones.append({"nombre": nom, "aciertos": a, "fallos": f, "n": a + f, "pct": pct(a, f)})
            horas = []
            for h in range(24):
                a, f = res["ac_h"][h], res["fa_h"][h]
                horas.append({"hora": h, "aciertos": a, "fallos": f, "n": a + f, "pct": pct(a, f)})
            bloques.append({
                "temporalidad": nombre,
                "desde": desde,
                "hasta": hasta,
                "periodo": texto,
                "velas": int(len(d)),
                "senales": res["senales"],
                "excluidas": res["excluidas"],
                "aciertos": ac,
                "fallos": fa,
                "n": ac + fa,
                "pct": p,
                "abiertos": res["abiertos"],
                "largos": {"aciertos": res["ac_d"][0], "fallos": res["fa_d"][0]},
                "cortos": {"aciertos": res["ac_d"][1], "fallos": res["fa_d"][1]},
                "sesiones": sesiones,
                "horas": horas,
            })
            print(f"{modo} {nombre}: {ac} aciertos, {fa} fallos, {p if p is not None else '—'}%  {desde} → {hasta}  señales {res['senales']} excluidas {res['excluidas']}")
        salida["modos"][modo] = bloques
    with open("/tmp/profito-backtest.json", "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)
    dibujar(salida, "/opt/cursor/artifacts/backtest-aciertos.png")
    print("Imagen: /opt/cursor/artifacts/backtest-aciertos.png")


def dibujar(salida, ruta):
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    font_b = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    font_s = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
    font_t = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    W = 1400
    fondo = (250, 248, 244)
    tinta = (28, 24, 38)
    mora = (26, 18, 48)
    verde = (16, 122, 72)
    rojo = (176, 48, 42)
    linea = (220, 214, 206)
    img = Image.new("RGB", (W, 2400), fondo)
    d = ImageDraw.Draw(img)
    y = 28
    d.text((36, y), "Profito Algoritmo — aciertos y fallos", font=font_t, fill=mora)
    y += 36
    d.text((36, y), "Datos: Yahoo Finance, MNQ=F (Micro Nasdaq, CME). Misma señal que el indicador. Sin dólares.", font=font_s, fill=tinta)
    y += 22
    d.text((36, y), "No se operan las velas que empiezan de 09:30 a 09:39, hora de Nueva York. El objetivo es 1 a 1 con el stop.", font=font_s, fill=tinta)
    y += 28

    def fila(x0, y0, cols, anchos, fuente, color, bg=None):
        x = x0
        alto = 28
        for texto, w in zip(cols, anchos):
            if bg:
                d.rectangle((x, y0, x + w, y0 + alto), fill=bg)
            d.text((x + 8, y0 + 6), str(texto), font=fuente, fill=color)
            x += w
        d.line((x0, y0 + alto, x0 + sum(anchos), y0 + alto), fill=linea)
        return y0 + alto

    def tabla_tiempo(titulo, bloques, nota):
        nonlocal y
        d.text((36, y), titulo, font=font_b, fill=mora)
        y += 24
        d.text((36, y), nota, font=font_s, fill=(90, 84, 96))
        y += 22
        anchos = [150, 250, 280, 140, 140, 140]
        y = fila(36, y, ["Tiempo", "Desde", "Hasta", "Aciertos", "Fallos", "% acierto"], anchos, font_b, (255, 255, 255), mora)
        filas = []
        for b in bloques:
            filas.append({"clave": b["temporalidad"], "n": b["n"], "pct": b["pct"], "b": b})
        mejor, peor = mejor_peor(filas, 15)
        for f in filas:
            b = f["b"]
            p = "—" if b["pct"] is None else f"{b['pct']:.1f} %"
            bg = None
            col = tinta
            if f["clave"] == mejor:
                bg = (214, 240, 222)
                col = verde
            elif f["clave"] == peor:
                bg = (250, 224, 220)
                col = rojo
            y = fila(36, y, [b["temporalidad"], b["desde"], b["hasta"], b["aciertos"], b["fallos"], p], anchos, font, col, bg)
        y += 18

    def tabla_sesion(titulo, bloques):
        nonlocal y
        d.text((36, y), titulo, font=font_b, fill=mora)
        y += 26
        cols = ["Sesión"] + [b["temporalidad"] for b in bloques]
        anchos = [250] + [190] * len(bloques)
        y = fila(36, y, cols, anchos, font_b, (255, 255, 255), mora)
        candidatas = []
        for b in bloques:
            for s in b["sesiones"]:
                if s["nombre"].startswith("09:30-09:40"):
                    continue
                candidatas.append({"clave": f"{b['temporalidad']}|{s['nombre']}", "n": s["n"], "pct": s["pct"], "txt": s})
        mejor, peor = mejor_peor(candidatas, 12)
        for i, nombre in enumerate(SESIONES):
            vals = [nombre]
            colores = [tinta]
            for b in bloques:
                s = b["sesiones"][i]
                if s["n"] == 0:
                    vals.append("—")
                else:
                    vals.append(f"{s['aciertos']} ac · {s['fallos']} fal · {s['pct']:.0f}%")
                clave = f"{b['temporalidad']}|{nombre}"
                colores.append(verde if clave == mejor else rojo if clave == peor else tinta)
            x = 36
            alto = 30
            for j, (texto, w) in enumerate(zip(vals, anchos)):
                bg = (214, 240, 222) if j > 0 and colores[j] == verde else (250, 224, 220) if j > 0 and colores[j] == rojo else None
                if bg:
                    d.rectangle((x, y, x + w, y + alto), fill=bg)
                d.text((x + 8, y + 7), texto, font=font_s, fill=colores[j] if j else tinta)
                x += w
            d.line((36, y + alto, 36 + sum(anchos), y + alto), fill=linea)
            y += alto
        y += 8
        d.text((36, y), "Verde: donde más acierta. Rojo: donde más falla. Solo si hay al menos 12 operaciones cerradas y los porcentajes no son iguales.", font=font_s, fill=(90, 84, 96))
        y += 28

    tabla_tiempo(
        "1. Entrada al cierre de la vela (la señal ya se confirmó)",
        salida["modos"]["cierre"],
        "Esta es la lectura realista: se entra cuando la vela coloreada cierra. El stop es el extremo contrario de esa vela.",
    )
    tabla_sesion("Dónde acierta y dónde falla, por sesión (entrada al cierre)", salida["modos"]["cierre"])
    tabla_tiempo(
        "2. Entrada en la apertura de la vela coloreada (la que pidió Josue)",
        salida["modos"]["apertura"],
        "Si en la misma vela el precio toca el stop y el objetivo, cuenta como fallo. En esta señal eso pasa casi siempre.",
    )
    img = img.crop((0, 0, W, min(y + 24, img.height)))
    img.save(ruta)


if __name__ == "__main__":
    main()
