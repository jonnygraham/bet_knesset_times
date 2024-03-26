const Moment = require('moment');
import { calculateTimes } from "./lookupTimes"

export const handler = async (event) => {
    var times : any[] = [];
    const { from, to , ...params } = event.queryStringParameters;
    if (from > to) throw new Error(`from [${from}] must be before to [${to}]!`);
    params.shabbat = from;
    while (params.shabbat <= to) {
        const timesData = await calculateTimes(params);
        times.push(timesData);
        console.log(timesData);
        const shabbatTs = Moment(params.shabbat,"YYYY-MM-DD");
        shabbatTs.add(7, 'day');
        params.shabbat = shabbatTs.format('YYYY-MM-DD')
    }

    var csv = '';
    const headRow = 'תאריך,פרשה,מנחה ערב שבת,שחרית,מנחה גדולה,מנחה קטנה,ערבית מוצ״ש,מנחה חול,ערבית חול,ערבית חול 2\n';

    csv = headRow;
    for(const timesData of times) {
        const row = `${timesData.shabbat},${timesData.parsha},${timesData.erev_mincha},${timesData.day_shacharit},${timesData.day_mincha_1},${timesData.day_mincha_2},${timesData.motzash_arvit},${timesData.week_mincha},${timesData.week_arvit_1},${timesData.week_arvit_2}\n`
        csv += row;
    }

    console.log(csv);

    const base64CSV = Buffer.from(csv).toString('base64');
    var response = {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': "*",
            'Access-Control-Allow-Methods': 'GET, POST',
            'Content-type' : 'text/csv',
            'Content-Disposition': 'attachment; filename="shabbat_times.csv'
        },
        isBase64Encoded: true,
        body: base64CSV,
    };
    return response;
}