# Manual Thinking en línia

Prototip de validació d'una eina per a facilitadors i facilitadores de dinàmiques col·lectives que treballen amb el sistema **Manual Thinking®**. És un projecte conjunt d'Adhoc Cultura i Manual Thinking, amb llicència d'ús del sistema.

L'eina fa de **mapa bessó digital**: el mapa físic continua al centre de la sala i l'eina hi connecta les persones en remot, guia cada pas i en guarda la memòria del procés.

## Què fa

- **Dos recorreguts** a escollir en crear la sessió:
  - **Design Thinking** (4 passos, kit d'Enric Segarra): definició del problema, empatia, conceptualització amb «I si...?» i test NUF, retorn.
  - **Culture Design** (10 mapes, Adhoc Cultura): verificació del repte, empatia, provocació, Box Stimuli, creació, selecció, avaluació, Tresor de la innocència, les 3P, timeline i seguiment.
- **Dos formats**: sessió en directe (híbrida) o documentació d'un procés ja fet.
- **Quatre vistes per sessió**:
  - *Facilitació*: navegació pels mapes, projecció a la sala, temporitzador, instruccions, notes i fotos.
  - *Sala*: per projectar, amb el mapa en gran, el temps, el codi i un QR.
  - *Participant*: per al mòbil, segueix el mapa projectat i permet enganxar etiquetes.
  - *Memòria*: tot el procés recollit, descarregable en HTML o Markdown.
- **Tipus de mapa**: zones, llenç lliure amb agrupació automàtica, votació amb 3 punts vermells, matriu complexitat/innovació, test NUF i tasques (timeline i kanban sincronitzats).
- **Fotos del mapa físic** amb transcripció de les etiquetes per IA i revisió abans d'importar-les.

## Estat actual

La versió de validació funciona publicada com a artefacte de Claude:
https://claude.ai/artifact/Efnt3Z8sistVF1zu5KhzWy

En aquest entorn, l'eina fa servir les capacitats de la plataforma de Claude:

| Funció | Capacitat |
| --- | --- |
| Dades compartides en temps real | `db` |
| Persones connectades | `room` |
| Identitat i noms | `user` |
| Fotos | `assets` |
| Transcripció i síntesi amb IA | `sample` |
| Descàrregues | `downloads` |

Si s'obre `index.html` fora de Claude (per exemple, a GitHub Pages), la pàgina es carrega però queda en **mode només lectura**: no pot desar sessions ni connectar persones. El pas a un servidor propi es descriu a [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Estructura

```
index.html            Aplicació completa (HTML, CSS i JavaScript en un sol fitxer)
docs/ARQUITECTURA.md  Model de dades, definició dels mapes i camí cap a un backend propi
```

## Com fer canvis

1. Editeu `index.html`.
2. Per provar-lo amb dades reals, torneu a publicar l'artefacte a Claude amb el fitxer nou.
3. Feu commit i push al repositori.

Els continguts dels mapes (títols, zones, preguntes i instruccions) són a l'objecte `ROUTES`, al principi del bloc `<script>`. Per afegir o modificar un mapa n'hi ha prou de tocar aquest objecte.

## Crèdits

- Sistema Manual Thinking®: Luki Huber studio.
- Design Thinking Kit: Enric Segarra.
- Culture Design en 10 passos i desenvolupament de l'eina: Adhoc Cultura.
