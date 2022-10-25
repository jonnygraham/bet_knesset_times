const Moment = require('moment');

const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
exports.handler = async (event) => {

  const params = event.queryStringParameters;
  const shkia = params.shkia;

  const shkiaMoment = Moment(shkia,"HH:mm");
  const erev_mincha = shkiaMoment.clone().subtract(12,'minute');
  erev_mincha.subtract(erev_mincha.get('minute')%5,'minute'); // Round down to 5 minutes

  const day_mincha_2 = shkiaMoment.clone().subtract(40,'minute');
  day_mincha_2.subtract(day_mincha_2.get('minute')%5,'minute'); // Round down to 5 minutes

  //const dst = shkiaMoment.isDST();

  const day_shacharit = Moment('08:00','HH:mm');
  const day_mincha_1 = Moment('12:45','HH:mm');
  if (params.dst) {
     day_shacharit.add(30,'minute');
     day_mincha_1.add(30,'minute');
  }
  const day_mincha_1_shiur = day_mincha_1.clone().add(20,'minute');
  const day_womens_shiur = day_shacharit.clone().add(2,'hour');

  const calculatedParams = {
    parsha: params.parsha ?? 'נח',
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
