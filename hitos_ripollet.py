# HITOS DE RIPOLLET modelados a mano según su ficha del inventario «Mapes de Patrimoni Cultural» (Diputació de
# Barcelona; obtener_patrimonio.py) y con la altura medida en el LiDAR del ICGC:
#   · Campanar de l'església parroquial (1892, Josep Torres i Argullol): torre de planta cuadrada de ladrillo visto con
#     paneles revocados de color rosa, cinco niveles, ventanas de arco ojival en cada piso y el reloj en el cuarto
#     (esfera blanca en un cuadrado de azulejos azules); el quinto, el de las campanas, octogonal con ocho ventanas
#     ojivales; coronamiento de almenas con barandas de hierro y un cuerpo central de hierro con campanas pequeñas.
#   · Església de Sant Esteve: piedra, con su cubierta (el resto lo da el Catastro).
#   · Molí d'en Rata (1825): edificio de piedra revocada de planta rectangular, planta baja, piso y sótano; cubierta
#     a la catalana de una vertiente que baja hacia la fachada principal (al este), con alero de ladrillo; en el sótano
#     una arcada de cinco arcos de obra vista; tres ventanas enmarcadas con ladrillo en planta baja y en el piso.
#   · Xemeneia del Molí d'en Calvet (años cincuenta): chimenea industrial de ladrillo visto de sección hexagonal con una
#     pequeña moldura de coronamiento.
#   · Molí de vent (1870): rueda metálica de aspas con una veleta que la orienta al viento, sobre un pie de hierro de
#     forma trapezoidal.
# Las funciones reciben de osm_ripollet.py las herramientas de dibujo (cara, altura…) para no duplicar nada.
import math

HITOS = {"esglesia": (41.49708, 2.15541), "campanar": (41.49699, 2.15525), "moli_rata": (41.49952, 2.15259),
         "xemeneia": (41.49785, 2.15335), "moli_vent": (41.49894, 2.15732)}
# Ajuste de posición (m, x este / y norte) hasta el punto más alto del LiDAR: la coordenada de la ficha es aproximada
AJUSTE = {"campanar": (-3.0, -4.0), "xemeneia": (1.0, 1.0)}
MATERIALES_HITOS = {
    "piedra_casa": ((0.72, 0.64, 0.52), None, None, None),   # sufijo _casa: prisma() mide la fachada por él
    "ladrillo": ((0.66, 0.36, 0.24), None, None, None),
    "revoco_rosa": ((0.90, 0.64, 0.60), None, None, None),
    "revoco": ((0.88, 0.80, 0.66), None, None, None),
    "hueco": ((0.10, 0.10, 0.12), None, None, None),
    "hierro": ((0.16, 0.17, 0.19), None, None, None),
    "esfera": ((0.95, 0.95, 0.92), None, None, None),
    "azulejo": ((0.22, 0.42, 0.74), None, None, None),
}


class Dibujo:
    """Primitivas sencillas sobre `cara` (polígonos en metros, z hacia arriba)."""

    def __init__(self, cara):
        self.cara = cara

    def caja(self, mat, cx, cy, z0, ancho, fondo, alto, ang=0.0):
        c, s = math.cos(ang), math.sin(ang)
        esq = [(cx + c * dx - s * dy, cy + s * dx + c * dy)
               for dx, dy in ((-ancho / 2, -fondo / 2), (ancho / 2, -fondo / 2), (ancho / 2, fondo / 2), (-ancho / 2, fondo / 2))]
        self.prisma(mat, esq, z0, z0 + alto)

    def prisma(self, mat, p, z0, z1, tapa=True, p_arriba=None):
        """Paredes de un polígono antihorario de z0 a z1 (con otro polígono arriba si se estrecha) y su tapa."""
        q = p_arriba or p
        for i in range(len(p)):
            a, b, qa, qb = p[i - 1], p[i], q[i - 1], q[i]
            self.cara(mat, [(a[0], a[1], z0), (b[0], b[1], z0), (qb[0], qb[1], z1), (qa[0], qa[1], z1)])
        if tapa:
            self.cara(mat, [(x, y, z1) for x, y in q])

    def regular(self, cx, cy, r, lados, giro=0.0):
        # En sentido horario, como los polígonos del Catastro en osm_ripollet (area_firmada > 0)
        return [(cx + r * math.cos(giro - 2 * math.pi * k / lados), cy + r * math.sin(giro - 2 * math.pi * k / lados))
                for k in range(lados)]

    def hueco(self, mat, a, b, t, z, ancho, alto, ojiva=True, salida=0.06, marco=None):
        """Ventana (o arco) en la pared a→b (polígono horario: fuera a la izquierda) centrada en la fracción t,
        con la base a la altura z; ojiva = remate apuntado. `marco`: material de un marco 0,25 m mayor detrás."""
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        nx, ny = -uy, ux
        cx, cy = a[0] + ux * L * t, a[1] + uy * L * t

        def forma(w, h, sal, zb):
            ox, oy = cx + nx * sal, cy + ny * sal
            pts = [(-w / 2, zb), (w / 2, zb), (w / 2, zb + h * (0.72 if ojiva else 1))]
            if ojiva:
                pts.append((0, zb + h))
            pts.append((-w / 2, zb + h * (0.72 if ojiva else 1)))
            return [(ox + ux * d, oy + uy * d, zz) for d, zz in pts]
        if marco:
            self.cara(marco, forma(ancho + 0.5, alto + 0.4, salida * 0.5, z - 0.2))
        self.cara(mat, forma(ancho, alto, salida, z))


