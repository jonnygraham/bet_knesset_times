const Moment = require('moment');

const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
exports.handler = async (event) => {

  const calendar= {
"2022-11-12":{parsha:"וירא",shkia:"16:42"},
"2022-11-19":{parsha:"חיי שרה",shkia:"16:39"},
"2022-11-26":{parsha:"תולדות",shkia:"16:36"},
"2022-12-03":{parsha:"ויצא",shkia:"16:36"},
"2022-12-10":{parsha:"וישלח",shkia:"16:36"},
"2022-12-17":{parsha:"וישב",shkia:"16:38"},
"2022-12-24":{parsha:"מקץ",shkia:"16:42"},
"2022-12-31":{parsha:"ויגש",shkia:"16:46"},
"2023-01-07":{parsha:"ויחי",shkia:"16:51"},
"2023-01-14":{parsha:"שמות",shkia:"16:57"},
"2023-01-21":{parsha:"וארא",shkia:"17:04"},
"2023-01-28":{parsha:"בא",shkia:"17:10"},
"2023-02-04":{parsha:"בשלח",shkia:"17:16"},
"2023-02-11":{parsha:"יתרו",shkia:"17:23"},
"2023-02-18":{parsha:"משפטים",shkia:"17:29"},
"2023-02-25":{parsha:"תרומה",shkia:"17:34"},
"2023-03-04":{parsha:"תצוה",shkia:"17:40"},
"2023-03-11":{parsha:"כי תשא",shkia:"17:45"},
"2023-03-18":{parsha:"ויקהל פקודי",shkia:"17:50"},
"2023-03-25":{parsha:"ויקרא",shkia:"18:54"},
"2023-04-01":{parsha:"צו",shkia:"18:59"},
"2023-04-08":{parsha:"שבת חול המועד",shkia:"19:04"},
"2023-04-15":{parsha:"שמיני",shkia:"19:09"},
"2023-04-22":{parsha:"תזריע מצורע",shkia:"19:13"},
"2023-04-29":{parsha:"אחרי מות קדושים",shkia:"19:18"},
"2023-05-06":{parsha:"אמור",shkia:"19:23"},
"2023-05-13":{parsha:"בהר בחוקותי",shkia:"19:28"},
"2023-05-20":{parsha:"במדבר",shkia:"19:33"},
"2023-05-27":{parsha:"נשא",shkia:"19:38"},
"2023-06-03":{parsha:"בהעלותך",shkia:"19:42"},
"2023-06-10":{parsha:"שלח",shkia:"19:45"},
"2023-06-17":{parsha:"קרח",shkia:"19:48"},
"2023-06-24":{parsha:"חקת",shkia:"19:49"},
"2023-07-01":{parsha:"בלק",shkia:"19:50"},
"2023-07-08":{parsha:"פנחס",shkia:"19:49"},
"2023-07-15":{parsha:"מטות ומסעי",shkia:"19:47"},
"2023-07-22":{parsha:"דברים",shkia:"19:44"},
"2023-07-29":{parsha:"ואתחנן",shkia:"19:39"},
"2023-08-05":{parsha:"עקב",shkia:"19:34"},
"2023-08-12":{parsha:"ראה",shkia:"19:27"},
"2023-08-19":{parsha:"שופטים",shkia:"19:20"},
"2023-08-26":{parsha:"כי תצא",shkia:"19:12"}
  };
 
  const shabbatDate = Moment().add(6-Moment().day(),'day').format("YYYY-MM-DD");
  console.log("Shabbat date is "+shabbatDate);
  console.log("Calendar details for this date: "+calendar[shabbatDate]");
  const params = event.queryStringParameters;
  const shkia = params.shkia ?? calendar[shabbatDate].shkia;

  const shkiaMoment = Moment(shkia,"HH:mm");
  const erev_mincha = shkiaMoment.clone().subtract(12,'minute');
  erev_mincha.subtract(erev_mincha.get('minute')%5,'minute'); // Round down to 5 minutes

  const day_mincha_2 = shkiaMoment.clone().subtract(40,'minute');
  day_mincha_2.subtract(day_mincha_2.get('minute')%5,'minute'); // Round down to 5 minutes

  //const dst = shkiaMoment.isDST();

  const day_shacharit = Moment('08:00','HH:mm');
  const day_mincha_1 = Moment('12:45','HH:mm');
  if (params.dst === "true") {
     day_shacharit.add(30,'minute');
     day_mincha_1.add(30,'minute');
  }
  const day_mincha_1_shiur = day_mincha_1.clone().add(20,'minute');
  const day_womens_shiur = day_shacharit.clone().add(2,'hour');

  const calculatedParams = {
    ...params,
    parsha: params.parsha ?? calendar[shabbatDate].parsha,
    erev_mincha: params.erev_mincha ?? erev_mincha.format('HH:mm'),
    day_shacharit: params.day_shacharit ?? day_shacharit.format('HH:mm'),
    day_womens_shiur: params.day_womens_shiur ?? day_womens_shiur.format('HH:mm'),
    day_mincha_1: params.day_mincha_1 ?? day_mincha_1.format('HH:mm'),
    day_mincha_1_shiur: params.day_mincha_1_shiur ?? day_mincha_1_shiur.format('HH:mm'),
    day_mincha_2: params.day_mincha_2 ?? day_mincha_2.format('HH:mm')
  } 
  const timesGeneratorLambdaParams = {
    FunctionName: process.env.DOC_GEN_LAMBDA_NAME,
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: JSON.stringify({queryStringParameters: calculatedParams})
  };
  const response = await lambda.invoke(timesGeneratorLambdaParams).promise();
  return JSON.parse(response.Payload);
}
