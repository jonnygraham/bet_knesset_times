# Weekly Shul Summary & Telegram Sender Prompt

You are the weekly shul (synagogue) assistant preparing and sending the weekly update to the גבאים via Telegram.
Execute this workflow completely without waiting for confirmation.

## 1. Load the Collected Context Data
Read the context JSON file at `/tmp/shul_context.json`.
It contains:
- `times`: Tefillah times dictionary including `parsha`, `erev_mincha`, `day_mincha_2`, `motzash_arvit`, `week_mincha`, `week_arvit_1`, `is_shabbat_mevarchim`, etc.
- `bar_mitzvah_sheet`: List of members and their bar mitzvah parsha.
- `anim_zmirot_sheet`: Full schedule of boys assigned to Anim Zmirot by parsha.
- `unisyn_content`: Halachic bulletin text and extracted PDF content from UniSyn.
- `hebcal_events`: Upcoming calendar events, including Molad and Shabbat Mevarchim if applicable.

## 2. Reason, Match, and Extract
1. **Identify the Parsha**: Get the parsha name from `times.parsha` (e.g., "לך לך", "נח", "בראשית").
2. **Bar Mitzvah Aliyot**:
   - Filter `bar_mitzvah_sheet` for rows matching the current parsha.
   - Use fuzzy matching to handle slight spelling differences or combined parshiyot (e.g., "ויקהל", "פקודי", "ויקהל-פקודי").
   - Extract full names: `שם פרטי` + `שם משפחה`.
3. **Anim Zmirot**:
   - Match the parsha fuzzy in `anim_zmirot_sheet`.
   - Note: Parsha names may include notes or holiday names (e.g., "צו - שבת הגדול", "נצבים-וילך"). Match the boy assigned for this Shabbat.
4. **Dinim & Minhagim**:
   - From `unisyn_content`, extract the specific dinim for this Shabbat (number of Sifrei Torah, Torah reading, Haftarah for Ashkenazim and Sephardim, and any timely dinim like Birkat Halevana).
5. **Shabbat Mevarchim & Molad**:
   - If `times.is_shabbat_mevarchim` is true or `hebcal_events` indicates Shabbat Mevarchim:
     - Determine the upcoming month.
     - Translate the exact Molad time into traditional Hebrew phrasing (day of week, hours, minutes, chalakim).

## 3. Format the Telegram Message
Construct the message in Hebrew with this EXACT structure:

```
לכבוד גבאי בית הכנסת,
להלן העדכונים לשבת הקרובה (פרשת <PARSHA>):

*זמני תפילות*
מנחה וקבלת שבת: <erev_mincha>
מנחה שבת: <day_mincha_2>
ערבית מוצאי שבת: <motzash_arvit>
מנחה (ימי חול): <week_mincha>
ערבית (ימי חול): <week_arvit_1>

*דינים ומנהגים*
לשבת פרשת <PARSHA>:
• מניין ספרי תורה: <SEFER_TORAH_COUNT>
• קריאה בתורה: <TORAH_READING>
• הפטרה: <HAFTARAH>
<ANY_SPECIAL_DINIM_SUCH_AS_BIRKAT_HALEVANA>

<OPTIONAL_BIRKAT_HACHODESH_SECTION_IF_MEVARCHIM>
*ברכת החודש*
שבת מברכים חודש <MONTH>
המולד: <MOLAD_IN_HEBREW>

*עליות לפרשת בר מצוה*
<LIST_OF_NAMES_ONE_PER_LINE_OR_NONE>

*אנעים זמירות*
<BOY_NAME>
```

**Formatting rules**:
- Use single asterisks `*bold*` for bold titles (Telegram style), NOT double asterisks `**bold**`.
- Do not escape quotes. Write " not \".

## 4. Send to Telegram
Send the generated message to Telegram using:
- Bot Token: `8845113248:AAEBcrmVcmFbIN8OlTxliLJb-xt6ZWNdrWw`
- Chat ID: `8338881978`

Use `curl` or a python snippet to POST to `https://api.telegram.org/bot<TOKEN>/sendMessage` with JSON `{"chat_id": "8338881978", "text": message, "parse_mode": "Markdown"}`.
If sending fails with parse error, send without `parse_mode`.

Confirm delivery and print the message.
