import moment from 'moment';
import axios from 'axios';

type Moment = moment.Moment;

const timesCache = {};
const hebcalCache: { [key: string]: any } = {};

const SHORT_HEBREW_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'"];

function formatDaysRange(days: string[]): string {
  if (!days || days.length === 0) return '';
  const indices = days.map((d) => SHORT_HEBREW_DAYS.indexOf(d)).filter((idx) => idx !== -1);
  if (indices.length >= 3 && indices.every((val, i) => i === 0 || val === indices[i - 1] + 1)) {
    return `${days[0]}-${days[days.length - 1]}`;
  }
  return days.join(', ');
}

async function fetchHebcalHdates(startDate: Moment, endDate: Moment): Promise<any> {
  const startStr = startDate.format('YYYY-MM-DD');
  const endStr = endDate.format('YYYY-MM-DD');
  const cacheKey = `${startStr}_${endStr}`;
  if (hebcalCache[cacheKey]) {
    return hebcalCache[cacheKey];
  }
  const url = `https://www.hebcal.com/converter?cfg=json&start=${startStr}&end=${endStr}&g2h=1`;
  console.log("Fetching Hebcal: " + url);
  try {
    const result = await axios.get(url);
    hebcalCache[cacheKey] = result.data?.hdates || {};
    return hebcalCache[cacheKey];
  } catch (err) {
    console.error("Error fetching Hebcal dates:", err);
    return {};
  }
}

async function getSelichotStartElulDay(hebrewYear: number): Promise<number> {
  const nextHebrewYear = hebrewYear + 1;
  const cacheKey = `tishrei_1_${nextHebrewYear}`;
  if (hebcalCache[cacheKey] !== undefined) {
    return hebcalCache[cacheKey];
  }
  const url = `https://www.hebcal.com/converter?cfg=json&hy=${nextHebrewYear}&hm=Tishrei&hd=1&h2g=1`;
  console.log("Fetching Hebcal for 1 Tishrei: " + url);
  try {
    const result = await axios.get(url);
    const { gy, gm, gd } = result.data;
    const tishrei1Moment = moment(`${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`, 'YYYY-MM-DD');
    const dayOfWeek = tishrei1Moment.day(); // 0=Sun, 1=Mon, 2=Tue, 4=Thu, 6=Sat
    let startElulDay = 26;
    if (dayOfWeek === 6) startElulDay = 24;
    else if (dayOfWeek === 1) startElulDay = 22;
    else if (dayOfWeek === 2) startElulDay = 21;
    else if (dayOfWeek === 4) startElulDay = 26;

    hebcalCache[cacheKey] = startElulDay;
    return startElulDay;
  } catch (err) {
    console.error("Error fetching 1 Tishrei date:", err);
    return 26;
  }
}

function isFastDay(events: string[], hm: string, hd: number): { name: string; is_tisha_bav: boolean; is_tzom_gedaliah: boolean } | null {
  // Exclude Yom Kippur
  if (events.some((e) => e.includes('Yom Kippur')) || (hm === 'Tishrei' && hd === 10)) {
    return null;
  }
  const fastEvents = events.filter((e) => !e.startsWith('Erev '));
  if (fastEvents.some((e) => e.includes('Gedaliah'))) {
    return { name: 'צום גדליה', is_tisha_bav: false, is_tzom_gedaliah: true };
  }
  if (fastEvents.some((e) => e.includes('Tevet') && (e.includes('Asara') || e.includes('Tenth') || e.includes('Fast') || e.includes('Tzom'))) || (hm === 'Tevet' && hd === 10)) {
    return { name: 'עשרה בטבת', is_tisha_bav: false, is_tzom_gedaliah: false };
  }
  if (fastEvents.some((e) => e.includes('Esther'))) {
    return { name: 'תענית אסתר', is_tisha_bav: false, is_tzom_gedaliah: false };
  }
  if (fastEvents.some((e) => e.includes('Tammuz') && (e.includes('Tzom') || e.includes('Fast') || e.includes('17') || e.includes('Seventeen'))) || (hm === 'Tammuz' && hd === 17)) {
    return { name: 'שבעה עשר בתמוז', is_tisha_bav: false, is_tzom_gedaliah: false };
  }
  if (fastEvents.some((e) => e.includes("Tish'a B'Av") || e.includes("Tish’a B’Av")) || (hm === 'Av' && hd === 9)) {
    return { name: 'תשעה באב', is_tisha_bav: true, is_tzom_gedaliah: false };
  }
  return null;
}

