import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export class BetKnessetTimesStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "betKnessetTziirimTimes");

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./resources/templates')],
      destinationBucket: bucket,
      destinationKeyPrefix: 'templates'
    }); 

    const docGenHandler = new lambda_nodejs.NodejsFunction(this, "TimesGenerator", {
      runtime: lambda.Runtime.NODEJS_22_X,
      depsLockFilePath: './package-lock.json', 
      entry: './dist/src/timesGeneratorHandler.js',
      handler: "handler",
      timeout: Duration.seconds(120),
      environment: {
        BUCKET: bucket.bucketName
      }
    });

    const docGenLambdaUrl = docGenHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    bucket.grantReadWrite(docGenHandler);

    const weeklyDocGenHandler = new lambda_nodejs.NodejsFunction(this, "WeeklyDocGenerator", {
      runtime: lambda.Runtime.NODEJS_18_X,
      depsLockFilePath: './package-lock.json', 
      entry: './dist/src/timesHandler.js',
      handler: "handler",
      timeout: Duration.seconds(180),
      environment: {
        DOC_GEN_LAMBDA_NAME: docGenHandler.functionName
      }
    });

    const weeklyDocGenLambdaUrl = weeklyDocGenHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    docGenHandler.grantInvoke(weeklyDocGenHandler);
 

    const timesUploaderHandler = new lambda_nodejs.NodejsFunction(this, "TimesUploader", {
      runtime: lambda.Runtime.NODEJS_18_X,
      depsLockFilePath: './package-lock.json', 
      entry: './dist/src/timesFileGenerator.js',
      handler: "handler",
      timeout: Duration.seconds(120),
      memorySize: 1024, // Minimum for Chromium
      bundling: {
        externalModules: [], // no external
        nodeModules: ['chrome-aws-lambda', 'puppeteer-core'], // ✅ include both
      },
      environment: {
        BUCKET: bucket.bucketName
      }
    });

    const param = ssm.StringParameter.fromSecureStringParameterAttributes(this, `ParameterCreds`, {
      parameterName: 'mygabay_creds'});
    param.grantRead(timesUploaderHandler.role!);
    ['mygabay_eventValidation','mygabay_viewstate_part1','mygabay_viewstate_part2'].forEach(paramName => {
        const param = ssm.StringParameter.fromStringParameterAttributes(this, `Parameter${paramName}`, {
          parameterName: paramName});
        param.grantRead(timesUploaderHandler.role!);
      });

    const timesUploaderHandlerLambdaUrl = timesUploaderHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    const timesCsvHandler = new lambda_nodejs.NodejsFunction(this, "TimesCsv", {
      runtime: lambda.Runtime.NODEJS_18_X,
      depsLockFilePath: './package-lock.json', 
      entry: './dist/src/timesCsvGenerator.js',
      handler: "handler",
      timeout: Duration.seconds(360),
      environment: {
        BUCKET: bucket.bucketName
      }
    });

    const timesCsvHandlerLambdaUrl = timesCsvHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    const isDst = 'true';
    // Rule for Thursday at 18:00 UTC to update weekday times for next week
    const thursdayRule = new events.Rule(this, 'ThursdayScheduleRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '18', weekDay: 'THU' }),
    });
    thursdayRule.addTarget(new targets.LambdaFunction(timesUploaderHandler, {
      event: events.RuleTargetInput.fromObject({ queryStringParameters: { dst: isDst, upload: 'weekday' } }),
    }));

    // Rule for Saturday at 19:00 UTC to update shabbat times for next week
    const saturdayRule = new events.Rule(this, 'SaturdayScheduleRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '19', weekDay: 'SAT' }),
    });
    saturdayRule.addTarget(new targets.LambdaFunction(timesUploaderHandler, {
      event: events.RuleTargetInput.fromObject({ queryStringParameters: { dst: isDst, upload: 'shabbat' } }),
    }));
    
    new CfnOutput(this, 'Doc Generator (TimesGenerator) URL ', { value: docGenLambdaUrl.url });
    new CfnOutput(this, 'Weekly Doc Generator (WeeklyTimesGenerator) URL ', { value: weeklyDocGenLambdaUrl.url });
    new CfnOutput(this, 'Times Uploader URL ', { value: timesUploaderHandlerLambdaUrl.url });
    new CfnOutput(this, 'Times CSV URL ', { value: timesCsvHandlerLambdaUrl.url });

  }
}
