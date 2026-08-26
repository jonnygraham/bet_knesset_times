# Prayer Times Schedule Rules & Logic (כללי ולוח זמני תפילות)

**Synagogue:** בית כנסת משכן לוי, מבוא חורון (Bet Knesset Mishkan Levi, Mevo Horon)  
**Location:** מבוא חורון (Mevo Horon, Israel)  
**Astronomical Times Source:** [2net Mevo Horon](https://calendar.2net.co.il/todaytimes.aspx?city=%D7%9E%D7%91%D7%95%D7%90%20%D7%97%D7%95%D7%A8%D7%95%D7%9F) & [Hebcal Jewish Calendar API](https://www.hebcal.com)

---

## 1. Shabbat Times (זמני שבת)

| Prayer / Event | Timing Calculation | Notes / Custom |
| :--- | :--- | :--- |
| **מנחה גדולה ערב שבת** | `14:30` | Active in summer schedule |
| **מנחה וקבלת שבת** | $\text{Shabbat Shkia} - 14\text{ min}$, rounded down to nearest 5 min | e.g. Shkia `19:44` $\rightarrow$ `19:30` |
| **שחרית שבת** | `08:00` (Winter) / `08:30` (Summer / DST) | Controlled by `dst` parameter |
| **סוף זמן קריאת שמע** | סוף זמן קריאת שמע מג״א / גר״א | Fetched directly from 2net |
| **שיעור נשים** | $\text{Shacharit} + 2\text{ hours}$ | `10:00` (Winter) / `10:30` (Summer) |
| **מנחה גדולה שבת** | `12:45` (Winter) / `13:15` (Summer / DST) | Controlled by `dst` parameter |
| **שיעור הרב פרל** | $\text{Mincha Gedola} + 20\text{ min}$ | `13:05` (Winter) / `13:35` (Summer) |
| **מנחה קטנה שבת** | $\text{Shabbat Shkia} - 40\text{ min}$, rounded down to nearest 5 min | Followed by Seudah Shlishit |
| **ערבית מוצאי שבת** | צאת השבת | Fetched directly from 2net |

### Shabbat Titles & Special Shabbatot
- **שבת מברכים (Shabbat Mevarchim):** Appended to flyer title (`שבת – פרשת {parsha} – שבת מברכים`) on the Shabbat preceding Rosh Chodesh of any month **except Chodesh Tishrei** (Rosh Hashanah is not blessed). Also applies when Rosh Chodesh falls on the following Friday or Shabbat.
- **Special Shabbatot:** Custom parsha labels (e.g. שקלים, זכור, פרה, החודש, הגדול, שובה).

---

## 2. Regular Weekday Times (זמני ימי חול)

| Prayer / Minyan | Time | Notes |
| :--- | :--- | :--- |
| **שחרית מניין ראשון** | `06:15` | Sunday through Friday |
| **שחרית מניין שני** | `07:10` | Sunday through Friday |
| **שחרית יום ו׳** | `08:30` | Friday only (`יום ו 08:30`) |
| **מנחה חול** | $\min(\text{Shkia}_{\text{Sun}}, \text{Shkia}_{\text{Thu}}) - 13\text{ min}$, rounded down to 5 min | Based on earliest sunset of the week |
| **ערבית חול** | $\max(\text{Shkia}_{\text{Sun}}, \text{Shkia}_{\text{Thu}}) + 20\text{ min}$, rounded up to 5 min | Based on latest tzet of the week |
| **שיעור דף יומי (הרב ברוכים)** | `22:00` | Sunday through Thursday |

---

## 3. Rosh Chodesh (ראש חודש)

- **Early Shacharit Minyan:** **`06:05`** on all Rosh Chodesh days.
- **Other Minyanim:** `07:10` and Friday `08:30` remain active as normal.
- **Display Labeling:** Annotated with specific days of the week, e.g., `שחרית ר"ח (ג', ד') 06:05`.

---

## 4. Selichot (סליחות - מנהג אשכנז)

Ashkenazi custom requires at least 4 days of Selichot before Rosh Hashanah:

| Period | Start Condition | Selichot Time | Notes |
| :--- | :--- | :--- | :--- |
| **חודש אלול (Single-week)** | 1 Tishrei falls on Thursday or Shabbat $\rightarrow$ Starts Motzaei Shabbat 26 or 24 Elul | **`05:55`** | 4 to 6 days before Rosh Hashanah |
| **חודש אלול (Multi-week)** | 1 Tishrei falls on Monday or Tuesday $\rightarrow$ Starts Motzaei Shabbat 22 or 21 Elul | **`05:55`** | Two full weeks of Selichot before RH |
| **ערב ראש השנה (29 אלול)** | 29 Elul | **מניין א׳:** סליחות **`05:50`**, שחרית **~`06:40`**<br>**מניין ב׳:** סליחות **`07:30`** (במבואה), שחרית **`08:30`** | *אין מניין 07:10*. סליחות ארוכות (*זכור ברית*) והתרת נדרים לאחר שני המניינים |
| **עשרת ימי תשובה (Regular days)** | Weekdays 3–8 Tishrei (except Tzom Gedaliah) | **`05:50`** | Monday through Thursday |
| **צום גדליה** | 3 Tishrei (or 4 Tishrei when postponed from Shabbat) | **`05:45`** | Earlier start due to extended fast Selichot |
| **ערב יום כיפור (9 תשרי)** | 9 Tishrei | **`06:00`** | סליחות קצרות של ערב יום כיפור |

### פרטי סדר תפילות ערב ראש השנה (29 אלול)
- **מניין ראשון (השכמה):** סליחות בשעה **`05:50`**, שחרית מתחילה לאחר הסליחות הארוכות (זכור ברית) בסביבות **`06:40`**.
- **מניין שני:**
  - **אין מניין שחרית בשעה 07:10.**
  - **סליחות:** מתחילות בשעה **`07:30`** (מתחיל במבואה).
  - **שחרית:** מתחילה בשעה **`08:30`**.
- **התרת נדרים:** מתקיימת לאחר שני המניינים.

### פרטי סדר תפילות ערב יום כיפור (9 תשרי)
- **סליחות:** בשעה **`06:00`** בבוקר (סליחות קצרות ללא תחנון ווידוי באשמורת).

### סליחות חצות לילה ושיעור מקדים (Midnight Selichot)
- **מועד:** מתקיים **אך ורק במוצאי שבת ראשונה של סליחות** (First Motzaei Shabbat of Selichot ONLY).
- **שיעור מקדים:** מתחיל **15 דקות לפני חצות הלילה** ($\text{Chatzot} - 15\text{ min}$, e.g. `00:20`), נמסר בדרך כלל על ידי **הרב כ״ץ (Rav Katz)**.
- **זמן סליחות חצות:** מתחילות בדיוק ב**חצות לילה הלכתי (Halachic Midnight)** (מחושב מ-2net / חצות הלכתי, בד״כ סביב `00:35`–`00:40` בשעון קיץ / `23:35`–`23:40` בשעון חורף).

---

## 5. Fast Days (צומות ותעניות)

Applies to **Tzom Gedaliah**, **Asara B'Tevet**, **Ta'anit Esther**, **17 Tammuz**, and **Tisha B'Av** (excludes Yom Kippur):

| Prayer | Minor Fasts (גדליה, י׳ בטבת, אסתר, י״ז בתמוז) | Tisha B'Av (תשעה באב) | Calculation & Rationale |
| :--- | :--- | :--- | :--- |
| **שחרית** | **`06:05`** (early minyan) + `06:15`, `07:10`, `08:30` | **`07:00`** and **`08:30`** only | 9 Av has late morning minyanim with Kinot |
| **מנחה** | $\text{Shkia} - 20\text{ min}$, rounded down to 5 min | $\text{Shkia} - 20\text{ min}$, rounded down to 5 min | Earlier start for Torah reading (ויחל), Haftarah, and Birkat Kohanim (e.g. `19:20` on 17 Tammuz) |
| **ערבית / צאת הצום** | $\text{Shkia} + 18\text{ min}$ | $\text{Shkia} + 18\text{ min}$ | Exact Tzet HaKochavim / Motzei HaTzom on the fast date |

---

## 6. Chol HaMoed (חול המועד - פסח וסוכות)

Applies to weekdays of **Chol HaMoed Pesach** (16–20 Nisan) and **Chol HaMoed Sukkot** (16–21 Tishrei / Hoshana Rabbah):

- **שחרית חוה״מ:** **`07:00`** and **`08:30`** only.
- Regular `06:15` minyan is suspended during Chol HaMoed.
- Displayed with day indicators, e.g., `חוה"מ (ד'-ו') – שחרית: 07:00, 08:30`.

---

---

## 7. Rosh Hashanah Times & Calculations (זמני תפילות ראש השנה)

Based on the established schedule for **בית כנסת משכן לוי**, here are the exact calculation rules and halachic logic for all Rosh Hashanah services:

### A. ערב ראש השנה (29 אלול)
| Prayer / Event | Time Calculation | Notes |
| :--- | :--- | :--- |
| **סליחות ושחרית מניין א׳** | סליחות ב-**`05:50`**, שחרית ב-**~`06:40`** | מניין השכמה עם סליחות ארוכות (*זכור ברית*) |
| **סליחות מניין ב׳** | **`07:30`** | מתחיל במבואה (*אין מניין שחרית ב-07:10*) |
| **שחרית מניין ב׳** | **`08:30`** | לאחר סליחות מניין ב׳ והתרת נדרים |
| **מנחה גדולה ערב ר״ה** | **`14:30`** | שעון קיץ |
| **מנחה ערב ר״ה** | $\text{Shkia} - 15\text{ min}$, מעוגל מטה ל-5 דק׳ | e.g. שקיעה `18:45` $\rightarrow$ `18:30` |
| **ערבית יום א׳ של ר״ה** | $\text{Shkia} + 20\text{ min}$, מעוגל מעלה ל-5 דק׳ | e.g. שקיעה `18:45` $\rightarrow$ `19:05` |

### B. יום א׳ של ראש השנה (1 תשרי)
| Prayer / Event | Time Calculation | Halachic Notes |
| :--- | :--- | :--- |
| **שחרית יום א׳** | **`07:30`** | תפילת חג |
| **תקיעת שופר (משוער)** | **`09:15`** | **רק כאשר יום א׳ אינו שבת!** (אם יום א׳ חל בשבת — אין תוקעים בשופר ביום א׳) |
| **מנחה גדולה** | **`13:15`** (שעון קיץ) / **`12:45`** (שעון חורף) | |
| **שיעור – הרב יואל קטן** | $\text{Mincha Gedola} + 20\text{ min}$ (**`13:35`**) | מתקיים בין מנחה גדולה לצהריים |
| **מנחה קטנה** | $\text{Shkia} - 35\text{ to }40\text{ min}$, מעוגל מטה ל-5 דק׳ | e.g. שקיעה `18:45` $\rightarrow$ `18:15` |
| **תשליך** | לאחר מנחה קטנה | **רק כאשר יום א׳ חל ביום חול** (אם יום א׳ שבת — נדחה ליום ב׳) |
| **ערבית יום ב׳ של ר״ה** | $\text{Shkia} + 20\text{ min}$ (**`19:05`**) | תפילת ליל שני של חג |
| **הכנות / הדלקת נרות ליום ב׳** | **צאת השבת / צאת הכוכבים** המדויק מ-2net | e.g. `19:23`. חל איסור מוחלט להכין מיום א׳ ליום ב׳ לפני זמן זה |

### C. יום ב׳ של ראש השנה (2 תשרי)
| Prayer / Event | Time Calculation | Halachic Notes |
| :--- | :--- | :--- |
| **שחרית יום ב׳** | **`07:30`** | תפילת חג |
| **תקיעת שופר (משוער)** | **`09:15`** | תקיעות דמיושב ומוסף (חובה בכל שנה) |
| **מנחה גדולה** | **`13:15`** (שעון קיץ) / **`12:45`** (שעון חורף) | |
| **שיעור – הרב יואל קטן** | **`13:35`** | |
| **מנחה קטנה** | $\text{Shkia} - 35\text{ to }40\text{ min}$, מעוגל מטה ל-5 דק׳ | e.g. שקיעה `18:44` $\rightarrow$ `18:10` |
| **תשליך** | לאחר מנחה קטנה | **נאמר ביום ב׳ כאשר יום א׳ של ר״ה חל בשבת** |
| **ערבית מוצאי חג** | **צאת הכוכבים / צאת החג** המדויק מ-2net | e.g. `19:22` (ולאחריה הבדלה וצאת החג) |

---

## 8. System Architecture & Distribution

The system generates prayer times across 5 automated channels:

1. **Word Document Flyer (`resources/templates/shabbat.docx`)**: Printed weekly bulletin with conditional sections populated using `docxtemplater`.
2. **Markdown Format (`src/timesMdHandler.ts`)**: Plain Markdown output matching the flyer layout, ideal for chat apps, WhatsApp bots, and web views.
3. **MyGabay Digital Board (`src/timesFileGenerator.ts`)**: Generates 21-slot `ArrayOfTfila` XML schemas and uploads directly to the MyGabay SPA API.
4. **REST JSON API (`src/timesJsonHandler.ts` / `src/lookupTimes.ts`)**: Programmatic endpoint used by the Shul WhatsApp AI agent and automations.
5. **CSV Export (`src/timesCsvGenerator.ts`)**: Tabular export with UTF-8 BOM encoding for spreadsheet planning.

### CloudFront Clean Endpoints
All services are mapped under a unified CloudFront distribution:
- `https://d1dv96azwhiqeg.cloudfront.net/times` $\rightarrow$ JSON API
- `https://d1dv96azwhiqeg.cloudfront.net/md` $\rightarrow$ Markdown Formatted Times
- `https://d1dv96azwhiqeg.cloudfront.net/docx` $\rightarrow$ Word Flyer Generator
- `https://d1dv96azwhiqeg.cloudfront.net/csv` $\rightarrow$ CSV Generator
- `https://d1dv96azwhiqeg.cloudfront.net/upload` $\rightarrow$ MyGabay Uploader