def campanar(d, cx, cy, suelo, alto, ang, lado=5.2):
    """Torre cuadrada (lado de la parte del Catastro): cuatro niveles de ladrillo con paneles rosa, ventanas ojivales y reloj; el quinto
    octogonal con ocho ventanas; almenas, baranda y el cuerpo de hierro de las campanas pequeñas."""
    z0 = suelo - 1.0
    fuste = alto * 0.68                         # cuatro niveles
    nivel = (fuste - 0.5) / 4
    c, s = math.cos(ang), math.sin(ang)
    esq = [(cx + c * dx - s * dy, cy + s * dx + c * dy) for dx, dy in
           ((-lado / 2, -lado / 2), (-lado / 2, lado / 2), (lado / 2, lado / 2), (lado / 2, -lado / 2))]   # horario
    d.prisma("ladrillo", esq, z0, suelo + fuste)
    for k in range(4):                          # niveles: panel rosa y ventana ojival en cada cara
        zb = suelo + 0.5 + k * nivel
        for i in range(4):
            a, b = esq[i], esq[(i + 1) % 4]
            d.hueco("revoco_rosa", a, b, 0.5, zb + 0.35, lado - 1.3, nivel - 0.7, ojiva=False, salida=0.03)
            if k == 3 and i == 0:               # el reloj, en un cuadrado de azulejos azules
                d.hueco("azulejo", a, b, 0.5, zb + 0.6, 2.0, 2.0, ojiva=False, salida=0.07)
                d.hueco("esfera", a, b, 0.5, zb + 0.8, 1.6, 1.6, ojiva=False, salida=0.1)
            else:
                d.hueco("hueco", a, b, 0.5, zb + 0.8, 0.9, min(2.4, nivel - 1.4), salida=0.07)
    # Quinto nivel: octogonal, con ocho ventanas ojivales (las campanas)
    zc, alto5 = suelo + fuste, alto * 0.17
    octo = d.regular(cx, cy, lado / 2 * 1.02, 8, ang + math.pi / 8)
    d.prisma("ladrillo", octo, zc, zc + alto5)
    for i in range(8):
        d.hueco("hueco", octo[i], octo[(i + 1) % 8], 0.5, zc + 0.6, 1.0, alto5 - 1.5, salida=0.05)
    # Coronamiento: almenas y baranda de hierro
    zt = zc + alto5
    for i in range(8):
        a, b = octo[i], octo[(i + 1) % 8]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        d.caja("ladrillo", mx, my, zt, 0.7, 0.45, 0.8, math.atan2(b[1] - a[1], b[0] - a[0]))
    anillo = d.regular(cx, cy, lado / 2 * 0.86, 8, ang + math.pi / 8)
    anillo_in = d.regular(cx, cy, lado / 2 * 0.80, 8, ang + math.pi / 8)
    for i in range(8):                          # baranda: una franja fina de hierro
        a, b, ai, bi = anillo[i - 1], anillo[i], anillo_in[i - 1], anillo_in[i]
        d.cara("hierro", [(a[0], a[1], zt + 0.9), (b[0], b[1], zt + 0.9), (b[0], b[1], zt + 1.1), (a[0], a[1], zt + 1.1)])
    # Cuerpo central de hierro: cuatro montantes que se juntan arriba, con una campana pequeña colgada
    remate = alto - (zt - suelo)
    pie = d.regular(cx, cy, 1.3, 4, ang + math.pi / 4)
    for x, y in pie:
        tx, ty = cx + (x - cx) * 0.15, cy + (y - cy) * 0.15
        for e in (-0.06, 0.06):
            d.cara("hierro", [(x + e, y - e, zt), (x - e, y + e, zt), (tx - e, ty + e, zt + remate), (tx + e, ty - e, zt + remate)])
    d.prisma("hierro", d.regular(cx, cy, 0.45, 8), zt + remate * 0.35, zt + remate * 0.6, p_arriba=d.regular(cx, cy, 0.2, 8))


