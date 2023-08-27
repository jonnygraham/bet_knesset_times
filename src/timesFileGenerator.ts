
import { js2xml } from 'xml-js';
import axios from 'axios';
import * as FormData from 'form-data';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { calculateTimes } from "./timesHandler"

const secret_name = "mygabay_creds";

export const handler = async (event) => {

  const client = new SecretsManagerClient({
    region: "us-east-1",
  });
  
  let response;
  
  try {
    response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );
  } catch (error) {
    // For a list of exceptions thrown, see
    // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
    throw error;
  }
  
  const creds = response.SecretString;

  const { upload, ...params } = event.queryStringParameters ?? {};
  const cookies = await loginAndGetCookies(creds);

  const timesData = calculateTimes(params);
  if (upload == "weekday") {
    console.log("Posting weekday times")
    const weekdayXml = prepareWeekdayTimes(timesData)
    console.log(weekdayXml)
    await postXMLFile(cookies, weekdayXml, 'tfilot.xml');
  } else {
    console.log("Posting Shabbat times")
    const shabbatXml = prepareShabbatTimes(timesData)
    console.log(shabbatXml);
    await postXMLFile(cookies, shabbatXml, 'tfilotSH.xml');
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
    active: false
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
    text: 'שיעור הרב קטן',
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


const YOUR_VIEWSTATE_VALUE = '/wEPDwULLTEyNTAzMjg2MzAPZBYCZg8PZBYCHgl0cmFuc2xhdGUFAm5vFgICAQ8WBB4FY2xhc3MFAmhlHwAFAm5vFgQCAQ8WAh8ABQJubxYIZg8WAh8ABQJub2QCAQ8WAh8ABQJub2QCAg8WBB4EaHJlZgUQL1N0eWxlL3J0bC5jc3M/Mx8ABQJub2QCAw8WAh8ABQJub2QCAw8WBB8ABQJubx4HZW5jdHlwZQUTbXVsdGlwYXJ0L2Zvcm0tZGF0YRYyAgEPDxYGHghJbWFnZVVybGUeDUFsdGVybmF0ZVRleHRlHgdUb29sVGlwZRYCHwAFAm5vZAIDDxYCHgRUZXh0BSHXkdeZ16og15TXm9eg16HXqiDXntep15vXnyDXnNeV15lkAgUPFgIfB2VkAgcPDxYCHgdWaXNpYmxlaBYCHwAFAm5vZAIJDw8WBB8GBS3Xmdeq16jXqiDXlNeV15PXoteV16og15XXldem15DXpCDXnNep15zXmdeX15QfBwUBMBYCHwAFAm5vZAILDw8WBB8FZR8GZRYCHwAFAm5vZAINDw8WBB8GBSTXmdeq16jXqiDXnteh16jXldeg15nXnSDXnNep15zXmdeX15QfBwUBMBYCHwAFAm5vZAIPDw8WBB8FZR8GZRYCHwAFAm5vZAIRDw8WBB8GBS/Xmdeq16jXqiDXlNeV15PXoteV16og16fXldec15nXldeqINec16nXnNeZ15fXlB8HBQEwFgIfAAUCbm9kAhMPDxYEHwVlHwZlFgIfAAUCbm9kAhUPDxYEHwYFIten15HXnNeV16og16nXlNeV16DXpNen15Ug15TXqdeg15QfBwUBMBYCHwAFAm5vZAIXDw8WBB8FZR8GZRYCHwAFAm5vZAIZDw8WBB8GBRfXqNeb15nXqdeqINeU15XXk9ei15XXqh8HZRYCHwAFAm5vZAIbDxYEHwAFAm5vHwhoZAIdDw9kFgIfAAUCbm9kAh8PFgIfBwUMINeb15kg16rXpteQZAIhDw9kFgIfAAUCbm9kAiMPFgIfBwUFMTg6NTNkAiUPD2QWAh8ABQJub2QCJw8WAh8HBQUxOTo1MWQCKQ8PZBYCHwAFAm5vZAIqDw8WBB8HBQEhHwYFFden16jXmdeQ16og16nXmdeo15XXqhYCHwAFAm5vZAIsDw9kFgIfAAUCbm8WJAIBDxYEHwAFAm5vHgV0aXRsZWQWAmYPD2QWAh8ABQJub2QCAw8WAh8ABQJubxYGZg8PZBYCHwAFAm5vZAICDxYCHwAFAm5vFhJmDw9kFgIfAAUCbm9kAgIPFgYfAAUCbm8fCWQfCGgWAmYPD2QWAh8ABQJub2QCBA8WBh8ABQJubx8JZB8IaBYCZg8PZBYCHwAFAm5vZAIGDxYGHwAFAm5vHwlkHwhoFgJmDw9kFgIfAAUCbm9kAggPFgYfAAUCbm8fCWQfCGgWAmYPD2QWAh8ABQJub2QCCg8WBh8ABQJubx8JZB8IaBYCZg8PZBYCHwAFAm5vZAIMDxYGHwAFAm5vHwlkHwhoFgJmDw9kFgIfAAUCbm9kAg4PFgYfAAUCbm8fCWQfCGgWAmYPD2QWAh8ABQJub2QCEA8WBh8ABQJubx8JZB8IaBYCZg8PZBYCHwAFAm5vZAIEDxYCHwAFAm5vFh5mDw9kFgIfAAUCbm9kAgIPFgYfAAUCbm8fCWQfCGgWAmYPD2QWAh8ABQJub2QCBA8WBh8ABQJubx8JZB8IaBYCZg8PZBYCHwAFAm5vZAIGDxYGHwAFAm5vHwlkHwhoFgJmDw9kFgIfAAUCbm9kAggPFgYfAAUCbm8fCWQfCGgWAmYPD2QWAh8ABQJub2QCCg8WBh8ABQJubx8JZB8IaBYCZg8PZBYCHwAFAm5vZAIMDxYEHwAFAm5vHwlkFgJmDw9kFgIfAAUCbm9kAg4PFgQfAAUCbm8fCWQWAmYPD2QWAh8ABQJub2QCEA8WBB8ABQJubx8JZBYCZg8PZBYCHwAFAm5vZAISDxYEHwAFAm5vHwlkFgJmDw9kFgIfAAUCbm9kAhQPFgYfAAUCbm8fCWQfCGgWAmYPD2QWAh8ABQJub2QCFg8WBh8ABQJubx8JZB8IaBYCZg8PZBYCHwAFAm5vZAIYDxYGHwAFAm5vHwlkHwhoFgJmDw9kFgIfAAUCbm9kAhoPFgYfAAUCbm8fCWQfCGgWAmYPD2QWAh8ABQJub2QCHA8WBh8ABQJubx8JZB8IaBYCZg8PZBYCHwAFAm5vZAIFDxYEHwAFAm5vHwlkFgJmDw9kFgIfAAUCbm9kAgcPFgIfAAUCbm8WDGYPD2QWAh8ABQJub2QCAg8WBh8ABQJubx8JZB8IaBYCZg8PZBYCHwAFAm5vZAIEDxYEHwAFAm5v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';
const YOUR_EVENTVALIDATION_VALUE = '/wEdAAx0GIg7r22Ct6Fmk/jVUxp9rUOKlhQRrZFLGCp1Xtoyr1YkZeYLD3HJRseNww6ZpSNxlGDu0g7mJF3T7XR7E/1/Ep5dN7Y1biponI12B7ZQnEr9UPCbY771rfPL+EBbcA+a6J8hr6/9FnGWzZ8P0XdIdOII/khqNjlP54CGNRMuquZgXYnl5NtKdi8u9Ihmm7jtxdiwPCuMOWUEW5gfiuccjtEePLKzG20Q6NPB/Wn3YRSUQ+SBa95NJENDZsYSHk4XwzJ0cuOuS5MSCFPe74Iz2v4PfwAbz69ijF18u8Ey9Q==';


async function loginAndGetCookies(creds : { user: string, password : string }): Promise<string[]> {
  const loginUrl = 'https://mygabay.com/Login.aspx/LoginWithLicence';
  const payload = {
    userName: creds.user,
    password: creds.password,
    rememberMe: {
      "0": {},
      "length": 1
    }
  };

  const response = await axios.post(loginUrl, payload, {
    withCredentials: true
  });

  const cookies = response.headers['set-cookie'];
  const requiredCookies = cookies!.map((cookie: string) => cookie.split(';')[0])
    .filter((cookie: string) => ['ASP.NET_SessionId', '.ASPXAUTH', 'password', 'username'].some((name) => cookie.includes(name)));

  return requiredCookies;
}

async function postXMLFile(cookies: string[], xmlString: string, filename: string) {
  // const postUrl = 'https://mygabay.com/ImportTimes.aspx?type=tfilothol';
  const postUrl = 'https://mygabay.com/ImportTimes.aspx';
  const form = new FormData();
  form.append('__EVENTTARGET', '');
  form.append('__EVENTARGUMENT', '');
  form.append('__LASTFOCUS', '');
  form.append('__VIEWSTATE', YOUR_VIEWSTATE_VALUE);
  form.append('__VIEWSTATEGENERATOR', 'FE2D4F58');
  form.append('__SCROLLPOSITIONX', '0');
  form.append('__SCROLLPOSITIONY', '0');
  form.append('__EVENTVALIDATION', YOUR_EVENTVALIDATION_VALUE);
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
