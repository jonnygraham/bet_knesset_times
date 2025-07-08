// Modified Lambda function using Puppeteer for file upload

import { js2xml } from 'xml-js';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { calculateTimes } from './lookupTimes.js';
import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

const param_creds = 'mygabay_creds';

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
    redirectUrl = 'https://mygabay.com/TfilaTimes/ShabatTimes.aspx';
  } else {
    console.log('Posting Shabbat times');
    xml = prepareShabbatTimes(timesData);
    filename = 'tfilotSH.xml';
    redirectUrl = 'https://mygabay.com/TfilaTimes/HolTimes.aspx';
  }

  await uploadViaPuppeteer(xml, filename, creds);

  return {
    statusCode: 302,
    headers: { Location: redirectUrl },
    body: null,
  };
};

async function uploadViaPuppeteer(xmlString, filename, creds) {
  const filePath = `/tmp/${filename}`;
  await fs.writeFile(filePath, xmlString);

  const executablePath = await chromium.executablePath;
  console.log("Using Chromium executable at:", executablePath);

const executablePath = await chromium.executablePath || '/usr/bin/chromium-browser'; // fallback

  console.log("Using Chromium executable at:", executablePath);
const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath,
  headless: chromium.headless,
});

  const page = await browser.newPage();
  await page.goto('https://mygabay.com/Login.aspx', { waitUntil: 'domcontentloaded' });
  await page.type('#userName', creds.userName);
  await page.type('#password', creds.password);

  await page.evaluate(() => {
    // @ts-ignore
    (window as any).login();
  });

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await page.goto('https://mygabay.com/ImportTimes.aspx', { waitUntil: 'networkidle2' });

  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) throw new Error('File input not found');
  await fileInput.uploadFile(filePath);

  await Promise.all([
    page.click('input[name="ctl00$ContentPlaceHolder1$sendButton"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);

  console.log('✅ Upload complete via Puppeteer');
  await browser.close();
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
  const data = [
    { text: 'סליחות', time: '05:55', active: false },
    { text: 'שחרית', time: '06:15', active: true },
    { text: 'שחרית ר"ח', time: '06:05', active: false },
    { text: 'שחרית', time: '07:10', active: true },
    { text: 'שחרית יום ו', time: '08:30', active: true },
    ...range(0, 3).map(() => EMPTY_TIME_ROW),
    { text: 'מנחה', time: times.week_mincha, active: true },
    ...range(0, 4).map(() => EMPTY_TIME_ROW),
    { text: 'ערבית', time: times.week_arvit_1, active: true },
    { text: 'ערבית', time: times.week_arvit_2, active: false },
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

