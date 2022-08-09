import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as SearchEngineSample from '../lib/searchengine-sample';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new SearchEngineSample.SearchEngineSampleStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
