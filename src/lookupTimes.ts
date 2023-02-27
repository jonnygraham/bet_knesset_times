const Moment = require('moment');
const axios = require('axios');

const timesCache = {}
export 
async function fetchTime(date: typeof Moment, timeName: string): Promise<typeof Moment> {
  const dateString = date.format('YYYYMMDD');
  var pageString : string;
  if (timesCache[dateString]) {
    pageString = timesCache[dateString];
  } else {
    let url = `https://calendar.2net.co.il/todaytimes.aspx?city=%D7%9E%D7%91%D7%95%D7%90%20%D7%97%D7%95%D7%A8%D7%95%D7%9F&today=${dateString}`;
    console.log(url);
    let result = await axios.get(url);
    pageString = result.data;
    timesCache[dateString] = pageString;
  }
    let page = pageString.split("\n");
    let r = new RegExp(`${timeName}[^\\d]*(\\d\\d:\\d\\d)`)
    return page.map((l: string) => l.match(r)).filter((l: RegExpMatchArray | null) => l).map((m: RegExpMatchArray | null) => Moment(m?[1]:null,"HH:mm"))[0];
  }

  (async () => {
  const shabbatDate = Moment("2023-03-04","YYYY-MM-DD");
  const sunday = shabbatDate.clone().add(1,'day');
  const thursday = shabbatDate.clone().add(5,'day');
  
  const shkia1 = await fetchTime(sunday, 'שקיעה מישורית');
  const shkia2 = await fetchTime(thursday, 'שקיעה מישורית');
  console.log(shkia1);
  console.log(shkia2);
  const earliestShikia = shkia1.isBefore(shkia2) ? shkia1 : shkia2;
  console.log(earliestShikia);
  const mincha = earliestShikia.clone().subtract(earliestShikia.get('minute')%5,'minute'); // Round down to 5 minutes

  const tzet1 = await fetchTime(sunday,'צאת הכוכבים');
  const tzet2 = await fetchTime(thursday,'צאת הכוכבים');
  console.log(tzet1);
  console.log(tzet2);
  const latestTzet = tzet1.isAfter(tzet2) ? tzet1 : tzet2;
  latestTzet.subtract(1,'minute');
  const arvit = latestTzet.clone();
  if (arvit.get('minute')%5 > 0) {
     arvit.add(5-latestTzet.get('minute')%5,'minute'); // Round up to 5 minutes
  }
  console.log(latestTzet);
  console.log(arvit);

  const tzetShabbat = await fetchTime(shabbatDate, 'צאת השבת');

  const shkiaShabbat = await fetchTime(shabbatDate, 'שקיעה מישורית');
  console.log("Tzet Shabbat: ",tzetShabbat);
  console.log("Shkia Shabbat: ",shkiaShabbat);
  })();

  console.log()