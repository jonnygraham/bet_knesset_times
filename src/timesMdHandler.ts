import { calculateTimes } from "./lookupTimes";

export function formatTimesMarkdown(times: any): string {
  let title = `בית כנסת משכן לוי מבוא חורון\nשבת – פרשת ${times.parsha}`;
  if (times.is_shabbat_mevarchim) {
    title += ' – שבת מברכים';
  }
  if (times.shabbat_special) {
    title += ` ${times.shabbat_special} –`;
  }

  const lines: string[] = [
    title,
    'מנחה גדולה ערב שבת – 14:30',
    `מנחה ערב שבת – ${times.erev_mincha}`,
    'קבלת שבת וערבית',
    `שחרית – ${times.day_shacharit}`,
  ];

  if (times.day_womens_shiur) {
    lines.push(`שיעור לנשים – ${times.day_womens_shiur}`);
  }

  lines.push(
    `מנחה גדולה – ${times.day_mincha_1}`,
    `שיעור – הרב מנחם פרל – ${times.day_mincha_1_shiur}`,
    `מנחה קטנה – ${times.day_mincha_2}`,
    `ערבית מוצאי שבת – ${times.motzash_arvit}`,
    'שבת שלום',
    '',
    'זמני תפילות ימי חול',
  );

  // Weekday Times
  if (times.has_selichot) {
    if (times.has_tzom_gedaliah) {
      let selichotLine = `סליחות – צום גדליה (${times.tzom_gedaliah_day_str}) ${times.tzom_gedaliah_selichot}`;
      if (times.has_other_selichot) {
        selichotLine += `, שאר הימים ${times.week_selichot}`;
      }
      lines.push(selichotLine);
    } else {
      lines.push(`סליחות – ${times.week_selichot}`);
    }
  }

  // Shacharit
  let shacharitLine = `שחרית – ${times.week_shacharit_1},  ${times.week_shacharit_2}`;
  if (times.week_shacharit_3) {
    shacharitLine += `, ${times.week_shacharit_3}`;
  }
  if (times.has_rosh_chodesh) {
    shacharitLine += `, ר"ח (${times.rosh_chodesh_days_str}) ${times.week_shacharit_rh}`;
  }
  if (times.has_fast && times.week_shacharit_fast) {
    shacharitLine += `, ${times.fast_name} (${times.fast_days_str}) ${times.week_shacharit_fast}`;
  }
  lines.push(shacharitLine);

  // Mincha
  let minchaLine = `מנחה – ${times.week_mincha}`;
  if (times.has_fast) {
    minchaLine += `, ${times.fast_name} ${times.fast_mincha}`;
  }
  lines.push(minchaLine);

  // Arvit
  let arvitLine = `ערבית – ${times.week_arvit_1}`;
  if (times.has_fast) {
    arvitLine += `, מוצאי ${times.fast_name} ${times.fast_arvit}`;
  }
  lines.push(arvitLine);

  return lines.join('\n');
}

export async function handler(event: any) {
  const params = event.queryStringParameters ?? {};
  const times = await calculateTimes(params);
  const md = formatTimesMarkdown(times);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
    },
    body: md,
  };
}
