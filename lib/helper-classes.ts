import * as appsync from '@aws-cdk/aws-appsync';
import * as cdk from '@aws-cdk/core';

/**
 * Properties for an AppSync Elasticsearch data source
 */
export interface ElasticsearchDataSourceProps extends appsync.BaseDataSourceProps {
    /**
     * Region for the Amazon Elasticsearch Service domain
     */
    readonly region: string;
    /**
     * Endpoint for the Amazon Elasticsearch Service domain
     */
    readonly endpoint: string;
}

/**
 * An AppSync data source backed by Elasticsearch
 */
export class ElasticsearchDataSource extends appsync.BackedDataSource {
    constructor(scope: cdk.Construct, id: string, props: ElasticsearchDataSourceProps) {
        super(scope, id, props, {
            type: 'AMAZON_ELASTICSEARCH',
            elasticsearchConfig: {
                awsRegion: props.region,
                endpoint: props.endpoint,
            },
        });
    }
}
