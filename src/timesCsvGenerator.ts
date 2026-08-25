import moment from 'moment';
import { calculateTimes } from "./lookupTimes"

export const handler = async (event) => {
    var times : any[] = [];
    const { from, to , ...params } = event.queryStringParameters;
    if (from > to) throw new Error(`from [${from}] must be before to [${to}]!`);
    const nearestShabbat = moment(from, "YYYY-MM-DD").day(6);  
    params.shabbat = nearestShabbat.format('YYYY-MM-DD');
    console.log("Starting from Shabbat "+params.shabbat);
    while (params.shabbat <= to) {
        const timesData = await calculateTimes(params);
        times.push(timesData);
        console.log(timesData);
        const shabbatTs = moment(params.shabbat,"YYYY-MM-DD");
        shabbatTs.add(7, 'day');
        params.shabbat = shabbatTs.format('YYYY-MM-DD')
    }

    var csv = '';
    const headRow = 'תאריך,פרשה,מנחה ערב שבת,שחרית,סוף זמן שמע,מנחה גדולה,מנחה קטנה,ערבית מוצ״ש,מנחה חול,ערבית חול,שחרית ר״ח,סליחות,צום,מנחה צום,ערבית צאת הצום\n';

    csv = headRow;
    for(const timesData of times) {
        const rhCol = timesData.has_rosh_chodesh ? `${timesData.rosh_chodesh_days_str} ${timesData.week_shacharit_rh}` : '';
        const selichotCol = timesData.has_selichot ? `${timesData.selichot_days_str} ${timesData.week_selichot}` : '';
        const fastCol = timesData.has_fast ? (timesData.is_tisha_bav ? 'תשעה באב (07:00, 08:30)' : `${timesData.fast_name} (${timesData.fast_days_str}) 06:05`) : '';
        const fastMinchaCol = timesData.has_fast ? (timesData.fast_mincha || '') : '';
        const fastArvitCol = timesData.has_fast ? (timesData.fast_arvit || '') : '';
        const row = `${timesData.shabbat},${timesData.parsha},${timesData.erev_mincha},${timesData.day_shacharit},${timesData.sof_zman_shema},${timesData.day_mincha_1},${timesData.day_mincha_2},${timesData.motzash_arvit},${timesData.week_mincha},${timesData.week_arvit_1},${rhCol},${selichotCol},${fastCol},${fastMinchaCol},${fastArvitCol}\n`;
        csv += row;
    }

    console.log(csv);

    const csvWithBOM = `\ufeff${csv}`;
    const base64CSV = Buffer.from(csvWithBOM).toString('base64');
    var response = {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': "*",
            'Access-Control-Allow-Methods': 'GET, POST',
            'Content-type' : 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="shabbat_times.csv'
        },
        isBase64Encoded: true,
        body: base64CSV,
    };
    return response;
}