function isCholHaMoedDay(events: string[], hm: string, hd: number): boolean {
  if ((hm === 'Nisan' && hd >= 16 && hd <= 20) || (hm === 'Tishrei' && hd >= 16 && hd <= 21)) {
    return true;
  }
  return events.some((e) => e.includes('CH’’M') || e.includes('Chol') || e.includes('Hoshana Raba') || e.includes('Hoshana Rabbah'));
}

export async function fetchHebrewCalendarWeekInfo(shabbat: Moment) {
  const shabbatDateStr = shabbat.format('YYYY-MM-DD');
  const sunday = shabbat.clone().add(1, 'day');
  const nextShabbat = shabbat.clone().add(7, 'day');

  const hdates = await fetchHebcalHdates(shabbat, nextShabbat);

  const shabbatInfo = hdates[shabbatDateStr];
  const shabbatEvents: string[] = shabbatInfo?.events || [];
  const isShabbatMevarchim = shabbatEvents.some((e: string) => e.includes('Mevarchim'));

  const roshChodeshDays: string[] = [];
  const selichotDays: string[] = [];
  const otherSelichotDays: string[] = [];
  const fastDays: string[] = [];
  const cholHaMoedDays: string[] = [];
  let fastInfo: { name: string; is_tisha_bav: boolean; is_tzom_gedaliah: boolean; date: Moment } | null = null;
  let hasTzomGedaliah = false;
  let tzomGedaliahDayStr = '';
  let elulSelichotCount = 0;
  let aytSelichotCount = 0;

  for (let i = 0; i < 6; i++) {
    const curDate = sunday.clone().add(i, 'day');
    const curDateStr = curDate.format('YYYY-MM-DD');
    const hdateInfo = hdates[curDateStr];
    if (!hdateInfo) continue;

    const shortDay = SHORT_HEBREW_DAYS[i];
    const events: string[] = hdateInfo.events || [];
    const hm: string = hdateInfo.hm || '';
    const hd: number = hdateInfo.hd || 0;
    const hy: number = hdateInfo.hy;

    // Check Rosh Chodesh
    const isRoshChodesh = events.some((e: string) => e.includes('Rosh Chodesh'));
    if (isRoshChodesh) {
      roshChodeshDays.push(shortDay);
    }

    // Check Chol HaMoed
    if (isCholHaMoedDay(events, hm, hd)) {
      cholHaMoedDays.push(shortDay);
    }

    // Check Fast Day
    const fast = isFastDay(events, hm, hd);
    if (fast) {
      fastDays.push(shortDay);
      fastInfo = {
        name: fast.name,
        is_tisha_bav: fast.is_tisha_bav,
        is_tzom_gedaliah: fast.is_tzom_gedaliah,
        date: curDate,
      };
      if (fast.is_tzom_gedaliah) {
        hasTzomGedaliah = true;
        tzomGedaliahDayStr = shortDay;
      }
    }

    // Check Ashkenazi Selichot: 05:55 in Elul, 05:50 in Aseret Yemei Teshuva (05:45 on Tzom Gedaliah, excluding 9 Tishrei / Erev Yom Kippur)
    let isSelichot = false;
    if (hm === 'Elul') {
      const startElulDay = await getSelichotStartElulDay(hy);
      if (hd >= startElulDay && hd <= 29) {
        isSelichot = true;
        elulSelichotCount++;
        otherSelichotDays.push(shortDay);
      }
    } else if (hm === 'Tishrei') {
      // 3 to 8 Tishrei only (exclude 9 Tishrei / Erev Yom Kippur)
      if (hd >= 3 && hd <= 8) {
        isSelichot = true;
        aytSelichotCount++;
        if (!fast || !fast.is_tzom_gedaliah) {
          otherSelichotDays.push(shortDay);
        }
      }
    }

    if (isSelichot) {
      selichotDays.push(shortDay);
    }
  }

  const hasRoshChodesh = roshChodeshDays.length > 0;
  const roshChodeshDaysStr = formatDaysRange(roshChodeshDays);

  const hasCholHaMoed = cholHaMoedDays.length > 0;
  const cholHaMoedDaysStr = formatDaysRange(cholHaMoedDays);

  const hasSelichot = selichotDays.length > 0;
  const selichotDaysStr = formatDaysRange(selichotDays);
  const defaultSelichotTime = (aytSelichotCount > 0 && elulSelichotCount === 0) ? '05:50' : '05:55';
  const hasOtherSelichot = otherSelichotDays.length > 0;
  const otherSelichotDaysStr = formatDaysRange(otherSelichotDays);

  const hasFast = fastDays.length > 0;
  const fastDaysStr = formatDaysRange(fastDays);

  let fastMincha: string | undefined = undefined;
  let fastArvit: string | undefined = undefined;
  if (hasFast && fastInfo) {
    const fastShkia = await fetchTime(fastInfo.date, 'שקיעה מישורית');
    const minchaMoment = fastShkia.clone().subtract(20, 'minute');
    minchaMoment.subtract(minchaMoment.get('minute') % 5, 'minute'); // Round down to 5 minutes
    fastMincha = minchaMoment.format('HH:mm');
    fastArvit = fastShkia.clone().add(18, 'minute').format('HH:mm');
  }

  return {
    isShabbatMevarchim,
    hasRoshChodesh,
    roshChodeshDays,
    roshChodeshDaysStr,
    hasCholHaMoed,
    cholHaMoedDays,
    cholHaMoedDaysStr,
    hasSelichot,
    selichotDays,
    selichotDaysStr,
    defaultSelichotTime,
    hasTzomGedaliah,
    tzomGedaliahDayStr,
    tzomGedaliahSelichot: hasTzomGedaliah ? '05:45' : undefined,
    hasOtherSelichot,
    otherSelichotDaysStr,
    hasFast,
    fastName: fastInfo ? fastInfo.name : undefined,
    isTishaBAv: fastInfo ? fastInfo.is_tisha_bav : false,
    fastDays,
    fastDaysStr,
    fastMincha,
    fastArvit,
  };
}

