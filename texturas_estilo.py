# Texturas estilizadas (no realistas) generadas por código, repetibles sin costuras.
# Cada función devuelve (rgb, mascara): rgb es un array (alto, ancho, 3) con la fila 0 arriba,
# y mascara (alto, ancho) indica dónde se aplica el color del material (la pared, la teja...).
import numpy as np

N = 256


def _malla(alto=N, ancho=N):
    y, x = np.mgrid[0:alto, 0:ancho]
    return x / ancho, y / alto                              # 0..1, y = 0 arriba


def suave(semilla, alto=N, ancho=N, ondas=6, fmax=6):
    """Ruido suave repetible: suma de ondas con frecuencias enteras (encaja en los bordes)."""
    rng = np.random.default_rng(semilla)
    x, y = _malla(alto, ancho)
    r = np.zeros((alto, ancho))
    for _ in range(ondas):
        fx, fy = rng.integers(-fmax, fmax + 1, 2)
        r += np.sin(2 * np.pi * (fx * x + fy * y) + rng.uniform(0, 2 * np.pi)) / max(1, abs(fx) + abs(fy))
    return (r - r.min()) / (r.max() - r.min() + 1e-9)


def grano(semilla, alto=N, ancho=N):
    return np.random.default_rng(semilla).random((alto, ancho))


def _rgb(gris):
    return np.repeat(gris[..., None], 3, axis=2)


def _pintar(img, zona, color):
    img[zona] = color


def caja(x, y, x0, x1, y0, y1):
    return (x >= x0) & (x < x1) & (y >= y0) & (y < y1)


# ---------------------------------------------------------------- fachadas
def fachada_piso():
    """Una planta de bloque de pisos (3,2 m × 3 m): ventana con persiana y balcón."""
    x, y = _malla()
    pared = 0.92 + 0.05 * suave(1) - 0.03 * grano(2)
    img = _rgb(pared)
    mascara = np.ones((N, N), bool)
    ventana = caja(x, y, 0.30, 0.70, 0.16, 0.90)
    marco = ventana & ~caja(x, y, 0.32, 0.68, 0.18, 0.90)
    vidrio = ventana & ~marco
    reflejo = vidrio & (((x - 0.6 * y) % 0.5) < 0.08)
    _pintar(img, ventana, (0.97, 0.97, 0.95))
    _pintar(img, vidrio, (0.20, 0.27, 0.36))
    _pintar(img, reflejo, (0.33, 0.42, 0.52))
    persiana = vidrio & (y < 0.42)
    img[persiana] = np.array((0.80, 0.76, 0.66)) * np.where((y[persiana] * N) % 5 < 1, 0.82, 1.0)[:, None]
    _pintar(img, caja(x, y, 0.29, 0.71, 0.14, 0.16), (0.70, 0.70, 0.70))      # sombra del dintel
    # Balcón: losa + barandilla de barrotes
    _pintar(img, caja(x, y, 0.20, 0.80, 0.90, 0.95), (0.86, 0.85, 0.82))
    barandilla = caja(x, y, 0.20, 0.80, 0.62, 0.90)
    barrotes = barandilla & (((x * N) % 9) < 2)
    _pintar(img, barrotes | caja(x, y, 0.20, 0.80, 0.62, 0.645), (0.22, 0.22, 0.24))
    _pintar(img, caja(x, y, 0.0, 1.0, 0.95, 1.0), (0.80, 0.79, 0.76))         # canto del forjado
    mascara[ventana | barrotes | caja(x, y, 0.20, 0.80, 0.62, 0.645)] = False
    return img, mascara


