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
| **שחרית שבת** | **`08:00`** (Wintertime) / **`08:30`** (Summertime / clocks 1 hr forward) | Controlled by `dst` parameter (`dst=true` $\rightarrow$ `08:30`, `dst=false` $\rightarrow$ `08:00`) |
| **סוף זמן קריאת שמע** | סוף זמן קריאת שמע מג״א / גר״א | Fetched directly from 2net |
| **שיעור נשים** | $\text{Shacharit} + 2\text{ hours}$ | `10:00` (Winter) / `10:30` (Summer) |
| **מנחה גדולה שבת** | `12:45` (Winter) / `13:15` (Summer / DST) | Controlled by `dst` parameter |
| **שיעור הרב פרל** | $\text{Mincha Gedola} + 20\text{ min}$ | `13:05` (Winter) / `13:35` (Summer) |
| **מנחה קטנה שבת** | $\text{Shabbat Shkia} - 40\text{ min}$, rounded down to nearest 5 min | Followed by Seudah Shlishit |
| **ערבית מוצאי שבת** | צאת השבת | Fetched directly from 2net |

### כללי שעון קיץ / שעון חורף (Summer & Winter Schedule Rules)
- **שחרית שבת:** מתחילה בשעה **`08:00`** בשעון חורף (Wintertime), ובשעה **`08:30`** בשעון קיץ (Summertime – כאשר מזיזים את השעון שעה אחת קדימה / clocks 1 hour forward).
- **חריג — שבת חול המועד סוכות (Shabbat Chol HaMoed Sukkot):** שחרית מתחילה בשעה **`08:00`** (גם בשעון קיץ / DST) עקב קריאת מגילת קהלת, הושענות ותפילות החג המוארכות.
- **שיעור נשים:** מתחיל שעתיים לאחר שחרית – **`10:00`** בחורף, **`10:30`** בקיץ.  
  *(**אין שיעור נשים בשבת חול המועד** — הן בסוכות והן בפסח — עקב אריכות תפילת שחרית ומוסף).*
- **מנחה גדולה שבת:** מתחילה בשעה **`12:45`** בשעון חורף, ובשעה **`13:15`** בשעון קיץ.
- **מנחה גדולה ערב שבת:** **`14:30`** (פעילה בלוח שעון קיץ בלבד).

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
| **ערב ראש השנה (29 אלול)** | 29 Elul | **מניין א׳:** סליחות **`06:00`**, שחרית (משוער) **`07:00`**<br>**מניין ב׳:** סליחות **`07:30`** (במבואה), שחרית (משוער) **`08:30`** | *אין מניין 07:10*. סליחות ארוכות (*זכור ברית*) והתרת נדרים לאחר שני המניינים |
| **עשרת ימי תשובה (Regular days)** | Weekdays 3–8 Tishrei (except Tzom Gedaliah) | **`05:50`** | Monday through Thursday |
| **צום גדליה** | 3 Tishrei (or 4 Tishrei when postponed from Shabbat) | **`05:45`** | סליחות ארוכות יותר (כוללות פיוטי תענית); מקדימות את מניין שחרית ראשון ב-06:15 |
| **ערב יום כיפור (9 תשרי)** | 9 Tishrei | **`06:00`** | סליחות קצרות של ערב יום כיפור |

### פרטי סדר תפילות ערב ראש השנה (29 אלול)
- **מניין ראשון (השכמה):**
  - **סליחות:** **`06:00`**
  - **שחרית (זמן משוער):** **`07:00`** *(מיד לאחר הסליחות הארוכות "זכור ברית" והתרת נדרים)*
- **מניין שני:**
  - **אין מניין שחרית בשעה 07:10.**
  - **סליחות (במבואה):** **`07:30`**
  - **שחרית (זמן משוער):** **`08:30`** *(לאחר הסליחות והתרת נדרים)*

### פרטי סדר תפילות ערב יום כיפור (9 תשרי)
- **סליחות:** בשעה **`06:00`** בבוקר (סליחות קצרות ללא תחנון ווידוי באשמורת).

