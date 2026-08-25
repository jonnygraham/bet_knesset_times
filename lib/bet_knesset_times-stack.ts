import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

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
      runtime: lambda.Runtime.NODEJS_22_X,
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
      runtime: lambda.Runtime.NODEJS_22_X,
      depsLockFilePath: './package-lock.json', 
      entry: './dist/src/timesFileGenerator.js',
      handler: "handler",
      timeout: Duration.seconds(60),
      environment: {
        BUCKET: bucket.bucketName
      },
    });

    const param = ssm.StringParameter.fromSecureStringParameterAttributes(this, `ParameterCreds`, {
      parameterName: 'mygabay_creds'});
    param.grantRead(timesUploaderHandler.role!);

    const timesUploaderHandlerLambdaUrl = timesUploaderHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    const timesCsvHandler = new lambda_nodejs.NodejsFunction(this, "TimesCsv", {
      runtime: lambda.Runtime.NODEJS_22_X,
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

    const timesJsonHandler = new lambda_nodejs.NodejsFunction(this, "TimesJson", {
      runtime: lambda.Runtime.NODEJS_22_X,
      depsLockFilePath: './package-lock.json',
      entry: './dist/src/timesJsonHandler.js',
      handler: "handler",
      timeout: Duration.seconds(30),
    });

    const timesJsonUrl = timesJsonHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    const timesMdHandler = new lambda_nodejs.NodejsFunction(this, "TimesMd", {
      runtime: lambda.Runtime.NODEJS_22_X,
      depsLockFilePath: './package-lock.json',
      entry: './dist/src/timesMdHandler.js',
      handler: "handler",
      timeout: Duration.seconds(30),
    });

    const timesMdUrl = timesMdHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new CfnOutput(this, 'Times JSON URL', { value: timesJsonUrl.url, exportName: 'TimesJsonUrl' });
    new CfnOutput(this, 'Times MD URL', { value: timesMdUrl.url, exportName: 'TimesMdUrl' });
    new CfnOutput(this, 'Times Uploader URL ', { value: timesUploaderHandlerLambdaUrl.url });
    new CfnOutput(this, 'Times CSV URL ', { value: timesCsvHandlerLambdaUrl.url });

    // CloudFront Distribution for single domain with clean path routing
    const jsonOrigin = new origins.FunctionUrlOrigin(timesJsonUrl);
    const mdOrigin = new origins.FunctionUrlOrigin(timesMdUrl);
    const docxOrigin = new origins.FunctionUrlOrigin(weeklyDocGenLambdaUrl);
    const csvOrigin = new origins.FunctionUrlOrigin(timesCsvHandlerLambdaUrl);
    const uploaderOrigin = new origins.FunctionUrlOrigin(timesUploaderHandlerLambdaUrl);
    const docGenOrigin = new origins.FunctionUrlOrigin(docGenLambdaUrl);

    const defaultOriginRequestPolicy = cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER;
    const cacheDisabledPolicy = cloudfront.CachePolicy.CACHING_DISABLED;

    const distribution = new cloudfront.Distribution(this, 'TimesDistribution', {
      comment: 'Single CloudFront distribution for Bet Knesset Times endpoints',
      defaultBehavior: {
        origin: jsonOrigin,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cacheDisabledPolicy,
        originRequestPolicy: defaultOriginRequestPolicy,
      },
      additionalBehaviors: {
        '/times': {
          origin: jsonOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cacheDisabledPolicy,
          originRequestPolicy: defaultOriginRequestPolicy,
        },
        '/json': {
          origin: jsonOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cacheDisabledPolicy,
          originRequestPolicy: defaultOriginRequestPolicy,
        },
        '/md': {
          origin: mdOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cacheDisabledPolicy,
          originRequestPolicy: defaultOriginRequestPolicy,
        },
        '/markdown': {
          origin: mdOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cacheDisabledPolicy,
          originRequestPolicy: defaultOriginRequestPolicy,
        },
        '/docx': {
          origin: docxOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cacheDisabledPolicy,
          originRequestPolicy: defaultOriginRequestPolicy,
        },
        '/flyer': {
          origin: docxOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cacheDisabledPolicy,
          originRequestPolicy: defaultOriginRequestPolicy,
        },
        '/csv': {
          origin: csvOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cacheDisabledPolicy,
          originRequestPolicy: defaultOriginRequestPolicy,
        },
        '/upload': {
          origin: uploaderOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cacheDisabledPolicy,
          originRequestPolicy: defaultOriginRequestPolicy,
        },
        '/doc-gen': {
          origin: docGenOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cacheDisabledPolicy,
          originRequestPolicy: defaultOriginRequestPolicy,
        },
      },
    });

    new CfnOutput(this, 'CloudFront Domain URL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Main CloudFront domain for all endpoints',
    });
    new CfnOutput(this, 'CloudFront Times JSON', {
      value: `https://${distribution.distributionDomainName}/times`,
    });
    new CfnOutput(this, 'CloudFront Times Markdown', {
      value: `https://${distribution.distributionDomainName}/md`,
    });
    new CfnOutput(this, 'CloudFront Times DOCX', {
      value: `https://${distribution.distributionDomainName}/docx`,
    });
    new CfnOutput(this, 'CloudFront Times CSV', {
      value: `https://${distribution.distributionDomainName}/csv`,
    });
    new CfnOutput(this, 'CloudFront Times Upload', {
      value: `https://${distribution.distributionDomainName}/upload`,
    });

  }
}
