import { Moment } from "moment";

import { calculateTimes } from "./lookupTimes"
import { InvokeCommand, LambdaClient, LogType } from "@aws-sdk/client-lambda";

export async function handler(event) {
  const params = event.queryStringParameters ?? {};
  const calculatedParams = await calculateTimes(params);

  const timesGeneratorLambdaParams = {
    FunctionName: process.env.DOC_GEN_LAMBDA_NAME,
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: JSON.stringify({ queryStringParameters: calculatedParams })
  };
  const lambda = new LambdaClient({ region: "us-east-1" });
  const command = new InvokeCommand(timesGeneratorLambdaParams);
  const { Payload } = await lambda.send(command);
  if (Payload) {
    const response = Buffer.from(Payload).toString();
    console.log(response);
    return JSON.parse(response);
  } else {
    return {
      statusCode: 500,
      body: "No payload returned from Lambda"
    }
  }
}

