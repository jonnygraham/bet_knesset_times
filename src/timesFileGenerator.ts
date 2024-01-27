
import { js2xml } from 'xml-js';
import axios from 'axios';
import FormData from 'form-data';
import {
  SSMClient,
  GetParameterCommand,
} from "@aws-sdk/client-ssm";
import { calculateTimes } from "./lookupTimes"
import { TcpRetryEvent } from 'aws-cdk-lib/aws-appmesh';

const param_creds = "mygabay_creds";
const param_eventValidation = "mygabay_eventValidation";
const param_viewstate_part1 = "mygabay_viewstate_part1";
const param_viewstate_part2 = "mygabay_viewstate_part2";

export const handler = async (event) => {
  const ssmClient = new SSMClient({
    region: "us-east-1",
  });
  
  const [creds, viewState1, viewState2, eventValidationValue] = await Promise.all([
      getParamValue(ssmClient, param_creds, true).then(value => JSON.parse(value)),
      getParamValue(ssmClient, param_viewstate_part1, false),
      getParamValue(ssmClient, param_viewstate_part2, false),
      getParamValue(ssmClient, param_eventValidation, false)]);
  const viewStateValue = viewState1+viewState2; // Too large for a single parameter

  const { upload, ...params } = event.queryStringParameters ?? {};
  const cookies = await loginAndGetCookies(creds);

  const timesData = await calculateTimes(params);
  console.log(timesData);
  if (upload == "weekday") {
    console.log("Posting weekday times")
    const weekdayXml = prepareWeekdayTimes(timesData)
    console.log(weekdayXml)
    await postXMLFile(cookies, weekdayXml, params.filename ?? 'tfilot.xml', viewStateValue, eventValidationValue);
  } else {
    console.log("Posting Shabbat times")
    const shabbatXml = prepareShabbatTimes(timesData)
    console.log(shabbatXml);
    await postXMLFile(cookies, shabbatXml, params.filename ?? 'tfilotSH.xml', viewStateValue, eventValidationValue);
  }
  console.log("Posted times successfully")

  const redirectURL = 'https://mygabay.com/TfilaTimes/ShabatTimes.aspx';

  return {
    statusCode: 302,
    headers: {
      'Location': redirectURL
    },
    body: null
  };
}

function convertToXML(data: TimeRow[]) {
  const processedData = data.map(item => ({
    IsChecked: item.active,
    Text: item.text || '',
    TimeStart: item.time ? parseInt(item.time.split(':')[0], 10) : 'ללא',
    TimeOffsetHH: 0, // Assuming you always have zero hours offset
    TimeOffsetmm: item.time ? parseInt(item.time.split(':')[1], 10) : 0,
    PM: true,
    timer: 0,
    choice: 0
  }));

  const jsonData = {
    ArrayOfTfila: {
      Tfila: processedData
    }
  };
  return js2xml(jsonData, { compact: true, ignoreComment: true, spaces: 0 });
}


const range = (start, end, length = end - start + 1) =>
  Array.from({ length }, (_, i) => start + i)

interface TimeRow {
  text: string;
  time: string;
  active: boolean;
}
const EMPTY_TIME_ROW: TimeRow = { text: '', time: '00:00', active: false }

function prepareWeekdayTimes(times: any) {
  const data: TimeRow[] = []
  data.push({
    text: 'סליחות',
    time: "05:55",
    active: false
  })
  data.push({
    text: 'שחרית',
    time: "06:15",
    active: true
  })
  data.push({
    text: 'שחרית ר"ח',
    time: "06:05",
    active: false
  })
  data.push({
    text: 'שחרית',
    time: "07:10",
    active: true
  })
  data.push({
    text: 'שחרית יום ו',
    time: "08:30",
    active: true
  })
  for (i in range(5, 9)) {
    data.push(EMPTY_TIME_ROW)
  }
  data.push({
    text: 'מנחה',
    time: times.week_mincha,
    active: true
  })
  for (i in range(1, 6)) {
    data.push(EMPTY_TIME_ROW)
  }
  data.push({
    text: 'ערבית',
    time: times.week_arvit_1,
    active: true
  })
  data.push({
    text: 'ערבית',
    time: times.week_arvit_2,
    active: true
  })
  data.push({
    text: 'שיעור דף יומי הרב ברוכים',
    time: "22:00",
    active: true
  })
  for (var i in range(3, 6)) {
    data.push(EMPTY_TIME_ROW)
  }
  return convertToXML(data);
}

