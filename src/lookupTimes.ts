const Moment = require('moment');
const axios = require('axios');

const timesCache = {};

async function fetchPage(date: typeof Moment): Promise<string> {
  const dateString = date.format('YYYYMMDD');
  if (timesCache[dateString]) {
    return timesCache[dateString];
  } else {
    let url = `https://calendar.2net.co.il/todaytimes.aspx?city=%D7%9E%D7%91%D7%95%D7%90%20%D7%97%D7%95%D7%A8%D7%9F&today=${dateString}`;
    let result = await axios.get(url);
    timesCache[dateString] = result.data;
    return result.data;
  }
}

// Fetch a specific time from the page
export async function fetchTime(date: typeof Moment, timeName: string): Promise<typeof Moment> {
  let page = (await fetchPage(date)).split("\n");
  let r = new RegExp(`${timeName}[^\d]*(\d\d:\d\d)`);
  return page.map((l: string) => l.match(r)).filter((l: RegExpMatchArray | null) => l)
    .map((m: RegExpMatchArray | null) => Moment(m ? m[1] : null, "HH:mm"))[0];
}

// Fetch the parsha from the page
export async function fetchParsha(date: typeof Moment): Promise<string> {
  let pageString = await fetchPage(date);
  const r = /פרשת השבוע:\s*([\\s\\S]*?)\s*<\/div>/;
  return pageString.match(r)![1];
}

// Fetch the Hebrew date from the page using the <span> with id="navigationPanelContent_todaySmall"
export async function fetchDate(date: typeof Moment): Promise<string> {
  const pageString = await fetchPage(date);
  const match = pageString.match(/<span[^>]*id="navigationPanelContent_todaySmall"[^>]*>([^<]+)<\/span>/);
  return match ? match[1].trim() : "";
}

// Extract the day part from a Hebrew date string (e.g., "י' אב ה'תשפ\"ה" => "י")
function getHebrewDay(hebrewDate: string): string {
  return hebrewDate.split(" ")[0].replace(/[\'\\"״]/g, "");
}

// Check if the Hebrew day is Rosh Chodesh (א or ל)
function isRoshChodesh(hebrewDay: string): boolean {
  return hebrewDay === "א" || hebrewDay === "ל";
}

export async function calculateTimes(params: any): Promise<any> {
  // ... (other calculation logic as before)

  // Days: Sunday (0) through Friday (5)
  const weekdays = [0, 1, 2, 3, 4, 5];
  const moment = require('moment');
  let roshChodeshDays: string[] = [];

  // Use the current week (starting from Sunday of "this week")
  const today = moment();
  const sunday = today.clone().startOf('week');

  for (let i = 0; i < weekdays.length; i++) {
    const curDate = sunday.clone().add(i, 'days');
    const hebrewDate = await fetchDate(curDate);
    const hebrewDay = getHebrewDay(hebrewDate);
    if (isRoshChodesh(hebrewDay)) {
      // Add English weekday name
      roshChodeshDays.push(curDate.format('dddd'));
    }
  }

  const result: any = {}; // your existing return object
  result.weekday_shacharit_early = "06:05";
  result.weekday_shacharit_early_days = roshChodeshDays.join(",");

  // ... (rest of your calculation logic and return)
  return result;
}