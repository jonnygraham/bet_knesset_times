const Moment = require('moment');
const axios = require('axios');

const timesCache = {}
export async function fetchTime(date: typeof Moment, timeName: string): Promise<typeof Moment> {
  const dateString = date.format('YYYYMMDD');
  console.log("Fetching times page for "+dateString);
  var pageString : string;
  if (timesCache[dateString]) {
    pageString = timesCache[dateString];
    console.log("Found times page in cache");
  } else {
    let url = `https://calendar.2net.co.il/todaytimes.aspx?city=%D7%9E%D7%91%D7%95%D7%90%20%D7%97%D7%95%D7%A8%D7%95%D7%9F&today=${dateString}`;
    console.log("Fetching URL: "+url);
    let result = await axios.get(url);
    pageString = result.data;
    timesCache[dateString] = pageString;
  }
    let page = pageString.split("\n");
    let r = new RegExp(`${timeName}[^\\d]*(\\d\\d:\\d\\d)`);
    console.log("Using regex "+r);
    return page.map((l: string) => l.match(r)).filter((l: RegExpMatchArray | null) => l)
    .map((m: RegExpMatchArray | null) => Moment(m?m[1]:null,"HH:mm"))[0];
  }
