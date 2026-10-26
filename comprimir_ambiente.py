# SONIDO DE AMBIENTE: comprime el WAV de pájaros («spring birds loop with low cut new jersey LOOPED AND CLEANED»,
# steaq en Freesound, CC0: https://freesound.org/people/steaq/sounds/548383/) para el visor, con el ffmpeg de Blender.
# Mono (el ambiente no necesita estéreo), ganancia normalizada (la grabación está a −49 dB de media) y dos formatos:
# Opus 24 kbps (web/ambiente.ogg, ≈ 314 KB) y MP3 40 kbps de respaldo (web/ambiente.mp3). Casi toda la energía está
# entre 2 y 8 kHz, que ambos conservan; el bucle sigue durando 120,000 s exactos (sin hueco al repetir).
#   blender --background --factory-startup --python comprimir_ambiente.py -- ruta/del/sonido.wav
import os
import sys

import aud
import numpy as np

DIR = os.path.dirname(os.path.abspath(__file__))
entrada = sys.argv[sys.argv.index("--") + 1]
mono = aud.Sound(entrada).rechannel(1)
ganancia = 0.7 / float(np.abs(mono.data()).max())           # pico a 0,7 (−3 dB); el visor baja el volumen
sonido = mono.volume(ganancia)
for nombre, rate, contenedor, codec, bitrate in (
        ("ambiente.ogg", 48000, aud.CONTAINER_OGG, aud.CODEC_OPUS, 24000),     # Opus solo admite 48 kHz
        ("ambiente.mp3", 44100, aud.CONTAINER_MP3, aud.CODEC_MP3, 40000)):
    ruta = os.path.join(DIR, "web", nombre)
    (sonido if rate == 48000 else sonido.resample(rate, True)).write(
        ruta, rate, aud.CHANNELS_MONO, aud.FORMAT_S16, contenedor, codec, bitrate)
    print(f"AMBIENTE {nombre}: {os.path.getsize(ruta) / 1024:.0f} KB (ganancia ×{ganancia:.1f})")