function prepareShabbatTimes(times: any) {
  const data: TimeRow[] = []
  data.push({
    text: 'מנחה גדולה ערב שבת (' + times.parsha + ')',
    time: "14:30",
    active: true
  })
  data.push({
    text: 'מנחה וערבית ערב שבת',
    time: times.erev_mincha,
    active: true
  })
  for (i in range(2, 3)) {
    data.push(EMPTY_TIME_ROW)
  }
  data.push({
    text: 'שחרית',
    time: times.day_shacharit,
    active: true
  })
  data.push({
    text: 'קידוש',
    time: "",
    active: false
  })
  data.push({
    text: 'שיעור נשים',
    time: times.day_womens_shiur,
    active: true
  })
  for (i in range(3, 7)) {
    data.push(EMPTY_TIME_ROW)
  }
  data.push({
    text: 'מנחה גדולה',
    time: times.day_mincha_1,
    active: true
  })
  data.push({
    text: 'שיעור הרב פרל',
    time: times.day_mincha_1_shiur,
    active: true
  })
  data.push({
    text: 'מנחה קטנה',
    time: times.day_mincha_2,
    active: true
  })
  for (i in range(3, 7)) {
    data.push(EMPTY_TIME_ROW)
  }
  data.push({
    text: 'ערבית מוצ"ש',
    time: times.motzash_arvit,
    active: true
  })
  for (var i in range(1, 7)) {
    data.push(EMPTY_TIME_ROW)
  }
  return convertToXML(data);
}

async function getParamValue(client : SSMClient, name : string, encrypted : boolean) : Promise<string> {
  return client.send(
      new GetParameterCommand({
        Name: param_creds,
        WithDecryption: encrypted
      })
    ).then(response => response.Parameter.Value);
}

async function loginAndGetCookies(creds : { userName: string, password : string }): Promise<string[]> {
  const loginUrl = 'https://mygabay.com/Login.aspx/LoginWithLicence';
  const payload = {
    ...creds,
    rememberMe: {
      "0": {},
      "length": 1
    },
    questionId: "",
    answer: ""
  };

  const response = await axios.post(loginUrl, payload, {
    withCredentials: true
  });

  const cookies = response.headers['set-cookie'];
  const requiredCookies = cookies!.map((cookie: string) => cookie.split(';')[0])
    .filter((cookie: string) => ['ASP.NET_SessionId', '.ASPXAUTH', 'password', 'username'].some((name) => cookie.includes(name)));

  return requiredCookies;
}

async function postXMLFile(cookies: string[], xmlString: string, filename: string, viewStateValue : string, eventValidationValue : string) {
  // const postUrl = 'https://mygabay.com/ImportTimes.aspx?type=tfilothol';
  const postUrl = 'https://mygabay.com/ImportTimes.aspx';
  const form = new FormData();
  form.append('__EVENTTARGET', '');
  form.append('__EVENTARGUMENT', '');
  form.append('__LASTFOCUS', '');
  form.append('__VIEWSTATE', viewStateValue);
  form.append('__VIEWSTATEGENERATOR', 'FE2D4F58');
  form.append('__SCROLLPOSITIONX', '0');
  form.append('__SCROLLPOSITIONY', '0');
  form.append('__EVENTVALIDATION', eventValidationValue);
  form.append('ctl00$language', 'he');
  form.append('ctl00$ContentPlaceHolder1$HiddenField2', '');
  form.append('ctl00$ContentPlaceHolder1$sendButton', 'שלח');
  form.append('ctl00$ContentPlaceHolder1$myFile', Buffer.from(xmlString), {
    filename: filename,
    contentType: 'text/xml'
  });

  await axios.post(postUrl, form, {
    headers: {
      ...form.getHeaders(),
      Cookie: cookies.join('; ')
    },
    withCredentials: false
  });
}

if (require.main === module) {
  console.log("Running locally");
  (async () => {
    const timesData = {
      parsha: "כי תצא",
      erev_mincha: "18:55",
      day_shacharit: "08:30",
      day_womens_shiur: "10:30",
      day_mincha_1: "13:15",
      day_mincha_1_shiur: "13:35",
      day_mincha_2: "18:30",
      motzash_arvit: "19:51",
      week_shacharit_1: "06:15",
      week_shacharit_2: "07:10",
      week_shacharit_3: "יום ו 08:30",
      week_mincha: "18:50",
      week_arvit_1: "19:35",
      week_arvit_2: "21:15"
    }

    console.log("Posting Shabbat times")
    await handler({ queryStringParameters: { ...timesData, upload: "shabbat" } });
    console.log("Posting weekday times")
    await handler({ queryStringParameters: { ...timesData, upload: "weekday" } });
  })();
}