def moli_rata(d, p, suelo_bajo, suelo_alto, alto):
    """Edificio de piedra revocada con cubierta de una vertiente que baja hacia el este (fachada principal), alero,
    tres ventanas enmarcadas por planta y, abajo, la arcada de cinco arcos del sótano."""
    xs = [x for x, _ in p]
    x0, x1 = min(xs), max(xs)
    # Cima como mínimo a 9 m (el LiDAR da ~10 m junto a la ficha; la mediana de la parte la baja por la vertiente)
    z_cima = suelo_alto + max(alto, 9.0)
    z_alero = z_cima - 2.2
    techo = lambda x: z_cima - (z_cima - z_alero) * (x - x0) / max(1e-6, x1 - x0)
    z0 = suelo_bajo - 1.0
    for i in range(len(p)):
        a, b = p[i - 1], p[i]
        d.cara("revoco", [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], techo(b[0])), (a[0], a[1], techo(a[0]))])
    # Cubierta (con 0,5 m de alero de ladrillo por el este)
    d.cara("tejado", [(x, y, techo(x) + 0.05) for x, y in p])
    # Fachada principal: la pared que más mira al este
    mejor, k = -2, 0
    for i in range(len(p)):
        a, b = p[i - 1], p[i]
        L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        este = -(b[1] - a[1]) / L                # componente x de la normal exterior (−uy, ux): polígono horario
        if este * min(L, 12) > mejor:
            mejor, k = este * min(L, 12), i
    a, b = p[k - 1], p[k]
    h_fachada = z_alero - suelo_alto
    for zb in (suelo_alto + 1.0, suelo_alto + h_fachada * 0.58):   # planta baja y piso, dentro de la fachada
        for t in (0.25, 0.5, 0.75):
            d.hueco("hueco", a, b, t, zb, 1.0, 1.5, ojiva=False, marco="ladrillo")
    for i, t in enumerate((0.1, 0.3, 0.5, 0.7, 0.9)):         # arcada del sótano: tres anchos entre dos estrechos
        ancho = 1.1 if i in (0, 4) else 1.8
        d.hueco("hueco", a, b, t, suelo_bajo - 0.6, ancho, 1.9, ojiva=True, marco="ladrillo")


def xemeneia(d, cx, cy, suelo, alto):
    """Chimenea de ladrillo de sección hexagonal que se estrecha, con una moldura arriba."""
    d.prisma("ladrillo", d.regular(cx, cy, 1.6, 6), suelo - 1, suelo + 2.5)               # basamento
    d.prisma("ladrillo", d.regular(cx, cy, 1.25, 6), suelo + 2.5, suelo + alto - 1.2, tapa=False,
             p_arriba=d.regular(cx, cy, 0.8, 6))
    d.prisma("ladrillo", d.regular(cx, cy, 1.0, 6), suelo + alto - 1.2, suelo + alto - 0.6)  # moldura
    d.prisma("hueco", d.regular(cx, cy, 0.7, 6), suelo + alto - 0.6, suelo + alto - 0.55)    # boca


def moli_vent(d, cx, cy, suelo, alto, ang):
    """Molino de viento: pie de hierro trapezoidal, rueda de doce aspas y veleta."""
    zr = suelo + alto - 1.4                      # eje de la rueda
    base, cima = 1.1, 0.25
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):                    # cuatro patas que se juntan arriba
        x0, y0, x1, y1 = cx + sx * base, cy + sy * base, cx + sx * cima, cy + sy * cima
        for e in (-0.11, 0.11):                 # perfil de hierro de 0,22 m (en dos caras cruzadas, se ve de todos lados)
            d.cara("hierro", [(x0 + e, y0 - e, suelo - 0.5), (x0 - e, y0 + e, suelo - 0.5), (x1 - e, y1 + e, zr), (x1 + e, y1 - e, zr)])
            d.cara("hierro", [(x0 + e, y0 + e, suelo - 0.5), (x0 - e, y0 - e, suelo - 0.5), (x1 - e, y1 - e, zr), (x1 + e, y1 + e, zr)])
    ux, uy = math.cos(ang), math.sin(ang)        # la rueda mira hacia ux, uy
    vx, vy = -uy, ux
    for k in range(12):                          # aspas: palas de chapa inclinadas alrededor del eje
        a = 2 * math.pi * k / 12
        r0, r1 = 0.35, 1.45
        ca, sa, cb, sb = math.cos(a - 0.12), math.sin(a - 0.12), math.cos(a + 0.12), math.sin(a + 0.12)
        p = lambda r, c, s, dz=0.0: (cx + ux * 0.3 + vx * r * c, cy + uy * 0.3 + vy * r * c, zr + r * s + dz)
        d.cara("hierro", [p(r0, ca, sa), p(r1, ca, sa), p(r1, cb, sb), p(r0, cb, sb)])
    d.caja("hierro", cx - ux * 0.6, cy - uy * 0.6, zr - 0.08, 1.6, 0.12, 0.16, ang)        # cola
    d.cara("hierro", [(cx - ux * 1.3 + vx * 0.02, cy - uy * 1.3 + vy * 0.02, zr - 0.5),
                      (cx - ux * 2.0, cy - uy * 2.0, zr - 0.5), (cx - ux * 2.0, cy - uy * 2.0, zr + 0.6),
                      (cx - ux * 1.3, cy - uy * 1.3, zr + 0.6)])                         # veleta
