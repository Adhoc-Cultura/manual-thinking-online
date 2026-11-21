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

## Dos entorns

L'eina funciona en dos entorns amb el mateix `index.html`:

- **Dins de Claude** (versió de validació): https://claude.ai/artifact/Efnt3Z8sistVF1zu5KhzWy. Fa servir les capacitats de la plataforma de Claude.
- **GitHub Pages amb Supabase**: `supabase-adapter.js` ofereix la mateixa interfície fent servir Supabase.

| Funció | A Claude | Amb Supabase |
| --- | --- | --- |
| Dades compartides en temps real | `db` | Taula `docs` amb Realtime |
| Persones connectades | `room` | Realtime Presence |
| Identitat | `user` | Accés anònim de Supabase Auth |
| Fotos | `assets` | Storage, bucket `fotos` |
| Transcripció i síntesi amb IA | `sample` | Edge Function `ia` amb l'API d'Anthropic |
| Descàrregues | `downloads` | Descàrrega del navegador |

## Posada en marxa amb Supabase

1. Creeu un projecte a Supabase en una regió de la UE.
2. A **Authentication**, activeu *Allow anonymous sign-ins* i apugeu el límit d'altes anònimes per hora a **Rate Limits**.
3. A l'**SQL Editor**, executeu `supabase/schema.sql` i després `supabase/update-01.sql`.
4. A **Edge Functions**, creeu la funció `ia` amb el codi de `supabase/functions/ia/index.ts` i afegiu el secret `ANTHROPIC_API_KEY`.
5. Escriviu la URL del projecte i la *publishable key* a `config.js`.
6. Activeu GitHub Pages a **Settings → Pages** (branca `main`, carpeta arrel).

## Estructura

```
index.html                     Aplicació completa (HTML, CSS i JavaScript)
config.js                      URL i clau pública del projecte de Supabase
supabase-adapter.js            Connexió de l'eina amb Supabase
supabase/schema.sql            Taules, seguretat, temps real i bucket de fotos
supabase/update-01.sql         Funció d'actualització parcial de documents
supabase/functions/ia/index.ts Funció de servidor per a la IA
docs/ARQUITECTURA.md           Model de dades i definició dels mapes
```

## Com fer canvis

1. Editeu `index.html`.
2. Proveu-lo localment o a GitHub Pages.
3. Feu commit i push al repositori.

Els continguts dels mapes (títols, zones, preguntes i instruccions) són a l'objecte `ROUTES`, al principi del bloc `<script>`. Per afegir o modificar un mapa n'hi ha prou de tocar aquest objecte.

## Crèdits

- Sistema Manual Thinking®: Luki Huber studio.
- Design Thinking Kit: Enric Segarra.
- Culture Design en 10 passos i desenvolupament de l'eina: Adhoc Cultura.