### סליחות חצות לילה ושיעור מקדים (Midnight Selichot)
- **מועד:** מתקיים **אך ורק במוצאי שבת ראשונה של סליחות** (First Motzaei Shabbat of Selichot ONLY).
- **שיעור מקדים:** שעת השיעור המקדים תיקבע ל-15 דקות לפני חצות הלכתי, ותעוגל תמיד כלפי מטה ל-5 דקות הקודמות:
  $$\text{Shiur Time} = \lfloor (\text{Halachic Midnight} - 15\text{ min}) \rfloor_{5\text{ min}}$$
  * *דוגמה:* כאשר חצות לילה הלכתי חל ב-`00:38`, הפחתת 15 דק׳ מניבה `00:23`, המתעגלת מטה ל-**`00:20`**.
  * השיעור נמסר בדרך כלל על ידי **הרב כ״ץ (Rav Katz)**.
- **זמן סליחות חצות:** מתחילות בדיוק ב**חצות לילה הלכתי (Halachic Midnight)** (מחושב מ-2net / חצות הלכתי, בד״כ סביב `00:35`–`00:40` בשעון קיץ / `23:35`–`23:40` בשעון חורף).

---

## 5. Fast Days (צומות ותעניות)

Applies to **Asara B'Tevet**, **Ta'anit Esther**, **17 Tammuz**, **Tzom Gedaliah**, and **Tisha B'Av** (excludes Yom Kippur):

| Prayer | Minor Fasts (י׳ בטבת, תענית אסתר, י״ז בתמוז) | Tisha B'Av (תשעה באב) | Calculation & Rationale |
| :--- | :--- | :--- | :--- |
| **שחרית** | **`06:05`** (early minyan) + `06:15`, `07:10`, `08:30` | **`07:00`** and **`08:30`** only | *`06:05` applies ONLY to 17 Tammuz, 10 Tevet, and Ta'anit Esther.* 9 Av has late minyanim with Kinot |
| **מנחה** | $\text{Shkia} - 20\text{ min}$, rounded down to 5 min | $\text{Shkia} - 20\text{ min}$, rounded down to 5 min | Earlier start for Torah reading (ויחל), Haftarah, and Birkat Kohanim (e.g. `19:20` on 17 Tammuz) |
| **ערבית / צאת הצום** | $\text{Shkia} + 18\text{ min}$ | $\text{Shkia} + 18\text{ min}$ | Exact Tzet HaKochavim / Motzei HaTzom on the fast date |

### Tzom Gedaliah Shacharit Exception (החרגת שחרית צום גדליה)
- **החרגת צום גדליה ממניין 06:05 והסבר:**
  - מניין השכמה ב-**`06:05`** חל אך ורק בצומות הקלים הרגילים (י״ז בתמוז, עשרה בטבת, תענית אסתר) שבהם סליחות נאמרות בתוך התפילה.
  - בצום גדליה (החל בעשרת ימי תשובה) הסליחות נאמרות לפני התפילה (בשעה **`05:45`**), ולכן **אין מניין ב-`06:05`**, אלא מניין שחרית ראשון ב-**`06:15`** ומניין שני ב-**`07:10`** בלבד:
    - **סליחות:** **`05:45`** (סליחות צום גדליה ארוכות יותר וכוללות פיוטי תענית, שעתן מעוגנת ל-05:45 כדי להספיק לסיים לקראת שחרית ב-06:15)
    - **שחרית מניין א׳:** **`06:15`** (קריאת התורה *ויחל*)
    - **שחרית מניין ב׳:** **`07:10`** (קריאת התורה *ויחל*)
    - *אין מניין 06:05 בצום גדליה.*

---

## 6. Chol HaMoed (חול המועד - פסח וסוכות)

### ימי חול המועד (Weekdays of Chol HaMoed)
Applies to weekdays of **Chol HaMoed Pesach** (16–20 Nisan) and **Chol HaMoed Sukkot** (16–21 Tishrei / Hoshana Rabbah):
- **שחרית חוה״מ:** **`07:00`** and **`08:30`** only.
- Regular `06:15` minyan is suspended during Chol HaMoed.
- Displayed with day indicators, e.g., `חוה"מ (ד'-ו') – שחרית: 07:00, 08:30`.

