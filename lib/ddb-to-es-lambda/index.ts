import { DynamoDBStreamEvent } from 'aws-lambda';

const { Client } = require('@elastic/elasticsearch');
const createAwsElasticsearchConnector = require('aws-elasticsearch-connector');

const AWSXRay = require('aws-xray-sdk');

AWSXRay.captureHTTPsGlobal(require('https'), true);
const https = require('https');

const aws = AWSXRay.captureAWS(require('aws-sdk'));

const agent = new https.Agent({
  keepAlive: true,
});

const {
  ES_ENDPOINT, INDEX,
} = process.env;

async function handler(
  event: DynamoDBStreamEvent,
) {
  console.info(JSON.stringify(event, null, 2));
  const client = new Client({
    ...createAwsElasticsearchConnector(aws.config),
    node: ES_ENDPOINT,
    agent,
  });
  try {
    const remove: any[] = [];
    const add: any[] = [];

    event.Records.forEach((record) => {
      if (record.eventName === 'REMOVE') {
        const unmarshalledRecord = aws.DynamoDB.Converter.unmarshall(record.dynamodb?.NewImage!);
        remove.push(unmarshalledRecord);
      } else {
        const unmarshalledRecord = aws.DynamoDB.Converter.unmarshall(record.dynamodb?.NewImage!);
        add.push(unmarshalledRecord);
      }
    });

    const body = add.flatMap((doc) => [{ index: { _index: INDEX, _id: doc.pk } }, doc]);

    body.push(...remove.map((doc) => ({
      delete: {
        _index: INDEX,
        _type: '_doc', // TODO needed?
        _id: doc.pk,
      },
    })));

    const { body: bulkResponse } = await client.bulk({ body, refresh: true });

    if (bulkResponse.errors) {
      const erroredDocuments: any = [];

      bulkResponse.items.forEach((action: any, i: any) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            operation: body[i * 2],
            document: body[i * 2 + 1],
          });
        }
      });
      console.log(erroredDocuments);
      throw new Error(JSON.stringify(erroredDocuments, null, 2));
    }

    console.info(`Successfully processed ${event.Records.length} records.`,
      bulkResponse);

    return bulkResponse;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export {
  handler,
};
export default handler;
