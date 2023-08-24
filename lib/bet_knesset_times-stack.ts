import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

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
      runtime: lambda.Runtime.NODEJS_18_X,
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
      environment: {
        BUCKET: bucket.bucketName
      }
    });

    const secret = secretsmanager.Secret.fromSecretNameV2(this, 'ImportedSecret', 'mygabay_creds');
    secret.grantRead(timesUploaderHandler.role!);

    const timesUploaderHandlerLambdaUrl = timesUploaderHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new CfnOutput(this, 'Doc Generator (TimesGenerator) URL ', { value: docGenLambdaUrl.url });
    new CfnOutput(this, 'Weekly Doc Generator (WeeklyTimesGenerator) URL ', { value: weeklyDocGenLambdaUrl.url });
    new CfnOutput(this, 'Times Uploader URL ', { value: timesUploaderHandlerLambdaUrl.url });

  }
}