def fachada_casa():
    """Fachada de casa (3 m × 3 m): ventana con contraventanas verdes, alféizar y zócalo."""
    x, y = _malla()
    pared = 0.90 + 0.08 * suave(3, fmax=8) - 0.04 * grano(4)
    img = _rgb(pared)
    mascara = np.ones((N, N), bool)
    ventana = caja(x, y, 0.38, 0.62, 0.25, 0.75)
    marco = ventana & ~caja(x, y, 0.40, 0.60, 0.27, 0.75)
    _pintar(img, ventana, (0.95, 0.95, 0.93))
    _pintar(img, ventana & ~marco, (0.18, 0.22, 0.28))
    for x0, x1 in ((0.25, 0.37), (0.63, 0.75)):                               # mallorquinas
        hoja = caja(x, y, x0, x1, 0.25, 0.75)
        img[hoja] = np.array((0.24, 0.46, 0.32)) * np.where((y[hoja] * N) % 6 < 2, 0.75, 1.0)[:, None]
        mascara[hoja] = False
    _pintar(img, caja(x, y, 0.35, 0.65, 0.75, 0.79), (0.96, 0.95, 0.92))      # alféizar
    _pintar(img, caja(x, y, 0.36, 0.64, 0.79, 0.81), (0.62, 0.62, 0.60))      # su sombra
    zocalo = y > 0.91
    img[zocalo] = _rgb(0.62 + 0.12 * grano(5))[zocalo]
    mascara[ventana | zocalo | caja(x, y, 0.35, 0.65, 0.75, 0.81)] = False
    return img, mascara


def fachada_nave():
    """Nave industrial (4 m × 4 m): chapa ondulada con franja de ventanas arriba."""
    x, y = _malla()
    chapa = 0.86 + 0.12 * np.sin(2 * np.pi * x * 32) ** 2 - 0.03 * grano(6)
    img = _rgb(chapa)
    mascara = np.ones((N, N), bool)
    franja = caja(x, y, 0, 1, 0.10, 0.24)
    _pintar(img, franja, (0.55, 0.66, 0.74))
    _pintar(img, franja & (((x * N) % 32) < 3), (0.30, 0.32, 0.35))
    _pintar(img, caja(x, y, 0, 1, 0.24, 0.26), (0.40, 0.42, 0.45))
    zocalo = y > 0.93
    img[zocalo] = _rgb(0.55 + 0.1 * grano(7))[zocalo]
    mascara[franja | zocalo | caja(x, y, 0, 1, 0.24, 0.26)] = False
    return img, mascara


