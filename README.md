Summary
-------

This pattern describes how to build a GraphQL API that provides a high speed, scalable, and resilient search engine functionality. The technologies utilized in this pattern are Amazon DynamoDB, AWS AppSync, AWS Lambda, and Amazon ElasticSearch FService. The high level architecture of this pattern is based on the following:

-   Using DynamoDB for state and change control
-   Using Lambda for data and event processing, 
-   Using ElasticSearch to search search
-   Using AppSync to provide an API interact with the product. 

Prerequisites and limitations
-----------------------------

Prerequisites 
--------------

Users will need to have the following items to deploy the example pattern:

-   Access to an AWS with permissions for the related services (See Architecture)
-   Access to an AWS account that has been bootstrapped with a CDK version equal or greater than 1.96.0
-   Access to an AWS account with an internet gateway attached
-   Access to an AWS account

Limitations 
------------

This example is provided with the following limitations.

-   Free tier cover provisioned resources up to the usual limits: <https://aws.amazon.com/free/>

Product versions
----------------

Lambdas for the example are created using the `NODEJS_12_X runtime`

The ElasticSearch version for the example is set to 7.9

Architecture
------------

Target technology stack  
-------------------------

This stack will deploy the following resources into your account.

-   Amazon DynamoDB
-   AWS AppSync
-   AWS Lambda
-   Amazon ElasticSearch Service
-   AWS IAM Service Roles
-   Amazon Cognito User Pool

This stack will create the following resource associations:

-   AppSync DynamoDB DataSource
-   AppSync ElasticSearch DataSource
-   DynamoDB Stream
-   DynamoDB Trigger: Lambda
-   Lambda IAM execution role
-   Cognito IAM Auth Role for Kibana

Target architecture 
--------------------

![](https://1a9zxhkqsj.execute-api.us-west-2.amazonaws.com/v1/contents/1937f946-4239-4e74-addd-1a47372d2f3c/images/3d254c61-0286-4fd3-8c46-a7d1a196d83d.png)

Automation and scale
--------------------

There are no autoscaling options enabled in this example.

Some options for autoscaling these services are follows:

Lambda:

-   Ultrawarm
-   Concurrency

ElasticSearch:

-   Autoscaling cluster
-   Addition of Master Nodes
-   Addition of MultiAZ deployments

DynamoDB:

-   Convert to On Demand provisioning
-   Add autoscaling WCU and RCU capacity
-   Adding DAX

AppSync:

-   Provisioned Cache instance

Please consult the documentation around scaling practices for these services.

-   ElasticSearch: <https://aws.amazon.com/premiumsupport/knowledge-center/elasticsearch-scale-up/>
-   AppSync: <https://docs.aws.amazon.com/appsync/latest/devguide/enabling-caching.html>
-   DynamoDB: <https://aws.amazon.com/blogs/database/amazon-dynamodb-auto-scaling-performance-and-cost-optimization-at-any-scale/>
-   Lambda: <https://docs.aws.amazon.com/lambda/latest/dg/invocation-scaling.html>

Please consult the free tier allowances before attempting to scale this product.

-   <https://aws.amazon.com/free>

Tools
-----

Tools
-----

This example was built using CDK. If you are unfamiliar with CDK please refer to <https://aws.amazon.com/cdk/>.

Your CDK environment will also need to have NodeJS v12 or v14 installed.