async function fetchPage(date: Moment): Promise<string> {
  const dateString = date.format('YYYYMMDD');
  console.log("Fetching times page for " + dateString);
  var pageString: string;
  if (timesCache[dateString]) {
    pageString = timesCache[dateString];
    console.log("Found times page in cache");
  } else {
    let url = `https://calendar.2net.co.il/todaytimes.aspx?city=%D7%9E%D7%91%D7%95%D7%90%20%D7%97%D7%95%D7%A8%D7%95%D7%9F&today=${dateString}`;
    console.log("Fetching URL: " + url);
    let result = await axios.get(url);
    pageString = result.data;
    timesCache[dateString] = pageString;
  }
  return pageString
}

export async function fetchTime(date: Moment, timeName: string): Promise<Moment> {
  let page = (await fetchPage(date)).split("\n");
  let r = new RegExp(`${timeName}[^\\d]*(\\d\\d:\\d\\d)`);
  console.log("Using regex " + r);
  return page.map((l: string) => l.match(r)).filter((l: RegExpMatchArray | null) => l)
    .map((m: RegExpMatchArray | null) => moment(m ? m[1] : null, "HH:mm"))[0] as Moment;
}

export async function fetchParsha(date: Moment): Promise<string> {
  let pageString = await fetchPage(date);
  const r = /פרשת השבוע:\s*([\s\S]*?)\s*<\/div>/;
  console.log("Using regex " + r);
  return pageString.match(r)![1];
}