# ---------------------------------------------------------------- cubiertas
def tejas():
    """Tejas árabes (2 m × 2 m): 8 filas con las piezas alternadas."""
    x, y = _malla()
    px, py = x * N, y * N
    fila = (py // 32).astype(int)
    tx = ((px + (fila % 2) * 16) % 32) / 32
    ty = (py % 32) / 32
    pieza = (fila * 31 + ((px + (fila % 2) * 16) // 32).astype(int)) % 97
    variacion = np.random.default_rng(8).uniform(-0.08, 0.08, 97)[pieza]
    tono = 0.70 + 0.30 * np.sin(np.pi * tx) + variacion
    tono = np.where(ty > 0.82, tono * 0.65, tono)                             # solape con la fila de abajo
    return _rgb(np.clip(tono, 0, 1.05)), np.ones((N, N), bool)


def azotea():
    """Azotea (4 m × 4 m): baldosas de 50 cm con juntas."""
    x, y = _malla()
    px, py = x * N, y * N
    pieza = ((py // 32) * 8 + px // 32).astype(int)
    tono = 0.92 + np.random.default_rng(9).uniform(-0.05, 0.05, 64)[pieza] - 0.04 * grano(10)
    tono = np.where(((px % 32) < 2) | ((py % 32) < 2), 0.72, tono)
    return _rgb(tono), np.ones((N, N), bool)


# ---------------------------------------------------------------- suelos
def calzada():
    """Asfalto (ancho de la calle × 8 m): líneas de borde y línea central discontinua."""
    alto, ancho = 256, 128
    x, y = _malla(alto, ancho)
    g = grano(11, alto, ancho)
    asfalto = 0.29 + 0.05 * g + 0.03 * suave(12, alto, ancho)
    img = _rgb(asfalto) * np.array((0.97, 0.99, 1.04))
    pintura = np.array((0.92, 0.92, 0.88)) * (0.85 + 0.15 * g)[..., None]
    lineas = caja(x, y, 0.05, 0.08, 0, 1) | caja(x, y, 0.92, 0.95, 0, 1) | caja(x, y, 0.485, 0.515, 0, 0.5)
    img[lineas] = pintura[lineas]
    return img, np.zeros((alto, ancho), bool)                                  # colores propios


def panot():
    """Panot de 4 pastillas (2 m × 2 m): baldosas de 25 cm con cuatro cuadros en relieve."""
    x, y = _malla()
    tx, ty = (x * N) % 32, (y * N) % 32
    tono = np.full((N, N), 0.86) - 0.03 * grano(13)
    for cx in (9, 23):
        for cy in (9, 23):
            d = np.maximum(np.abs(tx - cx), np.abs(ty - cy))
            tono = np.where(d < 6, 0.95, np.where(d < 7, 0.74, tono))
    tono = np.where((tx < 1) | (ty < 1), 0.62, tono)
    return _rgb(tono), np.ones((N, N), bool)


def cesped():
    x, y = _malla()
    tono = 0.82 + 0.16 * suave(14, fmax=8) + 0.08 * grano(15)
    img = _rgb(tono)
    seco = suave(16, fmax=5) > 0.8                                              # calvas amarillentas
    img[seco] *= np.array((1.12, 1.04, 0.85))
    return np.clip(img, 0, 1.2), np.ones((N, N), bool)


def bosque():
    tono = 0.70 + 0.20 * suave(17, fmax=8) + 0.08 * grano(18)
    img = _rgb(tono)
    pinaza = grano(19) > 0.965
    img[pinaza] = (0.95, 0.75, 0.55)                                            # agujas secas
    return img, np.ones((N, N), bool)


def matorral():
    s = suave(20, fmax=10)
    tono = np.where(s > 0.55, 0.72 + 0.1 * s, 0.98) - 0.06 * grano(21)
    return _rgb(tono), np.ones((N, N), bool)


def pista():
    x, y = _malla()
    tono = np.where((y * 4) % 1 < 0.5, 1.0, 0.9) - 0.04 * grano(22)
    return _rgb(tono), np.ones((N, N), bool)


def suelo():
    tono = 0.90 + 0.08 * suave(23, fmax=8) - 0.05 * grano(24)
    tono = np.where(grano(25) > 0.985, 0.72, tono)                              # piedrecitas
    return _rgb(tono), np.ones((N, N), bool)


def agua():
    x, y = _malla()
    ola = np.abs(np.sin(2 * np.pi * (x * 4 + 0.25 * np.sin(2 * np.pi * y * 3))))
    tono = 0.86 + 0.06 * suave(26) + np.where((ola > 0.97) & (((y * 8) % 1) < 0.35), 0.16, 0)
    return _rgb(tono), np.ones((N, N), bool)


def estratos():
    x, y = _malla()
    tono = 0.78 + 0.16 * np.sin(2 * np.pi * (y * 4 + 0.15 * np.sin(2 * np.pi * x))) - 0.08 * grano(27)
    return _rgb(tono), np.ones((N, N), bool)


PATRONES = {
    "piso": fachada_piso, "casa": fachada_casa, "nave": fachada_nave,
    "tejas": tejas, "azotea": azotea, "calzada": calzada, "panot": panot,
    "cesped": cesped, "bosque": bosque, "matorral": matorral, "pista": pista,
    "suelo": suelo, "agua": agua, "estratos": estratos,
}


def textura(patron, color=None):
    """rgb final: el color del material se aplica solo donde indica la máscara."""
    rgb, mascara = PATRONES[patron]()
    rgb = rgb.copy()
    if color is not None:
        rgb[mascara] *= np.array(color)
    return np.clip(rgb, 0, 1)
