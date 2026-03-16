import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class ShulAgentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const fn = new lambda.DockerImageFunction(this, 'ShulAgentFn', {
      functionName: 'shul-agent',
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../shul-agent')
      ),
      memorySize: 2048,
      timeout: Duration.minutes(5),
      environment: {
        GEMINI_API_KEY_PARAM: '/shul-agent/gemini-api-key',
      },
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/shul-agent/*`,
      ],
    }));

    // Limit retries from EventBridge
    const version = fn.currentVersion;
    const alias = new lambda.Alias(this, 'ShulAgentAlias', {
      aliasName: 'live',
      version,
      maxEventAge: Duration.minutes(5),
      retryAttempts: 0,
    });

    // Cap concurrency — only 1 execution at a time
    (fn.node.defaultChild as lambda.CfnFunction).addOverride(
      'Properties.ReservedConcurrentExecutions', 1
    );

    // Function URL for manual testing
    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // Every Friday at 08:00 UTC (~10:00 Israel time)
    new events.Rule(this, 'WeeklyTrigger', {
      schedule: events.Schedule.cron({ minute: '0', hour: '4', weekDay: 'FRI' }),
      targets: [new targets.LambdaFunction(alias)],
    });

    new CfnOutput(this, 'ShulAgentUrl', { value: fnUrl.url });
  }
}
