# Arquitectura

## Visió general

`index.html` és una aplicació d'una sola pàgina, sense dependències de compilació. Només carrega dues coses de fora:

- Tipografies Archivo i Kalam (Google Fonts).
- `qrcodejs` 1.0.0 (cdnjs) per generar el QR de la vista Sala.

Tot l'accés a serveis passa per `window.claude.use(nom)`. Si una capacitat no hi és, la funció corresponent s'amaga i l'eina continua funcionant amb el que té.

## Navegació

- `#inici`: llista de sessions i formulari de nova sessió.
- `#s-<codi>`: una sessió. El codi té de 4 a 12 caràcters `[a-z0-9]`.
- La vista dins la sessió (facilitació, sala, participant, memòria) es guarda al navegador de cada persona.

## Model de dades

Totes les col·leccions, excepte `sessions`, porten el camp `sid` amb el codi de la sessió.

### `sessions/{sid}`

| Camp | Descripció |
| --- | --- |
| `title`, `repte` | Títol i repte de partida |
| `route` | `dt` (Design Thinking) o `cd` (Culture Design) |
| `mode` | `directe` o `documentacio` |
| `maps` | Llista d'identificadors de mapa en ordre |
| `current` | Mapa projectat a la sala |
| `timer` | `{ duration, remaining, endsAt }` en segons i mil·lisegons |
| `mission` | `{ objectiu, persones, impacte }` (mapa cd1) |
| `centers` | Text central per mapa (objecte de referència del cd4) |
| `notes` | Notes de facilitació per mapa |
| `reveal` | Si els resultats NUF són visibles, per mapa |
| `finalIdea` | Etiqueta triada com a finalista a la matriu |
| `synthesis` | Síntesi de la memòria |
| `createdBy`, `createdAt` | Autoria i data |

### `labels/{id}`

Etiquetes adhesives. `map`, `text`, `shape` (`oval` o `round`), `kind` (tipus d'etiqueta rodona), `zone`, posició al llenç `x`, `y` (percentatge), posició a la matriu `mx`, `my`, `by`, `alias`, `src` (`digital` o `foto`), `createdAt`.

### `votes/{sid}__{map}__{persona}`

Els 3 punts vermells de cada persona: `picks` amb els identificadors d'etiqueta.

### `nuf/{sid}__{map}__{persona}`

Puntuacions NUF individuals: `scores[idEtiqueta] = { n, u, f }`.

### `tasks/{id}`

Tasques compartides pels mapes Timeline i Seguiment: `text`, `owner`, `status` (`todo`, `doing`, `standby`, `done`), `start`, `end`.

### `photos/{id}`

Fotos del mapa físic: `map`, `assetId`, `url`, `imported` (etiquetes importades per IA).

## Definició dels mapes

L'objecte `ROUTES` descriu cada mapa:

| Propietat | Ús |
| --- | --- |
| `kind` | `zones`, `canvas`, `vote`, `matrix`, `nuf` o `tasks` |
| `zones` | Zones amb `id`, `title`, `hint` (mapes de zones) |
| `roundKinds` | Tipus d'etiqueta rodona (llenç) |
| `clusterKinds` | Rodones que agrupen les ovals properes |
| `centerKind` | Rodona que va al centre i s'uneix amb els clústers |
| `source` | Mapa d'on surten les idees (votació, matriu, NUF) |
| `voteMap` | Mapa de votació que alimenta la matriu |
| `mission`, `center` | Blocs especials del cd1 i el cd4 |
| `steps` | Instruccions que es mostren a la facilitació i a la sala |

## Camí cap a un backend propi

Per publicar l'eina fora de Claude (GitHub Pages o un altre allotjament) cal substituir les capacitats per serveis equivalents. Una opció és Supabase, amb servidors a la UE:

| Capacitat actual | Substitut possible |
| --- | --- |
| `db` amb `onSnapshot` | Taules Postgres amb Supabase Realtime |
| `room` (presència) | Supabase Realtime Presence |
| `user` | Supabase Auth o àlies sense registre |
| `assets` | Supabase Storage |
| `sample` | Funció de servidor amb la clau d'API d'Anthropic com a secret |
| `downloads` | Descàrrega estàndard del navegador |

La manera més neta de fer-ho és crear un petit adaptador que exposi la mateixa interfície (`doc`, `collection`, `where`, `onSnapshot`, `set`, `update`, `delete`) i que `init()` carregui l'adaptador en lloc de `window.claude`.