### שבת חול המועד (Shabbat Chol HaMoed)
- **שחרית שבת חוה״מ סוכות:** **`08:00`** (גם בשעון קיץ / DST) עקב קריאת מגילת קהלת, הושענות ומוסף מוארך של חג.
- **שחרית שבת חוה״מ פסח:** **`08:30`** (קיץ) / **`08:00`** (חורף), קריאת מגילת שיר השירים.
- **שיעור נשים:** **מבוטל לחלוטין בכל שבת חול המועד** (הן בפסח והן בסוכות) עקב אריכות תפילת שחרית.

---

---

## 7. Rosh Hashanah Times & Calculations (זמני תפילות ראש השנה)

Based on the established schedule for **בית כנסת משכן לוי**, here are the exact calculation rules and halachic logic for all Rosh Hashanah services:

### A. ערב ראש השנה (29 אלול)
| Prayer / Event | Time Calculation | Notes |
| :--- | :--- | :--- |
| **סליחות ושחרית מניין א׳** | סליחות **`06:00`**, שחרית (זמן משוער) **`07:00`** | מניין השכמה עם סליחות ארוכות (*זכור ברית*) והתרת נדרים |
| **סליחות מניין ב׳** | **`07:30`** | מתחיל במבואה (*אין מניין שחרית ב-07:10*) |
| **שחרית מניין ב׳** | שחרית (זמן משוער) **`08:30`** | לאחר סליחות מניין ב׳ והתרת נדרים |
| **מנחה גדולה ערב ר״ה** | **`14:30`** | שעון קיץ |
| **מנחה ערב ר״ה** | $\text{Shkia} - 15\text{ to }16\text{ min}$, מעוגל מטה ל-5 דק׳ | e.g. שקיעה `18:36` $\rightarrow$ `18:20` (לאחריה דבר תורה) |
| **ערבית יום א׳ של ר״ה** | **צאת הכוכבים המדויק** מ-2net ($\text{Shkia} + 19\text{–}20\text{ min}$) | e.g. `18:56` / `19:10` |

### B. יום א׳ של ראש השנה (1 תשרי)
| Prayer / Event | Time Calculation | Halachic Notes |
| :--- | :--- | :--- |
| **שחרית יום א׳** | **`07:30`** | תפילת חג |
| **תקיעת שופר (משוער)** | **`09:30`** | **רק כאשר יום א׳ אינו שבת!** (אם יום א׳ חל בשבת — אין תוקעים בשופר ביום א׳) |
| **מנחה קטנה** | **`18:00`** | בשבת קודש: מאפשר שהות מספקת לסעודה שלישית לפני השקיעה; בימי חול: מאפשר שהות לתשליך |
| **תשליך** | לאחר מנחה קטנה | **רק כאשר יום א׳ חל ביום חול** (אם יום א׳ שבת — נדחה ליום ב׳) |
| **ערבית ליל ב׳ (מוצאי שבת)** | **`19:27`** | צאת השבת |
| **הכנות / הדלקת נרות ליום ב׳** | **`19:27`** | מצאת השבת בלבד; חל איסור מוחלט להכין מיום א׳ ליום ב׳ לפני זמן זה |

### C. יום ב׳ של ראש השנה (2 תשרי)
| Prayer / Event | Time Calculation | Halachic Notes |
| :--- | :--- | :--- |
| **שחרית יום ב׳** | **`07:30`** | תפילת חג |
| **תקיעת שופר (משוער)** | **`09:30`** | תקיעות דמיושב ומוסף (חובה בכל שנה) |
| **מנחה קטנה** | **`18:00`** | מאפשר שהות מספקת לאמירת תשליך בציבור לפני השקיעה |
| **תשליך** | לאחר מנחה קטנה | **נאמר בציבור ביום ב׳ כאשר יום א׳ של ר״ה חל בשבת** |
| **שיעור בהיכל בית הכנסת** | **`19:00`** | שיעור בהיכל בית הכנסת |
| **ערבית מוצאי יום ב׳ (צאת החג)** | **`19:27`** | צאת החג, ולאחריה הבדלה |

