const Moment = require('moment');
const axios = require('axios');

const timesCache = {}

async function fetchPage(date: typeof Moment): Promise<string> {
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

export async function fetchTime(date: typeof Moment, timeName: string): Promise<typeof Moment> {
  let page = (await fetchPage(date)).split("\n");
  let r = new RegExp(`${timeName}[^\\d]*(\\d\\d:\\d\\d)`);
  console.log("Using regex " + r);
  return page.map((l: string) => l.match(r)).filter((l: RegExpMatchArray | null) => l)
    .map((m: RegExpMatchArray | null) => Moment(m ? m[1] : null, "HH:mm"))[0];
}

export async function fetchParsha(date: typeof Moment): Promise<string> {
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

  const daysUntilSaturday = (6 - (Moment().day() + 1) % 7) % 7 + 1;
//  const shabbat = Moment().add(6 - Moment().day(), 'day');
  var shabbat = Moment().add(daysUntilSaturday, 'day');
  if (params.shabbat) {
     shabbat = Moment(params.shabbat,"YYYY-MM-DD");
  }
  const shabbatDate = shabbat.format("YYYY-MM-DD");
  console.log("Shabbat date is " + shabbatDate);
  console.log("Calendar details for this date: " + calendar[shabbatDate]);

  const parsha = params.parsha ?? await fetchParsha(shabbat);
  console.log(`Parsha ${parsha}`);

  const shkia = params.shkia ?? (await fetchTime(shabbat, 'שקיעה מישורית')); //calendar[shabbatDate].shkia;

  const shkiaMoment = Moment(shkia, "HH:mm");
  const erev_mincha = shkiaMoment.clone().subtract(14, 'minute');
  erev_mincha.subtract(erev_mincha.get('minute') % 5, 'minute'); // Round down to 5 minutes

  const day_mincha_2 = shkiaMoment.clone().subtract(40, 'minute');
  day_mincha_2.subtract(day_mincha_2.get('minute') % 5, 'minute'); // Round down to 5 minutes

  //const dst = shkiaMoment.isDST();

  const day_shacharit = Moment('08:00', 'HH:mm');
  const day_mincha_1 = Moment('12:45', 'HH:mm');
  if (params.dst === "true") {
    day_shacharit.add(30, 'minute');
    day_mincha_1.add(30, 'minute');
  }
  const day_mincha_1_shiur = day_mincha_1.clone().add(20, 'minute');
  const day_womens_shiur = day_shacharit.clone().add(2, 'hour');
  if (params.dst !== "true") {
    day_womens_shiur.add(10, 'minute');
  }

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

  const tzet1 = await fetchTime(sunday, 'צאת הכוכבים');
  const tzet2 = await fetchTime(thursday, 'צאת הכוכבים');
  console.log("Sunday tzet: " + tzet1);
  console.log("Thursday tzet: " + tzet2);
  const latestTzet = tzet1.isAfter(tzet2) ? tzet1 : tzet2;
  console.log("Latest tzet: " + latestTzet);
  const week_arvit_1 = latestTzet.clone();
  if (week_arvit_1.get('minute') % 5 > 0) {
    week_arvit_1.add(5 - week_arvit_1.get('minute') % 5, 'minute'); // Round up to 5 minutes
  }

  console.log("Weekday arvit: " + week_arvit_1);


  const calculatedParams = {
    ...params,
    parsha: parsha,
    shabbat_special: params.shabbat_special ?? undefined,// calendar[shabbatDate].special,
    erev_mincha: params.erev_mincha ?? erev_mincha.format('HH:mm'),
    day_shacharit: params.day_shacharit ?? day_shacharit.format('HH:mm'),
    day_womens_shiur: params.day_womens_shiur ?? day_womens_shiur.format('HH:mm'),
    day_mincha_1: params.day_mincha_1 ?? day_mincha_1.format('HH:mm'),
    day_mincha_1_shiur: params.day_mincha_1_shiur ?? day_mincha_1_shiur.format('HH:mm'),
    day_mincha_2: params.day_mincha_2 ?? day_mincha_2.format('HH:mm'),
    motzash_arvit: motzash_arvit.format('HH:mm'),
    week_shacharit_1: "06:15",
    week_shacharit_2: "07:10",
    week_shacharit_3: "יום ו 08:30",
    week_mincha: week_mincha.format('HH:mm'),
    week_arvit_1: week_arvit_1.format('HH:mm'),
    week_arvit_2: "21:15"
  }

  return calculatedParams;
}
