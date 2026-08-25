// Lambda function uploading times via the SPA ButtonClicked REST API

import { js2xml } from 'xml-js';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { calculateTimes } from './lookupTimes.js';

const param_creds = 'mygabay_creds';
const BASE_URL = 'https://mygabay.com/api/app/ButtonClicked';

export const handler = async (event) => {
  const ssmClient = new SSMClient({ region: 'us-east-1' });

  const creds = await getParamValue(ssmClient, param_creds, true).then((value) => JSON.parse(value));
  const { upload, ...params } = event.queryStringParameters ?? {};
  const timesData = await calculateTimes(params);
  console.log(timesData);

  let xml, filename, redirectUrl;

  if (upload === 'weekday') {
    console.log('Posting weekday times');
    xml = prepareWeekdayTimes(timesData);
    filename = 'tfilot.xml';
    redirectUrl = 'https://mygabay.com/DigitalBoardWeekdayPrayers';
  } else {
    console.log('Posting Shabbat times');
    xml = prepareShabbatTimes(timesData);
    filename = 'tfilotSH.xml';
    redirectUrl = 'https://mygabay.com/DigitalBoardShabbatPrayers';
  }

  await uploadViaApi(xml, filename, creds);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, filename, redirectUrl }),
  };
};

async function uploadViaApi(xmlString, filename, creds) {
  async function postBtn(button, data, appToken) {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-App-State': appToken || '',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({ button, data, app: appToken || '' })
    });
    if (!res.ok) {
      throw new Error(`mygabay API error ${res.status}: ${await res.text()}`);
    }
    return await res.json();
  }

  // 1. Hello handshake -> obtain anonymous app state token
  const helloRes = await postBtn('Hello', null, '');
  const initialApp = helloRes.app || '';

  // 2. Login
  const loginData = {
    username: creds.userName || creds.username,
    password: creds.password,
    returnMethod: 'Hello',
    returnData: '{}'
  };
  const loginRes = await postBtn('Login', loginData, initialApp);
  const loggedInApp = loginRes.app || initialApp;

  // 3. ShohamImport XML upload (base64 data URI)
  const b64 = Buffer.from(xmlString, 'utf-8').toString('base64');
  const files = JSON.stringify([{ name: filename, data: `data:text/xml;base64,${b64}` }]);
  const uploadRes = await postBtn('ShohamImportSave', { files }, loggedInApp);

  console.log(`✅ Upload complete for ${filename}:`, uploadRes.script || uploadRes.popUp || 'Success');
}

function convertToXML(data) {
  const processedData = data.map((item) => ({
    IsChecked: item.active,
    Text: item.text || '',
    TimeStart: item.time ? parseInt(item.time.split(':')[0], 10) : 'ללא',
    TimeOffsetHH: 0,
    TimeOffsetmm: item.time ? parseInt(item.time.split(':')[1], 10) : 0,
    PM: true,
    timer: 0,
    choice: 0,
  }));

  return js2xml({ ArrayOfTfila: { Tfila: processedData } }, { compact: true, ignoreComment: true, spaces: 0 });
}

function range(start, end, length = end - start + 1) {
  return Array.from({ length }, (_, i) => start + i);
}

const EMPTY_TIME_ROW = { text: '', time: '00:00', active: false };

function prepareWeekdayTimes(times) {
  const selichotText = times.has_selichot && times.selichot_days_str && times.selichot_days_str !== "א'-ו'"
    ? `סליחות (${times.selichot_days_str})`
    : 'סליחות';
  const rhText = times.has_rosh_chodesh && times.rosh_chodesh_days_str
    ? `שחרית ר"ח (${times.rosh_chodesh_days_str})`
    : 'שחרית ר"ח';

  let shacharit1Text = 'שחרית';
  let shacharit1Time = times.week_shacharit_1 || '06:15';
  let shacharit1Active = true;

  let shacharit2Text = 'שחרית';
  let shacharit2Time = times.week_shacharit_2 || '07:10';
  let shacharit2Active = true;

  let shacharit3Text = 'שחרית יום ו';
  let shacharit3Time = times.week_shacharit_3 ? (times.week_shacharit_3.replace(/^יום ו\s*/, '')) : '08:30';
  let shacharit3Active = true;

  const isTishaBAv = Boolean(times.is_tisha_bav);
  const hasRegularFast = Boolean(times.has_fast && !isTishaBAv);

  let fastShacharitText = times.fast_name ? `שחרית (${times.fast_name})` : 'שחרית צום';
  let fastShacharitTime = times.week_shacharit_fast || '06:05';

  if (isTishaBAv) {
    shacharit1Text = 'שחרית (תשעה באב)';
    shacharit1Time = '07:00';
    shacharit2Text = 'שחרית (תשעה באב)';
    shacharit2Time = '08:30';
    shacharit3Active = false;
  }

  const fastArvitText = times.fast_name ? `ערבית מוצאי ${times.fast_name}` : 'ערבית צאת הצום';

  const data = [
    { text: selichotText, time: times.week_selichot || '05:55', active: Boolean(times.has_selichot) },
    { text: fastShacharitText, time: fastShacharitTime, active: hasRegularFast },
    { text: rhText, time: times.week_shacharit_rh || '06:05', active: Boolean(times.has_rosh_chodesh) },
    { text: shacharit1Text, time: shacharit1Time, active: shacharit1Active },
    { text: shacharit2Text, time: shacharit2Time, active: shacharit2Active },
    { text: shacharit3Text, time: shacharit3Time, active: shacharit3Active },
    ...range(0, 2).map(() => EMPTY_TIME_ROW),
    { text: 'מנחה', time: times.week_mincha, active: true },
    ...range(0, 4).map(() => EMPTY_TIME_ROW),
    { text: fastArvitText, time: times.fast_arvit || '00:00', active: Boolean(times.has_fast) },
    { text: 'ערבית', time: times.week_arvit_1, active: true },
    { text: 'שיעור דף יומי הרב ברוכים', time: '22:00', active: true },
    ...range(0, 2).map(() => EMPTY_TIME_ROW),
  ];
  return convertToXML(data);
}

function prepareShabbatTimes(times) {
  const data = [
    { text: `מנחה גדולה ערב שבת (${times.parsha})`, time: '14:30', active: true },
    { text: 'מנחה וערבית ערב שבת', time: times.erev_mincha, active: true },
    ...range(0, 0).map(() => EMPTY_TIME_ROW),
    { text: 'שחרית', time: times.day_shacharit, active: true },
    { text: 'קידוש', time: '', active: false },
    { text: 'שיעור נשים', time: times.day_womens_shiur, active: true },
    ...range(0, 3).map(() => EMPTY_TIME_ROW),
    { text: 'מנחה גדולה', time: times.day_mincha_1, active: true },
    { text: 'שיעור הרב פרל', time: times.day_mincha_1_shiur, active: true },
    { text: 'מנחה קטנה', time: times.day_mincha_2, active: true },
    ...range(0, 3).map(() => EMPTY_TIME_ROW),
    { text: 'ערבית מוצ"ש', time: times.motzash_arvit, active: true },
    ...range(0, 5).map(() => EMPTY_TIME_ROW),
  ];
  return convertToXML(data);
}

async function getParamValue(client, name, encrypted) {
  const response = await client.send(new GetParameterCommand({ Name: name, WithDecryption: encrypted }));
  return response.Parameter.Value;
}