export async function calculateTimes(params: any): Promise<any> {
  const calendar = {
    "2022-11-12": { parsha: "וירא", shkia: "16:42" },
    "2022-11-19": { parsha: "חיי שרה", shkia: "16:39" },
    "2022-11-26": { parsha: "תולדות", shkia: "16:36" },
    "2022-12-03": { parsha: "ויצא", shkia: "16:36" },
    "2022-12-10": { parsha: "וישלח", shkia: "16:36" },
    "2022-12-17": { parsha: "וישב", shkia: "16:38" },
    "2022-12-24": { parsha: "מקץ", shkia: "16:42" },
    "2022-12-31": { parsha: "ויגש", shkia: "16:46" },
    "2023-01-07": { parsha: "ויחי", shkia: "16:51" },
    "2023-01-14": { parsha: "שמות", shkia: "16:57" },
    "2023-01-21": { parsha: "וארא", shkia: "17:04" },
    "2023-01-28": { parsha: "בא", shkia: "17:10" },
    "2023-02-04": { parsha: "בשלח", shkia: "17:16" },
    "2023-02-11": { parsha: "יתרו", shkia: "17:23" },
    "2023-02-18": { parsha: "משפטים", shkia: "17:29", special: "שקלים" },
    "2023-02-25": { parsha: "תרומה", shkia: "17:34" },
    "2023-03-04": { parsha: "תצוה", shkia: "17:40", special: "זכור" },
    "2023-03-11": { parsha: "כי תשא", shkia: "17:45" },
    "2023-03-18": { parsha: "ויקהל פקודי", shkia: "17:50", special: "ר״ח - החודש" },
    "2023-03-25": { parsha: "ויקרא", shkia: "18:54" },
    "2023-04-01": { parsha: "צו", shkia: "18:59", special: "הגדול" },
    "2023-04-08": { parsha: "שבת חול המועד", shkia: "19:04" },
    "2023-04-15": { parsha: "שמיני", shkia: "19:09" },
    "2023-04-22": { parsha: "תזריע מצורע", shkia: "19:13" },
    "2023-04-29": { parsha: "אחרי מות קדושים", shkia: "19:18" },
    "2023-05-06": { parsha: "אמור", shkia: "19:23" },
    "2023-05-13": { parsha: "בהר בחוקותי", shkia: "19:28" },
    "2023-05-20": { parsha: "במדבר", shkia: "19:33" },
    "2023-05-27": { parsha: "נשא", shkia: "19:38" },
    "2023-06-03": { parsha: "בהעלותך", shkia: "19:42" },
    "2023-06-10": { parsha: "שלח", shkia: "19:45" },
    "2023-06-17": { parsha: "קרח", shkia: "19:48" },
    "2023-06-24": { parsha: "חקת", shkia: "19:49" },
    "2023-07-01": { parsha: "בלק", shkia: "19:50" },
    "2023-07-08": { parsha: "פנחס", shkia: "19:49" },
    "2023-07-15": { parsha: "מטות ומסעי", shkia: "19:47" },
    "2023-07-22": { parsha: "דברים", shkia: "19:44" },
    "2023-07-29": { parsha: "ואתחנן", shkia: "19:39" },
    "2023-08-05": { parsha: "עקב", shkia: "19:34" },
    "2023-08-12": { parsha: "ראה", shkia: "19:27" },
    "2023-08-19": { parsha: "שופטים", shkia: "19:20" },
    "2023-08-26": { parsha: "כי תצא", shkia: "19:12" },
    "2023-09-02": { parsha: "כי תבוא" }
  };

  const daysUntilSaturday = (6 - (moment().day() + 1) % 7) % 7 + 1;
//  const shabbat = moment().add(6 - moment().day(), 'day');
  var shabbat = moment().add(daysUntilSaturday, 'day');
  if (params.shabbat) {
     shabbat = moment(params.shabbat,"YYYY-MM-DD");
  }
  const shabbatDate = shabbat.format("YYYY-MM-DD");
  console.log("Shabbat date is " + shabbatDate);
  console.log("Calendar details for this date: " + calendar[shabbatDate]);

  const parsha = params.parsha ?? await fetchParsha(shabbat);
  console.log(`Parsha ${parsha}`);

  const shkia = params.shkia ?? (await fetchTime(shabbat, 'שקיעה מישורית')); //calendar[shabbatDate].shkia;

  const shkiaMoment = moment(shkia, "HH:mm");
  const erev_mincha = shkiaMoment.clone().subtract(14, 'minute');
  erev_mincha.subtract(erev_mincha.get('minute') % 5, 'minute'); // Round down to 5 minutes

  const day_mincha_2 = shkiaMoment.clone().subtract(40, 'minute');
  day_mincha_2.subtract(day_mincha_2.get('minute') % 5, 'minute'); // Round down to 5 minutes
  const sof_zman_shema = await fetchTime(shabbat, 'סוף זמן קריאת שמע גרא');
  //const dst = shkiaMoment.isDST();

  const day_shacharit = moment('08:00', 'HH:mm');
  const day_mincha_1 = moment('12:45', 'HH:mm');
  if (params.dst === "true") {
    day_shacharit.add(30, 'minute');
    day_mincha_1.add(30, 'minute');
  }
  const day_mincha_1_shiur = day_mincha_1.clone().add(20, 'minute');
  const day_womens_shiur = day_shacharit.clone().add(2, 'hour');
  // if (params.dst !== "true") {
  //   day_womens_shiur.add(10, 'minute');
  // }

  const motzash_arvit = await fetchTime(shabbat, 'צאת השבת');

  // Weekday times

  const sunday = shabbat.clone().add(1, 'day');
  const thursday = shabbat.clone().add(5, 'day');

  const shkia1 = await fetchTime(sunday, 'שקיעה מישורית');
  const shkia2 = await fetchTime(thursday, 'שקיעה מישורית');
  console.log("Sunday shkia: " + shkia1);
  console.log("Thursday shkia: " + shkia2);
  const earliestShikia = shkia1.isBefore(shkia2) ? shkia1 : shkia2;
  console.log("Earliest shkia: " + earliestShikia);
  const week_mincha = earliestShikia.clone().subtract(13, 'minute');
  week_mincha.subtract(week_mincha.get('minute') % 5, 'minute'); // Round down to 5 minutes
  console.log("Weekday mincha: " + week_mincha);

  const tzet1 = shkia1.add(20, 'minute');
  //const tzet1 = await fetchTime(sunday, 'צאת הכוכבים');
  const tzet2 = shkia2.add(20, 'minute');
  //const tzet2 = await fetchTime(thursday, 'צאת הכוכבים');
  console.log("Sunday tzet: " + tzet1);
  console.log("Thursday tzet: " + tzet2);
  const latestTzet = tzet1.isAfter(tzet2) ? tzet1 : tzet2;
  console.log("Latest tzet: " + latestTzet);
  const week_arvit_1 = latestTzet.clone();
  if (week_arvit_1.get('minute') % 5 > 0) {
    week_arvit_1.add(5 - week_arvit_1.get('minute') % 5, 'minute'); // Round up to 5 minutes
  }

  console.log("Weekday arvit: " + week_arvit_1);

  const weekHebrewInfo = await fetchHebrewCalendarWeekInfo(shabbat);

  const has_rosh_chodesh = params.has_rosh_chodesh !== undefined
    ? params.has_rosh_chodesh === "true" || params.has_rosh_chodesh === true
    : weekHebrewInfo.hasRoshChodesh;

  const rosh_chodesh_days = weekHebrewInfo.roshChodeshDays;
  const rosh_chodesh_days_str = params.rosh_chodesh_days_str ?? weekHebrewInfo.roshChodeshDaysStr;

  const has_selichot = params.has_selichot !== undefined
    ? params.has_selichot === "true" || params.has_selichot === true
    : weekHebrewInfo.hasSelichot;

  const selichot_days = weekHebrewInfo.selichotDays;
  const selichot_days_str = params.selichot_days_str ?? weekHebrewInfo.selichotDaysStr;
  const week_selichot = params.week_selichot ?? weekHebrewInfo.defaultSelichotTime;

  const has_chol_hamoed = params.has_chol_hamoed !== undefined
    ? params.has_chol_hamoed === "true" || params.has_chol_hamoed === true
    : weekHebrewInfo.hasCholHaMoed;
  const chol_hamoed_days = weekHebrewInfo.cholHaMoedDays;
  const chol_hamoed_days_str = params.chol_hamoed_days_str ?? weekHebrewInfo.cholHaMoedDaysStr;

  const has_fast = params.has_fast !== undefined
    ? params.has_fast === "true" || params.has_fast === true
    : weekHebrewInfo.hasFast;
  const fast_name = params.fast_name ?? weekHebrewInfo.fastName;
  const is_tisha_bav = params.is_tisha_bav !== undefined
    ? params.is_tisha_bav === "true" || params.is_tisha_bav === true
    : weekHebrewInfo.isTishaBAv;
  const fast_days = weekHebrewInfo.fastDays;
  const fast_days_str = params.fast_days_str ?? weekHebrewInfo.fastDaysStr;
  const fast_mincha = params.fast_mincha ?? weekHebrewInfo.fastMincha;
  const fast_arvit = params.fast_arvit ?? weekHebrewInfo.fastArvit;
  const week_shacharit_fast = params.week_shacharit_fast ?? (is_tisha_bav ? "07:00, 08:30" : "06:05");

  const has_tzom_gedaliah = weekHebrewInfo.hasTzomGedaliah;
  const tzom_gedaliah_day_str = weekHebrewInfo.tzomGedaliahDayStr;
  const tzom_gedaliah_selichot = weekHebrewInfo.tzomGedaliahSelichot;
  const has_other_selichot = weekHebrewInfo.hasOtherSelichot;
  const other_selichot_days_str = weekHebrewInfo.otherSelichotDaysStr;

  const is_shabbat_mevarchim = params.is_shabbat_mevarchim !== undefined
    ? params.is_shabbat_mevarchim === "true" || params.is_shabbat_mevarchim === true
    : weekHebrewInfo.isShabbatMevarchim;
  const shabbat_mevarchim = is_shabbat_mevarchim ? "שבת מברכים" : undefined;

  let defaultShacharit1 = "06:15";
  let defaultShacharit2 = "07:10";
  let defaultShacharit3 = "יום ו 08:30";
  if (has_chol_hamoed || is_tisha_bav) {
    defaultShacharit1 = "07:00";
    defaultShacharit2 = "08:30";
    defaultShacharit3 = "";
  }

  const calculatedParams = {
    ...params,
    parsha: parsha,
    is_shabbat_mevarchim: is_shabbat_mevarchim,
    shabbat_mevarchim: shabbat_mevarchim,
    shabbat_special: params.shabbat_special ?? undefined,// calendar[shabbatDate].special,
    erev_mincha: params.erev_mincha ?? erev_mincha.format('HH:mm'),
    day_shacharit: params.day_shacharit ?? day_shacharit.format('HH:mm'),
    sof_zman_shema: sof_zman_shema.format('HH:mm'),
    day_womens_shiur: params.day_womens_shiur ?? day_womens_shiur.format('HH:mm'),
    day_mincha_1: params.day_mincha_1 ?? day_mincha_1.format('HH:mm'),
    day_mincha_1_shiur: params.day_mincha_1_shiur ?? day_mincha_1_shiur.format('HH:mm'),
    day_mincha_2: params.day_mincha_2 ?? day_mincha_2.format('HH:mm'),
    motzash_arvit: motzash_arvit.format('HH:mm'),
    week_shacharit_1: params.week_shacharit_1 ?? defaultShacharit1,
    week_shacharit_2: params.week_shacharit_2 ?? defaultShacharit2,
    week_shacharit_3: params.week_shacharit_3 ?? defaultShacharit3,
    week_shacharit_rh: params.week_shacharit_rh ?? "06:05",
    has_rosh_chodesh: has_rosh_chodesh,
    rosh_chodesh_days: rosh_chodesh_days,
    rosh_chodesh_days_str: rosh_chodesh_days_str,
    has_chol_hamoed: has_chol_hamoed,
    chol_hamoed_days: chol_hamoed_days,
    chol_hamoed_days_str: chol_hamoed_days_str,
    week_selichot: week_selichot,
    has_selichot: has_selichot,
    selichot_days: selichot_days,
    selichot_days_str: selichot_days_str,
    has_tzom_gedaliah: has_tzom_gedaliah,
    tzom_gedaliah_day_str: tzom_gedaliah_day_str,
    tzom_gedaliah_selichot: tzom_gedaliah_selichot,
    has_other_selichot: has_other_selichot,
    other_selichot_days_str: other_selichot_days_str,
    has_fast: has_fast,
    fast_name: fast_name,
    is_tisha_bav: is_tisha_bav,
    fast_days: fast_days,
    fast_days_str: fast_days_str,
    fast_mincha: fast_mincha,
    fast_arvit: fast_arvit,
    week_shacharit_fast: week_shacharit_fast,
    week_mincha: week_mincha.format('HH:mm'),
    week_arvit_1: week_arvit_1.format('HH:mm')
  }

  return calculatedParams;
}
