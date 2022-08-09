import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as lambda from '@aws-cdk/aws-lambda';
import * as ddb from '@aws-cdk/aws-dynamodb';
import * as iam from '@aws-cdk/aws-iam';
import * as es from '@aws-cdk/aws-elasticsearch';
import * as cn from '@aws-cdk/aws-cognito';
import * as sources from '@aws-cdk/aws-lambda-event-sources';
import { ElasticsearchDataSource } from './helper-classes';
import * as fs from "fs";
import {CfnOutput} from "@aws-cdk/core";

export class SearchEngineSampleStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // This role is explicitly defined since there no operator to grant access to CWL from Appsync.
    const apiLogsRole = new iam.Role(this, 'appsyncLoggingRole', {
      assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSAppSyncPushToCloudWatchLogs'
        )
      ]
    });

    //Appsync resource, building a schema from the file 'lib/schema.graphql'
    const api = new appsync.GraphqlApi(this, 'Api', {
      name: 'demoGraphAPI',
      schema: appsync.Schema.fromAsset('lib/graphQL/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
            authorizationType: appsync.AuthorizationType.IAM,
        }
      },
      xrayEnabled: true,
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
        role: apiLogsRole
      }
    });

    //Table we will assemble documents from
    const ddbTable = new ddb.Table(this, 'ddbStateTable', {
      billingMode: ddb.BillingMode.PROVISIONED,
      partitionKey: {
        name: 'pk',
        type: ddb.AttributeType.STRING,
      },
      stream: ddb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      readCapacity: 25,
      writeCapacity:25,
    });

    //This is several CFN resources that set up Cognito for you so that you can create user and access Kibana
    const userPool = new cn.UserPool(this, 'searchUserPool', {
      selfSignUpEnabled: false,
      userInvitation: {
        emailSubject: 'Demo Kibana Invite',
        emailBody: 'Hello {username}, Your temporary password is {####}',
      },
      signInAliases: {
        username: true,
        email: true,
      },
      autoVerify: { email: true },
    });

    new cn.UserPoolDomain(this, 'cognito-domain', {
      cognitoDomain: {
        domainPrefix: 'searchpooldomain',
      },
      userPool,
    });

    const idPool = new cn.CfnIdentityPool(this, 'identitypool', {
      identityPoolName: 'searchIdPool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [],
    });

    const authRole = new iam.Role(this, 'authRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
        StringEquals: { 'cognito-identity.amazonaws.com:aud': idPool.ref },
        'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
      }, 'sts:AssumeRoleWithWebIdentity'),
    });

    const esRole = new iam.Role(this, 'esRole', {
      assumedBy: new iam.ServicePrincipal('es.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonESCognitoAccess')],
    });

    new cn.CfnIdentityPoolRoleAttachment(this, 'userPoolRoleAttachment', {
      identityPoolId: idPool.ref,
      roles: {
        authenticated: authRole.roleArn,
      },
    });

    //A basic domain of a fairly large size. This instance was chosen so that all basic features, such as Auto-Tune, are enabled.
    const domain = new es.Domain(this, 'searchDomain', {
      version: es.ElasticsearchVersion.V7_9,
      capacity: {
        dataNodes: 1,
        dataNodeInstanceType: 't3.small.elasticsearch',
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      cognitoKibanaAuth: {
        role: esRole,
        identityPoolId: idPool.ref,
        userPoolId: userPool.userPoolId,
      },
      accessPolicies: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'es:ESHttpGet',
            'es:ESHttpPut',
            'es:ESHttpPost',
            'es:ESHttpDelete',
          ],
          resources: [
            '*',
          ],
          principals: [
            new iam.ArnPrincipal(authRole.roleArn),
          ],
        }),
      ],
    });

    //This function and subsequent grants and event sources will create ES documents from Dynamo actions
    const ddbToEsFunction = new lambda.Function(this, 'DdbToEsFunction', {
      runtime: lambda.Runtime.NODEJS_16_X,
      functionName: 'searchDynamoToElasticsearchProcessor',
      handler: 'index.default',
      code: lambda.Code.fromAsset('./lib/ddb-to-es-lambda/dist'),
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        ES_ENDPOINT: `https://${domain.domainEndpoint}`,
        INDEX: 'index',
      },
    });
    domain.grantIndexWrite('*', ddbToEsFunction);

    ddbToEsFunction.addEventSource(new sources.DynamoEventSource(ddbTable, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 1000,
      bisectBatchOnError: true,
      retryAttempts: 5,
    }));

    const ddbDs = api.addDynamoDbDataSource('ddbSource', ddbTable);
    const esDs = new ElasticsearchDataSource(this, 'esDs', {
      api,
      endpoint: `https://${domain.domainEndpoint}`,
      region: this.region
    });

    ddbTable.grantReadWriteData(ddbDs);
    domain.grantIndexRead('*', esDs);

    new appsync.Resolver(this, 'mutationResolver', {
      api,
      dataSource: ddbDs,
      typeName: 'Mutation',
      fieldName: 'createEvent',
      requestMappingTemplate: appsync.MappingTemplate.fromString(fs.readFileSync('lib/graphQL/mutation/request.vl', 'utf8')),
      responseMappingTemplate: appsync.MappingTemplate.fromString(fs.readFileSync('lib/graphQL/mutation/response.vl', 'utf8')),
    })

    new appsync.Resolver(this, 'searchResolver', {
      api,
      dataSource: esDs,
      typeName: 'Query',
      fieldName: 'search',
      requestMappingTemplate: appsync.MappingTemplate.fromString(fs.readFileSync('lib/graphQL/query/request.vl', 'utf8')),
      responseMappingTemplate: appsync.MappingTemplate.fromString(fs.readFileSync('lib/graphQL/query/response.vl', 'utf8')),
    })

    new CfnOutput(this, 'GraphUrl', {
      value: api.graphqlUrl,
    });
  }
}
