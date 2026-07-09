# Liturgy-Prayer-Structure (La Catedral)

## 1) What the app shows
The day is divided into **7 liturgical hours**:
- **Maitines** (Oficio de Lectura)
- **Laudes** (Morning prayer)
- **Tercia** (Mid-morning)
- **Sexta** (Midday)
- **Nona** (Mid-afternoon)
- **Vísperas** (Evening prayer)
- **Completas** (Night / Compline)

Additionally, the app includes **Ángelus** as a separate prayer at:
- **06:00**
- **12:00**
- **18:00**

**Source (v1.3.9+):** day-correct Spanish texts from liturgiadelashoras.github.io when online; otherwise local psalter fragments. See `docs/features/Scheduled-Prayers-Booklets.md` for coverage counts.

## 2) “Groups” and “prayers”
- A **Group** is either:
  - a liturgical hour (one of the 7), or
  - **Ángelus**.
- Inside each Group, the app cycles through titled **prayers/snippets** (e.g. “Salmo 141”, “Magnificat”, “Oración”, etc.).

## 3) Text structure inside a prayer snippet (typical)
Many snippets follow the classic Liturgy of the Hours flow:
1. **Invocación / Versículo (V.)**
2. **Respuesta (R.)**
3. **Lectura / Salmo / Cántico** (often formatted in Markdown)
4. **Responsorio** (again: V. / R.)
5. **Oración final** + **Amén**

## 4) How to “read” the screen
1. **Top bar**: shows the **current snippet title** + subtitle (when present) and a **dotted progress** of the Group.
2. **Main text**: shows the current snippet text and scrolls slowly through it.
3. **Left panel**: shows the current Group title and a vertical, split-flap style list of snippet titles for “now + next”.