---

---

## 8. Yom Kippur Times & Calculations (זמני תפילות יום הכיפורים)

Based on the established schedule for **בית כנסת משכן לוי**, here are the exact calculation rules and halachic formulas for Yom Kippur services:

### A. ערב יום הכיפורים (9 תשרי)
| Service / Event | Time Calculation | 2025 Sample (`Shkia=18:26`) | Halachic Rationale & Notes |
| :--- | :--- | :--- | :--- |
| **סליחות ערב יו״כ** | **`06:00`** | `06:00` | סליחות קצרות ללא תחנון ווידוי באשמורת |
| **שחרית ערב יו״כ** | **`06:25`** / **`07:10`** | `06:25` / `07:10` | ללא מזמור לתודה, תחנון ואבינו מלכנו |
| **מנחה ערב כיפור** | **`14:30`** (שעון קיץ) | `14:30` | מנחה מוקדמת עם וידוי (*על חטא*) לפני סעודה מפסקת |
| **תפילה זכה** | $\text{Shkia} - 25\text{ to }26\text{ min}$ (או 5 דק׳ לפני כל נדרי) | `18:00` | נאמרת ביחידות לפני תחילת התפילה בציבור |
| **כל נדרי** | $\text{Shkia} - 20\text{ to }21\text{ min}$ | `18:05` | **חובה להתחיל מבעוד יום** לפני השקיעה להתרת נדרים |
| **שקיעה (Sunset)** | שקיעה נראית / מישורית מ-2net | `18:26` | זמן השקיעה המדויק |
| **ערבית (Arvit / Maariv)** | $\text{Shkia} + 20\text{ min}$ | `18:46` | תחילת קריאת שמע וברכותיה בצאת הכוכבים |

### B. יום הכיפורים (10 תשרי)
| Service / Event | Time Calculation | 2025 Sample (`Shkia=18:24`) | Halachic Rationale & Notes |
| :--- | :--- | :--- | :--- |
| **שחרית** | **`07:30`** | `07:30` | פיוטי שחרית, קריאת התורה, יזכור ומוסף |
| **מנחה** | $\text{Shkia} - 150\text{ min}$ (שעתיים וחצי לפני שקיעה) | `15:55` | קריאת פרשת עריות, הפטרת יונה, ותפילת עמידה עם וידוי |
| **שיחה / שיעור** | בין מנחה לנעילה | לפי הודעה | דברי התעוררות לקראת חתימת הדין |
| **נעילה** | $\text{Shkia} - 74\text{ to }75\text{ min}$ | `17:10` | תחילת תפילת נעילה מבעוד יום כדי שהחזרת הש״ץ תגיע לעיצומה בשקיעה |
| **שקיעה (Sunset)** | שקיעה מ-2net | `18:24` | שקיעת החמה |
| **תקיעת שופר** | $\text{Shkia} + 20\text{ to }21\text{ min}$ | `18:45` | בצאת הכוכבים עם סיום פסוקי "ה׳ הוא האלקים" |
| **צאת הצום וערבית** | $\text{Shkia} + 35\text{ to }36\text{ min}$ | `19:00` | צאת הצום לכל הדעות, תפילת ערבית, הבדלה (על נר ששבת) וקידוש לבנה |

---

## 9. System Architecture & Distribution

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

---

### 10. Astronomical Data Query Parameter Rule (שליפת זמנים מלוח 2net מבוא חורון)

When querying astronomical data from the **2net Mevo Horon portal** (`calendar.2net.co.il`), all automated calls, scripts, or references must include the explicit target date parameter (`&today=YYYYMMDD`) to ensure precise astronomical calculations and prevent falling back to the current machine date.
בכל פנייה לשליפת נתונים אסטרונומיים מלוח 2net מבוא חורון יש לצרף את פרמטר התאריך המפורש: `&today=YYYYMMDD`.


